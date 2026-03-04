import WebSocket from 'ws';
import { updateSessionStatus } from '../routes/status';

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let pongTimeout: NodeJS.Timeout | null = null;
let subscribedAccount = '';

const PING_INTERVAL_MS = 30_000;  // Send ping every 30s
const PONG_TIMEOUT_MS = 10_000;   // Expect pong within 10s

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
        // Subscribe to new blocks for the server address
        const subscribeMsg = {
            action: 'subscribe',
            topic: 'confirmation'
        };
        ws?.send(JSON.stringify(subscribeMsg));
        console.log(`[WS] Subscribed to confirmations for: ${subscribedAccount}`);

        // Start ping/pong keepalive
        startPingPong();
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            if (message.topic === 'confirmation' && message.message) {
                const block = message.message.block;
                const amountRaw = message.message.amount;
                const blockHash = message.message.hash;

                // For a 'send' block, the destination is link_as_account
                // For a 'receive' block, the destination is the block account itself
                // In NanoSession Rev5, what we actually see on the network first is the sender's SEND block
                if (block.link_as_account === subscribedAccount || block.account === subscribedAccount) {
                    console.log(`[WS] Incoming payment detected! Hash: ${blockHash}, Amount: ${amountRaw}`);

                    // Route the found block hash and raw amount to the active SSE Sessions
                    updateSessionStatus(amountRaw, blockHash, 'confirmed');
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
        console.log('[WS] Disconnected. Reconnecting in 5s...');
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
    }, 5000);
}

