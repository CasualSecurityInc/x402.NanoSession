import WebSocket from 'ws';
import { updateSessionStatus } from '../routes/status';

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let pongTimeout: NodeJS.Timeout | null = null;
let subscribedAccount = '';
let reconnectDelay = 1000; // Start at 1s, exponential backoff
const MAX_RECONNECT_DELAY = 30_000; // Cap at 30s

const PING_INTERVAL_MS = 30_000;  // Send ping every 30s
const PONG_TIMEOUT_MS = 10_000;   // Expect pong within 10s

// Profiling: message rate counter
let wsMsgCount = 0;
let wsConfirmCount = 0;
setInterval(() => {
    if (wsMsgCount > 0) {
        console.log(`[WS][PERF] Messages in last 10s: ${wsMsgCount} (${wsConfirmCount} confirmations)`);
        wsMsgCount = 0;
        wsConfirmCount = 0;
    }
}, 10000);

export function initNanoWebSocket(accountParam: string) {
    subscribedAccount = accountParam;
    connect();
}

function cleanupTimers() {
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function connect() {
    cleanupTimers();

    if (ws) {
        try { ws.removeAllListeners(); ws.close(); } catch { }
        ws = null;
    }

    const wsUrl = process.env.NANO_WS_URL || 'wss://ws.nano.to';
    console.log(`[WS] Connecting to Nano WebSocket (${wsUrl})...`);
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('[WS] Connected.');
        reconnectDelay = 1000; // Reset backoff on successful connect
        const subscribeMsg = {
            action: 'subscribe',
            topic: 'confirmation',
            options: {
                accounts: [subscribedAccount]
            }
        };
        ws?.send(JSON.stringify(subscribeMsg));
        console.log(`[WS] Subscribed to confirmations for: ${subscribedAccount}`);

        // Start ping/pong keepalive
        startPingPong();
    });

    ws.on('message', (data) => {
        wsMsgCount++;
        try {
            const t0 = Date.now();
            const message = JSON.parse(data.toString());

            if (message.topic === 'confirmation' && message.message) {
                wsConfirmCount++;
                const block = message.message.block;
                const amountRaw = message.message.amount;
                const blockHash = message.message.hash;

                const subtype = message.message.block?.subtype || block.subtype;

                // Only process SEND blocks destined for our account.
                // In Nano's block lattice:
                //   - A sender's "send" block has link_as_account = our address (this is the payment)
                //   - Our "receive" block pockets those funds (we must IGNORE this)
                // The WS subscription delivers both since we filter by account.
                if (subtype === 'send' && block.link_as_account === subscribedAccount) {
                    console.log(`[WS] Incoming payment detected! Hash: ${blockHash}, Amount: ${amountRaw} (parse+match: ${Date.now() - t0}ms)`);

                    // Route the found block hash and raw amount to the active SSE Sessions
                    updateSessionStatus(amountRaw, blockHash, 'confirmed');
                } else if (block.link_as_account === subscribedAccount || block.account === subscribedAccount) {
                    // Log non-send blocks at debug level (receive/change on our account)
                    console.log(`[WS] Ignoring ${subtype || 'unknown'} block on our account: ${blockHash}`);
                }
            }
        } catch (e) {
            console.error('[WS] Error parsing message:', e);
        }
    });

    ws.on('pong', () => {
        // Pong received — connection is alive, cancel the timeout
        if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
    });

    ws.on('close', () => {
        console.log(`[WS] Disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);
        cleanupTimers();
        scheduleReconnect();
    });

    ws.on('error', (err) => {
        console.error('[WS] Error:', err.message);
        cleanupTimers();
        try { ws?.close(); } catch { }
    });
}

function startPingPong() {
    pingInterval = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        ws.ping();

        // If no pong received within PONG_TIMEOUT_MS, consider connection dead
        pongTimeout = setTimeout(() => {
            console.warn('[WS] Pong timeout — connection stale. Reconnecting...');
            try { ws?.terminate(); } catch { }
            connect();
        }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        connect();
    }, reconnectDelay);
    // Exponential backoff, capped
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

