import WebSocket from 'ws';
import { updateSessionStatus } from '../routes/status';

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let subscribedAccount = '';
let wssUrl = '';

export function initNanoWebSocket(accountParam: string) {
    subscribedAccount = accountParam;
    connect();
}

function connect() {
    if (ws) {
        ws.close();
    }

    const wsUrl = process.env.NANO_WS_URL || 'wss://ws.nano.to';
    console.log(`Connecting to Nano WebSocket (${wsUrl})...`);
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('Nano WebSocket connected.');
        // Subscribe to new blocks for the server address
        const subscribeMsg = {
            action: 'subscribe',
            topic: 'confirmation'
        };
        ws?.send(JSON.stringify(subscribeMsg));
        console.log(`Subscribed to confirmations for: ${subscribedAccount}`);
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
                    console.log(`Incoming payment detected! Hash: ${blockHash}, Amount: ${amountRaw}`);

                    // Route the found block hash and raw amount to the active SSE Sessions
                    updateSessionStatus(amountRaw, blockHash, 'confirmed');
                }
            }
        } catch (e) {
            console.error('Error parsing WebSocket message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Nano WebSocket disconnected. Reconnecting in 5s...');
        scheduleReconnect();
    });

    ws.on('error', (err) => {
        console.error('Nano WebSocket error:', err);
        ws?.close();
    });
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        connect();
    }, 5000);
}
