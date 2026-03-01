import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from 'dotenv';
import path from 'path';

// Load env from DOTENV_CONFIG_PATH (used by npm scripts) or fallback to root .env.mainnet
const envPath = process.env.DOTENV_CONFIG_PATH
    ? path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH)
    : path.resolve(__dirname, '../../.env.mainnet');
config({ path: envPath });
import { protectedRoute } from './routes/protected';
import { statusRoute } from './routes/status';
import { initNanoWebSocket } from './services/nano-websocket';

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
app.use(cors({ exposedHeaders: ['X-Payment-Required'] }));
app.use(express.json());

const server = createServer(app);

// Setup routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Attach our specific X402 routes
app.use('/api/protected', protectedRoute);
app.use('/api/status', statusRoute);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Demo X402 Facilitator Server running on port ${PORT}`);
    console.log(`Watching for payments on address: ${NANO_SERVER_ADDRESS}`);

    // Initialize WebSocket connection to Nano network
    initNanoWebSocket(NANO_SERVER_ADDRESS);
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
