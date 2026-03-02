<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import QRCode from 'qrcode'
import { usePaymentStatus } from '../composables/usePaymentStatus'
import { useXnapSnap } from '../composables/useXnapSnap'

const props = defineProps({
  demoServerUrl: {
    type: String,
    default: () => import.meta.env.VITE_MAINNET_DEMO_URL || 'http://localhost:3001'
  },
  demoTestnetServerUrl: {
    type: String,
    default: () => import.meta.env.VITE_TESTNET_DEMO_URL || 'http://localhost:3002'
  }
})

// Check if the developer explicitly disabled the Testnet tab in building .env
const enableTestnetTab = import.meta.env.VITE_ENABLE_TESTNET_TAB !== 'false'

// UI State
const networkMode = ref<'mainnet' | 'testnet'>('mainnet')
const activeServerUrl = ref(props.demoServerUrl)
const isLoading = ref(true)
const fetchError = ref<string | null>(null)
const qrcodeDataUrl = ref('')
const countdown = ref(0)
let timerInterval: any = null

// Payment method tab state
const activePaymentTab = ref<'qr' | 'metamask'>('qr')

// Protocol Log
interface LogEntry {
    type: 'req' | 'res' | 'info'
    content: string
}
const httpLog = ref<LogEntry[]>([])

// Payment State
const session = ref<any>(null)
const { status: sseStatus, error: sseError, blockHash } = usePaymentStatus(
  '', ''
)

// Xnap Integration
const { isMetaMaskInstalled, isXnapInstalled, isPending: xnapPending, error: xnapError, installXnap, payWithXnap } = useXnapSnap()

let eventSource: EventSource | null = null
const paymentStatus = ref<'pending' | 'confirmed' | 'failed' | 'expired'>('pending')
const finalBlockHash = ref<string | null>(null)
const globalError = ref<string | null>(null)
const serverProvidedContent = ref<string | null>(null)

onMounted(async () => {
  if (typeof window !== 'undefined' && window.location.hash === '#testnet') {
    networkMode.value = 'testnet'
    activeServerUrl.value = props.demoTestnetServerUrl
  } else {
    networkMode.value = 'mainnet'
    activeServerUrl.value = props.demoServerUrl
  }
  await fetchPaymentRequirements()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (eventSource) eventSource.close()
})

async function fetchPaymentRequirements() {
  // Clean up existing state for restart
  if (timerInterval) clearInterval(timerInterval)
  if (eventSource) {
      eventSource.close()
      eventSource = null
  }
  session.value = null
  paymentStatus.value = 'pending'
  finalBlockHash.value = null
  serverProvidedContent.value = null
  activePaymentTab.value = 'qr' // Reset to QR tab
  
  isLoading.value = true
  fetchError.value = null
  httpLog.value = [] // Reset log
  try {
    const targetHost = new URL(activeServerUrl.value).host
    httpLog.value.push({ type: 'req', content: `GET /api/protected\nHost: ${targetHost}\nAccept: application/json` })

    const res = await fetch(`${activeServerUrl.value}/api/protected`)
    
    // Check if it's the expected 402
    if (res.status === 402) {
      const xPaymentRequired = res.headers.get('x-payment-required')
      if (xPaymentRequired) {
        // Pretty print the JSON for the log
        let prettyJson = ''
        try {
            prettyJson = JSON.stringify(JSON.parse(xPaymentRequired), null, 2)
        } catch {
            prettyJson = xPaymentRequired
        }
        
        httpLog.value.push({ 
            type: 'res', 
            content: `HTTP/1.1 402 Payment Required\nX-Payment-Required: ${prettyJson}` 
        })
        
        const reqs = JSON.parse(xPaymentRequired)
        session.value = {
          payTo: reqs.payTo,
          amountRaw: (BigInt(reqs.amount) + BigInt(reqs.extra.tag)).toString(),
          sessionId: reqs.extra.sessionId,
          expiresAt: reqs.maxTimeoutSeconds ? Date.now() + (reqs.maxTimeoutSeconds * 1000) : Date.now() + 600000 
        }
        
        // Generate QR
        generateQRCode()
        
        // Start countdown
        startCountdown()
        
        // Connect SSE
        connectSSE()
      } else {
        throw new Error("Missing X-Payment-Required header")
      }
    } else if (res.status === 200) {
        // Technically shouldn't happen on first load without a session
        paymentStatus.value = 'confirmed'
    } else {
        throw new Error(`Unexpected server response: ${res.status}`)
    }
  } catch (err: any) {
    console.error("Failed to fetch 402:", err)
    fetchError.value = err.message || "Could not connect to payment server. Ensure it is running."
  } finally {
    isLoading.value = false
  }
}

