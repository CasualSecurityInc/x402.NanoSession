import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';

export const statusRoute = Router();

// In-memory state storage (no longer persistent to avoid ghost confirms after server restart)
let sessionStates: Record<string, any> = {};
let amountToSessionMap: Record<string, string> = {};

// Store active connections (in-memory only)
// Key: sessionId, Value: Response object
const activeClients = new Map<string, Response>();

/**
 * Register a new session to be tracked
 */
export function registerSession(sessionId: string, expectedAmountRaw: string) {
    sessionStates[sessionId] = { status: 'pending' };
    amountToSessionMap[expectedAmountRaw] = sessionId;
}

/**
 * Called by the WebSocket service when a payment arrives
 */
export function updateSessionStatus(amountRaw: string, blockHash: string, status: 'confirmed' | 'failed') {
    const sessionId = amountToSessionMap[amountRaw];
    if (!sessionId) return; // Not our payment

    const state = { status, blockHash, amountRaw };
    sessionStates[sessionId] = state;

    // Notify the connected client if they are currently listening
    const clientResponse = activeClients.get(sessionId);
    if (clientResponse) {
        clientResponse.write(`data: ${JSON.stringify(state)}\n\n`);
    }

    // Cleanup map after a while to prevent memory leaks
    setTimeout(() => {
        delete sessionStates[sessionId];
        delete amountToSessionMap[amountRaw];
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
