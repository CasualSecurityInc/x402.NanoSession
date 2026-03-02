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
  <div class="nano-paywall pt-4 pb-8">
    
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
    <div v-if="paymentStatus === 'confirmed'" class="protected-content-revealed bg-green-50/10 p-6 rounded-xl border border-green-500/30 mb-6">
        <div class="success-banner mb-6 text-green-600 dark:text-green-400 font-semibold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <h2>🎉 Payment successful!</h2>
        </div>
        <div data-testid="protected-content">
           <slot></slot>
           
           <div v-if="serverProvidedContent" v-html="serverProvidedContent" class="server-html-injection mt-4 bg-white dark:bg-[#1e1e20] p-4 rounded-lg border border-[var(--vp-c-divider)] shadow-inner"></div>
        </div>
        
        <div class="mt-6 text-xs text-gray-500 opacity-70">
           Block: <a :href="`https://nanexplorer.com/block/${finalBlockHash}`" target="_blank" rel="noopener noreferrer" class="hover:underline text-[var(--vp-c-brand)]">{{ finalBlockHash }}</a>
        </div>
    </div>

    <!-- MAIN PAYWALL CONTAINER -->
    <div v-else class="paywall-container max-w-md mx-auto border border-[var(--vp-c-divider)] rounded-xl overflow-hidden shadow-lg bg-[var(--vp-c-bg-soft)]" data-testid="payment-required">
        
        <!-- Header -->
        <div class="bg-[var(--vp-c-bg-alt)] border-b border-[var(--vp-c-divider)] px-6 py-4 text-center">
            <h3 class="m-0 text-xl font-bold">Payment Required</h3>
            <p class="text-sm text-[var(--vp-c-text-2)] mt-1">Access to protected content.</p>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="p-12 text-center">
            <div class="inline-block animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <p>Generating session...</p>
        </div>

        <!-- Fetch Error State -->
        <div v-else-if="fetchError" class="p-8 text-center text-red-500">
            <p>{{ fetchError }}</p>
            <button @click="fetchPaymentRequirements" class="mt-4 px-4 py-2 bg-[var(--vp-c-brand)] text-white rounded hover:bg-[var(--vp-c-brand-dark)] transition-colors">
                Retry
            </button>
        </div>
        
        <!-- Expired State -->
        <div v-else-if="paymentStatus === 'expired'" class="p-8 text-center text-orange-500">
            <p>Session Expired. Please refresh to start a new payment session.</p>
        </div>

        <!-- Active Payment State -->
        <div v-else-if="session" class="payment-active">
            
            <!-- COMMON INFO (always visible) -->
            <div class="common-info p-6 border-b border-[var(--vp-c-divider)]">
                <p class="text-center text-sm mb-4">
                   Please pay exactly <strong data-testid="payment-amount-raw" :data-raw="session.amountRaw">{{ formatRawAmount(session.amountRaw) }} XNO</strong> to:
                </p>

                <div class="address-pane w-full bg-[var(--vp-c-bg-alt)] text-xs font-mono p-3 rounded text-center break-all text-[var(--vp-c-text-2)] mb-4 select-all" data-testid="payment-address">
                    {{ session.payTo }}
                </div>

                <!-- Session Timer -->
                <div class="text-center text-xs text-[var(--vp-c-text-3)]">
                    Session expires in: <span class="font-mono">{{ Math.floor(countdown / 60) }}:{{ (countdown % 60).toString().padStart(2, '0') }}</span>
                </div>
            </div>

            <!-- PAYMENT METHOD TABS -->
            <div class="payment-tabs">
                <div class="tab-headers flex border-b border-[var(--vp-c-divider)]">
                    <button 
                        @click="activePaymentTab = 'qr'"
                        :class="['tab-btn flex-1 py-3 text-sm font-medium transition-colors', activePaymentTab === 'qr' ? 'active-tab' : 'text-[var(--vp-c-text-2)] hover:text-[var(--vp-c-text-1)]']"
                    >
                        📱 QR Code
                    </button>
                    <button 
                        v-if="isMetaMaskInstalled"
                        @click="activePaymentTab = 'metamask'"
                        :class="['tab-btn flex-1 py-3 text-sm font-medium transition-colors', activePaymentTab === 'metamask' ? 'active-tab' : 'text-[var(--vp-c-text-2)] hover:text-[var(--vp-c-text-1)]']"
                    >
                        🦊 MetaMask
                    </button>
                </div>

                <!-- QR Code Tab -->
                <div v-if="activePaymentTab === 'qr'" class="tab-content p-6">
                    <div class="flex flex-col items-center">
                        <div class="qr-wrapper bg-white p-2 rounded-lg shadow-sm mb-4">
                            <img v-if="qrcodeDataUrl" :src="qrcodeDataUrl" alt="Nano Payment QR Code" class="w-48 h-48 block" />
                        </div>
                        <p class="text-xs text-[var(--vp-c-text-2)] text-center">
                            Scan with Natrium, Nault, or any Nano wallet
                        </p>
                    </div>
                </div>

                <!-- MetaMask Tab -->
                <div v-if="activePaymentTab === 'metamask'" class="tab-content p-6">
                    <div class="flex flex-col items-center text-center">
                        <div v-if="!xnapPending" class="metamask-idle">
                            <button 
                                @click="handleXnapClick" 
                                class="xnap-btn"
                            >
                                <span v-if="!isXnapInstalled">Install Xnap Snap</span>
                                <span v-else>Pay with MetaMask</span>
                            </button>
                            <p class="text-xs text-[var(--vp-c-text-2)] mt-4 max-w-xs">
                                Xnap is a MetaMask Snap that enables Nano payments directly in your browser wallet.
                            </p>
                        </div>
                        
                        <div v-else class="metamask-pending">
                            <div class="inline-block animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                            <p class="text-sm font-medium text-[var(--vp-c-brand)]">Transaction in progress...</p>
                            <p class="text-xs text-[var(--vp-c-text-2)] mt-2 max-w-xs">
                                MetaMask snap is calculating Proof-of-Work.<br>
                                This may take 10-30 seconds.
                            </p>
                        </div>
                        
                        <div v-if="xnapError" class="xnap-error mt-4">{{ xnapError }}</div>
                    </div>
                </div>
            </div>

            <!-- GLOBAL STATUS (always visible) -->
            <div class="global-status p-4 bg-[var(--vp-c-bg-alt)] border-t border-[var(--vp-c-divider)] text-center">
                <div v-if="paymentStatus === 'pending'" class="flex items-center justify-center gap-2 text-[var(--vp-c-brand)] font-medium" data-testid="payment-status" data-status="pending">
                    <span class="relative flex h-3 w-3">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--vp-c-brand)] opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-3 w-3 bg-[var(--vp-c-brand)]"></span>
                    </span>
                    Waiting for payment...
                </div>
                <div v-else-if="paymentStatus === 'expired'" class="text-orange-500">
                    Session expired
                </div>
            </div>
        </div>
    </div>

    <!-- GLOBAL RESTART LINK (always visible) -->
    <div class="text-center mt-4 text-xs">
        <button @click="fetchPaymentRequirements" class="hover:underline text-[var(--vp-c-brand)] cursor-pointer bg-transparent border-none p-0">↻ Restart demo</button>
    </div>

    <!-- GLOBAL PROTOCOL CONSOLE (always visible) -->
    <div class="protocol-terminal max-w-md mx-auto mt-4 rounded-xl overflow-hidden border border-[var(--vp-c-divider)]">
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
            <div v-if="httpLog.length === 0" class="info-text italic">Waiting for first request...</div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.protocol-terminal {
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

/* Invisible Anchors for smooth hash routing */
.network-anchor {
  position: relative;
  top: -80px;
  visibility: hidden;
  height: 0;
}

/* UI Tabs Styling */
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

/* Payment Method Tabs */
.tab-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
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

/* Xnap Button Styling */
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

.xnap-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.5);
}

.xnap-error {
  font-size: 12px;
  color: #ef4444;
  text-align: center;
}

/* Success content */
.protected-content-revealed {
    max-width: 28rem;
    margin-left: auto;
    margin-right: auto;
}
</style>
