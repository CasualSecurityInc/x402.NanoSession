import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from 'dotenv';
import path from 'path';

// Load env from DOTENV_CONFIG_PATH (used by npm scripts) or fallback to root .env
const envPath = process.env.DOTENV_CONFIG_PATH
    ? path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH)
    : path.resolve(__dirname, '../../.env');
config({ path: envPath });
import { protectedRoute } from './routes/protected';
import { statusRoute } from './routes/status';
import { initNanoWebSocket } from './services/nano-websocket';
import { startRpcPoller } from './services/rpc-poller';
import { NanoRpcClient } from '@nanosession/rpc';

// Load environment variables strictly
const NANO_RPC_URL = process.env.NANO_RPC_URL;
const NANO_SERVER_ADDRESS = process.env.NANO_SERVER_ADDRESS;

if (!NANO_RPC_URL) {
    console.error('FATAL: NANO_RPC_URL environment variable is required.');
    process.exit(1);
}

if (!NANO_SERVER_ADDRESS) {
    console.error('FATAL: NANO_SERVER_ADDRESS environment variable is required.');
    process.exit(1);
}

const app = express();
app.use(cors({ exposedHeaders: ['PAYMENT-REQUIRED'] }));
app.use(express.json());

const server = createServer(app);

// Setup routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Attach our specific X402 routes
app.use('/api/protected', protectedRoute);
app.use('/api/status', statusRoute);

// Parse binding PORT from the Unified Server URL (12-factor standard)
const serverUrlCandidate = process.env.VITE_TEST_AND_DEMO_SERVER_URL || 'http://localhost:3001';
let PORT: number = 3001;
let HOST: string = 'localhost';

try {
    const parsedUrl = new URL(serverUrlCandidate);
    PORT = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80);
    HOST = parsedUrl.hostname || 'localhost';
} catch (e) {
    console.warn(`WARNING: Failed to parse VITE_TEST_AND_DEMO_SERVER_URL ('${serverUrlCandidate}'). Defaulting to port 3001 on 0.0.0.0.`);
    HOST = '0.0.0.0';
}

server.listen(PORT, HOST, () => {
    console.log(`Demo X402 Facilitator Server running on ${HOST}:${PORT}`);
    console.log(`Watching for payments on address: ${NANO_SERVER_ADDRESS}`);

    // Initialize WebSocket connection to Nano network
    initNanoWebSocket(NANO_SERVER_ADDRESS);

    // Initialize RPC polling fallback (catches payments missed by WebSocket)
    const rpcClient = new NanoRpcClient({
        endpoints: [NANO_RPC_URL],
        timeoutMs: 10000
    });
    startRpcPoller(rpcClient, NANO_SERVER_ADDRESS);

    // Event loop lag monitor — detect if something is blocking the event loop
    setInterval(() => {
        const start = Date.now();
        setImmediate(() => {
            const lag = Date.now() - start;
            if (lag > 50) console.warn(`[PERF] Event loop lag: ${lag}ms`);
        });
    }, 2000);
});

// Setup graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down Gracefully...');
    server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
    console.log('Shutting down Gracefully...');
    server.close(() => process.exit(0));
});