function connectSSE() {
   if (!session.value?.sessionId) return
   
   eventSource = new EventSource(`${activeServerUrl.value}/api/status/${session.value.sessionId}`);
   
   eventSource.onopen = () => {
       httpLog.value.push({ type: 'info', content: `(SSE connection established for session...)` })
   }

   eventSource.onmessage = (event) => {
        if (event.data === 'heartbeat') return;
        try {
            const data = JSON.parse(event.data);
            if (data.status) {
                paymentStatus.value = data.status;
                if (data.blockHash) finalBlockHash.value = data.blockHash;

                if (data.status === 'confirmed') {
                    httpLog.value.push({ type: 'info', content: `(Payment received: ${data.blockHash})` })
                    
                    // Fetch the protected content using the newly confirmed block hash and session
                    httpLog.value.push({ type: 'req', content: `GET /api/protected\nX-Payment-Block: ${data.blockHash}\nX-Payment-Session: ${session.value?.sessionId}` })
                    
                    fetch(`${activeServerUrl.value}/api/protected`, {
                        headers: {
                            'X-Payment-Block': data.blockHash,
                            'X-Payment-Session': session.value?.sessionId
                        }
                    })
                    .then(res => res.json())
                    .then(protectedData => {
                        if (protectedData.success && protectedData.html) {
                            serverProvidedContent.value = protectedData.html;
                            httpLog.value.push({ type: 'res', content: `HTTP/1.1 200 OK\nContent-Type: application/json\n\n<protected content revealed>` })
                        }
                    })
                    .catch(err => {
                        console.error('Failed to fetch protected content via verify route', err);
                    })

                    eventSource?.close();
                    clearInterval(timerInterval);
                }
            }
        } catch (e) {
            console.error('Failed to parse SSE', e);
        }
    };
    
    eventSource.onerror = () => {
        globalError.value = "Live connection lost. Checking manually..."
        // In a real app we'd trigger a manual verification poll here
    }
}

async function generateQRCode() {
  if (!session.value) return
  // xrb: or nano:
  const uri = `nano:${session.value.payTo}?amount=${session.value.amountRaw}`
  try {
    qrcodeDataUrl.value = await QRCode.toDataURL(uri, { 
        width: 250,
        margin: 2,
        color: { dark: '#000000FF', light: '#FFFFFFFF' }
    })
  } catch (err) {
    console.error('QR code generation failed', err)
  }
}

function startCountdown() {
    updateCountdown()
    timerInterval = setInterval(updateCountdown, 1000)
}

function updateCountdown() {
    if (!session.value) return
    const now = Date.now()
    const diff = Math.floor((session.value.expiresAt - now) / 1000)
    
    if (diff <= 0) {
        countdown.value = 0
        clearInterval(timerInterval)
        paymentStatus.value = 'expired'
        if (eventSource) eventSource.close()
    } else {
        countdown.value = diff
    }
}

function formatRawAmount(raw: string) {
    // Convert RAW to XNO (10^30) for display purposes
    if (!raw || raw.length < 25) return "0.000000"
    
    const padded = raw.padStart(31, '0')
    const whole = padded.slice(0, -30) || '0'
    const fraction = padded.slice(-30) // keep all 30 decimals
    
    // Trim trailing zeros but ensure at least 6 decimals
    let trimmedFraction = fraction.replace(/0+$/, '')
    if (trimmedFraction.length < 6) {
        trimmedFraction = trimmedFraction.padEnd(6, '0')
    }
    
    return `${whole}.${trimmedFraction}`
}

async function handleXnapClick() {
    if (!isXnapInstalled.value) {
        await installXnap()
    } else if (session.value) {
        try {
            await payWithXnap(session.value.payTo, session.value.amountRaw)
        } catch (e) {
            // Error mapped in composable
        }
    }
}

async function setNetworkMode(mode: 'mainnet' | 'testnet') {
  if (networkMode.value === mode) return
  
  networkMode.value = mode
  activeServerUrl.value = mode === 'testnet' ? props.demoTestnetServerUrl : props.demoServerUrl
  
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', mode === 'testnet' ? '#testnet' : window.location.pathname)
  }
  
  // Clean up existing state
  if (timerInterval) clearInterval(timerInterval)
  if (eventSource) {
      eventSource.close()
      eventSource = null
  }
  session.value = null
  paymentStatus.value = 'pending'
  finalBlockHash.value = null
  serverProvidedContent.value = null
  
  await fetchPaymentRequirements()
}
</script>

