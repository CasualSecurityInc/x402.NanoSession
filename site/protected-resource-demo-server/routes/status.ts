import { Request, Response, Router } from 'express';

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
    sessionStates[sessionId] = { status: 'pending', registeredAt: Date.now() };
    amountToSessionMap[expectedAmountRaw] = sessionId;
    console.log(`[AUDIT] Session created: session=${sessionId.slice(0, 8)}... amount=${expectedAmountRaw}`);

    // Auto-expire abandoned sessions after 10 minutes (not 2 min - mobile users
    // may be in wallet app for several minutes. WS/RPC poller still watches for payments)
    setTimeout(() => {
        const state = sessionStates[sessionId];
        if (state?.status === 'pending' && !activeClients.has(sessionId)) {
            console.log(`[AUDIT] Session expired (no SSE client for 10 min): session=${sessionId.slice(0, 8)}...`);
            delete sessionStates[sessionId];
            delete amountToSessionMap[expectedAmountRaw];
        }
    }, 1000 * 60 * 10); // 10 minutes
}

/**
 * Called by the WebSocket service when a payment arrives
 */
export function updateSessionStatus(amountRaw: string, blockHash: string, status: 'confirmed' | 'failed') {
    const sessionId = amountToSessionMap[amountRaw];
    if (!sessionId) return; // Not our payment

    // Guard against duplicate pushes (WebSocket reconnection can replay recent confirmations)
    const existing = sessionStates[sessionId];
    if (existing?.status === 'confirmed') return;

    const state = { status, blockHash, amountRaw };
    sessionStates[sessionId] = state;
    console.log(`[AUDIT] Payment detected: session=${sessionId.slice(0, 8)}... block=${blockHash.slice(0, 8)}... amount=${amountRaw} status=${status}`);

    // Notify the connected client if they are currently listening
    const clientResponse = activeClients.get(sessionId);
    if (clientResponse) {
        clientResponse.write(`data: ${JSON.stringify(state)}\n\n`);
    } else {
        console.warn(`[AUDIT] Payment detected but NO SSE client listening: session=${sessionId.slice(0, 8)}...`);
    }

    // Cleanup map after a while to prevent memory leaks
    setTimeout(() => {
        delete sessionStates[sessionId];
        delete amountToSessionMap[amountRaw];
    }, 1000 * 60 * 10); // 10 minutes
}

/**
 * Check if there are any sessions actively waiting for payment
 * Only counts sessions with a connected SSE client (not abandoned ones)
 */
export function hasActiveSessions(): boolean {
    for (const [sessionId, state] of Object.entries(sessionStates)) {
        if ((state as any).status === 'pending' && activeClients.has(sessionId)) {
            return true;
        }
    }
    return false;
}

/**
 * Count of active SSE clients currently connected.
 */
export function getActiveSseClientCount(): number {
    return activeClients.size;
}

/**
 * Get the amount-to-session mapping for RPC polling fallback
 */
export function getAmountToSessionMap(): Record<string, string> {
    return amountToSessionMap;
}

statusRoute.get('/:sessionId', (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;

    // If client wants JSON (polling fallback), return current state directly
    if (req.accepts('json') && !req.accepts('text/event-stream')) {
        const currentState = sessionStates[sessionId] || { status: 'unknown' };
        res.json(currentState);
        return;
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add to active clients
    activeClients.set(sessionId, res);
    console.log(`[SSE] Client connected: session=${sessionId.slice(0, 8)}... (${activeClients.size} active)`);

    // Send current buffered state immediately on connect
    const currentState = sessionStates[sessionId] || { status: 'pending' };
    res.write(`data: ${JSON.stringify(currentState)}\n\n`);

    // Send heartbeat every 15 seconds to keep connection alive
    // (Fly.io proxy kills idle connections; 30s was too slow — SSE died before first heartbeat)
    const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(heartbeatInterval);
        activeClients.delete(sessionId);
        // Only log — do NOT delete sessionStates or amountToSessionMap here.
        // The session may still receive a payment via WS/RPC-POLL while the SSE
        // client is temporarily disconnected. If the client reconnects, they'll
        // get the buffered state. Actual cleanup happens via the existing timers
        // (2-min abandoned session expiry, 10-min post-confirmation expiry).
        const state = sessionStates[sessionId];
        if (state?.status === 'pending') {
            console.log(`[AUDIT] SSE client disconnected (session still pending): session=${sessionId.slice(0, 8)}...`);
        }
    });
});
