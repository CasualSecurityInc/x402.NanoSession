import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';

export const statusRoute = Router();

// Simple file-based persistence for SSE state
const SSE_DB_PATH = path.resolve(__dirname, '../../.sse_state.json');

function loadState(): { sessionStates: Record<string, any>, amountToSessionMap: Record<string, string> } {
    try {
        if (fs.existsSync(SSE_DB_PATH)) {
            return JSON.parse(fs.readFileSync(SSE_DB_PATH, 'utf8'));
        }
    } catch (e) {
        console.warn('Failed to load SSE state from disk:', e);
    }
    return { sessionStates: {}, amountToSessionMap: {} };
}

function saveState(sessionStates: Record<string, any>, amountToSessionMap: Record<string, string>) {
    try {
        fs.writeFileSync(SSE_DB_PATH, JSON.stringify({ sessionStates, amountToSessionMap }, null, 2));
    } catch (e) {
        console.warn('Failed to save SSE state to disk:', e);
    }
}

// Store active connections (in-memory only, cannot be persisted)
// Key: sessionId, Value: Response object
const activeClients = new Map<string, Response>();

/**
 * Register a new session to be tracked
 */
export function registerSession(sessionId: string, expectedAmountRaw: string) {
    const { sessionStates, amountToSessionMap } = loadState();
    sessionStates[sessionId] = { status: 'pending' };
    amountToSessionMap[expectedAmountRaw] = sessionId;
    saveState(sessionStates, amountToSessionMap);
}

/**
 * Called by the WebSocket service when a payment arrives
 */
export function updateSessionStatus(amountRaw: string, blockHash: string, status: 'confirmed' | 'failed') {
    const { sessionStates, amountToSessionMap } = loadState();
    const sessionId = amountToSessionMap[amountRaw];
    if (!sessionId) return; // Not our payment

    const state = { status, blockHash, amountRaw };
    sessionStates[sessionId] = state;
    saveState(sessionStates, amountToSessionMap);

    // Notify the connected client if they are currently listening
    const clientResponse = activeClients.get(sessionId);
    if (clientResponse) {
        clientResponse.write(`data: ${JSON.stringify(state)}\n\n`);
    }

    // Cleanup map after a while to prevent memory leaks
    setTimeout(() => {
        const { sessionStates: currentStates, amountToSessionMap: currentMap } = loadState();
        delete currentStates[sessionId];
        delete currentMap[amountRaw];
        saveState(currentStates, currentMap);
    }, 1000 * 60 * 10); // 10 minutes
}

statusRoute.get('/:sessionId', (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add to active clients
    activeClients.set(sessionId, res);

    // Send current buffered state immediately on connect
    const { sessionStates } = loadState();
    const currentState = sessionStates[sessionId] || { status: 'pending' };
    res.write(`data: ${JSON.stringify(currentState)}\n\n`);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(heartbeatInterval);
        activeClients.delete(sessionId);
    });
});