<template>
  <div class="nano-paywall">
    
    <!-- Anchor targets for hash navigation -->
    <div id="mainnet" class="network-anchor"></div>
    <div id="testnet" class="network-anchor"></div>

    <!-- Network Tab Switcher -->
    <div class="network-tabs-wrapper" id="network-tabs" v-if="enableTestnetTab">
      <div class="network-tabs-container">
        <button 
          @click="setNetworkMode('mainnet')"
          :class="['network-tab', networkMode === 'mainnet' ? 'active' : '']"
        >
          Mainnet
        </button>
        <button 
          @click="setNetworkMode('testnet')"
          :class="['network-tab', networkMode === 'testnet' ? 'active' : '']"
        >
          Testnet
        </button>
      </div>
    </div>

    <!-- SUCCESS STATE -->
    <div v-if="paymentStatus === 'confirmed'" class="success-container">
        <div class="success-banner">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <h2>🎉 Payment successful!</h2>
        </div>
        <div data-testid="protected-content">
           <slot></slot>
           
           <div v-if="serverProvidedContent" v-html="serverProvidedContent" class="server-content"></div>
        </div>
        
        <div class="block-info">
           Block: <a :href="`https://nanexplorer.com/block/${finalBlockHash}`" target="_blank" rel="noopener noreferrer" class="block-link">{{ finalBlockHash }}</a>
        </div>
    </div>

    <!-- MAIN PAYWALL CONTAINER -->
    <div v-else class="paywall-container" data-testid="payment-required">
        
        <!-- Header -->
        <div class="paywall-header">
            <h3>Payment Required</h3>
            <p>Access to protected content.</p>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Generating session...</p>
        </div>

        <!-- Fetch Error State -->
        <div v-else-if="fetchError" class="error-state">
            <p>{{ fetchError }}</p>
            <button @click="fetchPaymentRequirements" class="retry-btn">
                Retry
            </button>
        </div>
        
        <!-- Expired State -->
        <div v-else-if="paymentStatus === 'expired'" class="expired-state">
            <p>Session Expired. Please refresh to start a new payment session.</p>
        </div>

        <!-- Active Payment State -->
        <div v-else-if="session" class="payment-active">
            
            <!-- COMMON INFO (always visible) -->
            <div class="common-info">
                <p class="payment-amount">
                   Please pay exactly <strong data-testid="payment-amount-raw" :data-raw="session.amountRaw">{{ formatRawAmount(session.amountRaw) }} XNO</strong> to:
                </p>

                <div class="address-pane" data-testid="payment-address">
                    {{ session.payTo }}
                </div>

                <!-- Session Timer -->
                <div class="session-timer">
                    Session expires in: <span class="mono">{{ Math.floor(countdown / 60) }}:{{ (countdown % 60).toString().padStart(2, '0') }}</span>
                </div>
            </div>

            <!-- PAYMENT METHOD TABS -->
            <div class="payment-tabs">
                <div class="tab-headers">
                    <button 
                        @click="activePaymentTab = 'qr'"
                        :class="['tab-btn', activePaymentTab === 'qr' ? 'active-tab' : '']"
                    >
                        📱 QR Code
                    </button>
                    <button 
                        v-if="isMetaMaskInstalled"
                        @click="activePaymentTab = 'metamask'"
                        :class="['tab-btn', activePaymentTab === 'metamask' ? 'active-tab' : '']"
                    >
                        🦊 MetaMask
                    </button>
                </div>

                <!-- QR Code Tab -->
                <div v-if="activePaymentTab === 'qr'" class="tab-content">
                    <div class="qr-section">
                        <div class="qr-wrapper">
                            <img v-if="qrcodeDataUrl" :src="qrcodeDataUrl" alt="Nano Payment QR Code" />
                        </div>
                        <p class="qr-hint">
                            Scan with Natrium, Nault, or any Nano wallet
                        </p>
                    </div>
                </div>

                <!-- MetaMask Tab -->
                <div v-if="activePaymentTab === 'metamask'" class="tab-content">
                    <div class="metamask-section">
                        <div v-if="!xnapPending" class="metamask-idle">
                            <button 
                                @click="handleXnapClick" 
                                class="xnap-btn"
                            >
                                <span v-if="!isXnapInstalled">Install Xnap Snap</span>
                                <span v-else>Pay with MetaMask</span>
                            </button>
                            <p class="xnap-description">
                                Xnap is a MetaMask Snap that enables Nano payments directly in your browser wallet.
                            </p>
                        </div>
                        
                        <div v-else class="metamask-pending">
                            <div class="spinner"></div>
                            <p class="pending-title">Transaction in progress...</p>
                            <p class="pending-description">
                                MetaMask snap is calculating Proof-of-Work.<br>
                                This may take 10-30 seconds.
                            </p>
                        </div>
                        
                        <div v-if="xnapError" class="xnap-error">{{ xnapError }}</div>
                    </div>
                </div>
            </div>

            <!-- GLOBAL STATUS (always visible) -->
            <div class="global-status">
                <div v-if="paymentStatus === 'pending'" class="waiting-status" data-testid="payment-status" data-status="pending">
                    <span class="status-dot">
                      <span class="status-ping"></span>
                      <span class="status-core"></span>
                    </span>
                    Waiting for payment...
                </div>
                <div v-else-if="paymentStatus === 'expired'" class="expired-status">
                    Session expired
                </div>
            </div>
        </div>
    </div>

    <!-- GLOBAL RESTART LINK (always visible) -->
    <div class="restart-link-container">
        <button @click="fetchPaymentRequirements" class="restart-link">↻ Restart demo</button>
    </div>

    <!-- GLOBAL PROTOCOL CONSOLE (always visible) -->
    <div class="protocol-terminal">
        <div class="terminal-header">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
            <span class="title">Protocol Log</span>
        </div>
        <div class="terminal-body" ref="logBody">
            <div v-for="(log, i) in httpLog" :key="i" class="log-entry">
                <span v-if="log.type === 'req'" class="req-text">→ Client Request:<br>{{ log.content }}</span>
                <span v-else-if="log.type === 'res'" class="res-text">← Server Response:<br>{{ log.content }}</span>
                <span v-else class="info-text">{{ log.content }}</span>
            </div>
            <div v-if="httpLog.length === 0" class="empty-log">Waiting for first request...</div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.nano-paywall {
    padding-top: 1rem;
    padding-bottom: 2rem;
}

/* Invisible Anchors for smooth hash routing */
.network-anchor {
  position: relative;
  top: -80px;
  visibility: hidden;
  height: 0;
}

/* Network Tabs */
.network-tabs-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.network-tabs-container {
  background-color: var(--vp-c-bg-alt);
  padding: 4px;
  display: flex;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.network-tab {
  padding: 6px 16px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: var(--vp-c-text-2);
  cursor: pointer;
  background: transparent;
  border: none;
}

.network-tab:hover {
  color: var(--vp-c-text-1);
}

.network-tab.active {
  background-color: var(--vp-c-brand);
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

/* Success State */
.success-container {
    max-width: 40rem;
    margin-left: auto;
    margin-right: auto;
    margin-bottom: 24px;
    background-color: rgba(34, 197, 94, 0.1);
    padding: 16px;
    border-radius: 12px;
    border: 1px solid rgba(34, 197, 94, 0.3);
}
    max-width: 36rem;
    margin-left: auto;
    margin-right: auto;
    margin-bottom: 24px;
    background-color: rgba(34, 197, 94, 0.1);
    padding: 24px;
    border-radius: 12px;
    border: 1px solid rgba(34, 197, 94, 0.3);
}

.success-banner {
    margin-bottom: 24px;
    color: #16a34a;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.success-banner h2 {
    margin: 0;
}

.server-content {
    margin-top: 16px;
    background-color: var(--vp-c-bg);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid var(--vp-c-divider);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
}

.block-info {
    margin-top: 24px;
    font-size: 12px;
    color: #6b7280;
    opacity: 0.7;
}

.block-link {
    color: var(--vp-c-brand);
    text-decoration: none;
}

.block-link:hover {
    text-decoration: underline;
}

/* Paywall Container */
.paywall-container {
    max-width: 28rem;
    margin-left: auto;
    margin-right: auto;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    background-color: var(--vp-c-bg-soft);
}

.paywall-header {
    background-color: var(--vp-c-bg-alt);
    border-bottom: 1px solid var(--vp-c-divider);
    padding: 16px 24px;
    text-align: center;
}

.paywall-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
}

.paywall-header p {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
    margin-top: 4px;
    margin-bottom: 0;
}

/* Loading State */
.loading-state {
    padding: 48px;
    text-align: center;
}

.spinner {
    display: inline-block;
    width: 32px;
    height: 32px;
    border: 4px solid #3b82f6;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Error State */
.error-state {
    padding: 32px;
    text-align: center;
    color: #ef4444;
}

.retry-btn {
    margin-top: 16px;
    padding: 8px 16px;
    background-color: var(--vp-c-brand);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.retry-btn:hover {
    background-color: var(--vp-c-brand-dark);
}

/* Expired State */
.expired-state {
    padding: 32px;
    text-align: center;
    color: #f97316;
}

/* Common Info */
.common-info {
    padding: 24px;
    border-bottom: 1px solid var(--vp-c-divider);
}

.payment-amount {
    text-align: center;
    font-size: 0.875rem;
    margin-bottom: 16px;
    margin-top: 0;
}

.address-pane {
    width: 100%;
    background-color: var(--vp-c-bg-alt);
    font-size: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    padding: 12px;
    border-radius: 6px;
    text-align: center;
    word-break: break-all;
    color: var(--vp-c-text-2);
    margin-bottom: 16px;
    user-select: all;
}

.session-timer {
    text-align: center;
    font-size: 0.75rem;
    color: var(--vp-c-text-3);
}

.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* Payment Method Tabs */
.tab-headers {
    display: flex;
    border-bottom: 1px solid var(--vp-c-divider);
}

.tab-btn {
    flex: 1;
    padding: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    color: var(--vp-c-text-2);
    transition: color 0.2s;
}

.tab-btn:hover {
    color: var(--vp-c-text-1);
}

.tab-btn.active-tab {
    color: var(--vp-c-brand);
}

.tab-btn.active-tab::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--vp-c-brand);
}

/* Tab Content */
.tab-content {
    padding: 24px;
}

/* QR Section */
.qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.qr-wrapper {
    background-color: white;
    padding: 8px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 16px;
}

.qr-wrapper img {
    width: 192px;
    height: 192px;
    display: block;
}

.qr-hint {
    font-size: 0.75rem;
    color: var(--vp-c-text-2);
    text-align: center;
    margin: 0;
}

/* MetaMask Section */
.metamask-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.metamask-idle {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.xnap-btn {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #ffffff;
    background-color: #2563eb;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background-color 0.2s;
}

.xnap-btn:hover {
    background-color: #1d4ed8;
}

.xnap-description {
    font-size: 0.75rem;
    color: var(--vp-c-text-2);
    margin-top: 16px;
    max-width: 20rem;
    margin-bottom: 0;
}

.metamask-pending {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.pending-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--vp-c-brand);
    margin: 0;
}

.pending-description {
    font-size: 0.75rem;
    color: var(--vp-c-text-2);
    margin-top: 8px;
    max-width: 20rem;
    margin-bottom: 0;
}

.xnap-error {
    margin-top: 16px;
    font-size: 12px;
    color: #ef4444;
    text-align: center;
}

/* Global Status */
.global-status {
    padding: 16px;
    background-color: var(--vp-c-bg-alt);
    border-top: 1px solid var(--vp-c-divider);
    text-align: center;
}

.waiting-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--vp-c-brand);
    font-weight: 500;
}

.status-dot {
    position: relative;
    display: inline-flex;
    width: 12px;
    height: 12px;
}

.status-ping {
    position: absolute;
    display: inline-flex;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: var(--vp-c-brand);
    opacity: 0.75;
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {
    75%, 100% {
        transform: scale(2);
        opacity: 0;
    }
}

.status-core {
    position: relative;
    display: inline-flex;
    border-radius: 50%;
    width: 12px;
    height: 12px;
    background-color: var(--vp-c-brand);
}

.expired-status {
    color: #f97316;
}

/* Restart Link */
.restart-link-container {
    text-align: center;
    margin-top: 16px;
}

.restart-link {
    font-size: 0.75rem;
    color: var(--vp-c-brand);
    cursor: pointer;
    background: transparent;
    border: none;
    padding: 0;
    text-decoration: none;
}

.restart-link:hover {
    text-decoration: underline;
}

/* Protocol Terminal */
.protocol-terminal {
    max-width: 28rem;
    margin-left: auto;
    margin-right: auto;
    margin-top: 16px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--vp-c-divider);
    background-color: #1e1e1e;
    display: flex;
    flex-direction: column;
}

.terminal-header {
    background-color: #2d2d2d;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid #000;
}

.terminal-header .title {
    color: #888;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    margin-left: auto;
    margin-right: auto;
}

.dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 6px;
}

.dot.red { background-color: #ff5f56; }
.dot.yellow { background-color: #ffbd2e; }
.dot.green { background-color: #27c93f; }

.terminal-body {
    padding: 12px;
    max-height: 250px;
    overflow-y: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 11px;
    line-height: 1.4;
}

.log-entry {
    margin-bottom: 12px;
    white-space: pre-wrap;
    word-break: break-all;
}

.log-entry:last-child {
    margin-bottom: 0;
}

.req-text {
    color: #56b6c2;
}

.res-text {
    color: #98c379;
}

.info-text {
    color: #7f848e;
    font-style: italic;
}

.empty-log {
    color: #7f848e;
    font-style: italic;
}
</style>
