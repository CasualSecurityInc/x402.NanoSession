import { Request, Response, Router } from 'express';
import { NanoSessionFacilitatorHandler, InMemorySpentSet } from '@nanosession/server';
import { NanoRpcClient } from '@nanosession/rpc';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { registerSession } from './status';

// Simple file-based session persistence for the demo
const SESSION_DB_PATH = path.resolve(__dirname, '../../.sessions.json');

function loadSessions(): Record<string, any> {
    try {
        if (fs.existsSync(SESSION_DB_PATH)) {
            return JSON.parse(fs.readFileSync(SESSION_DB_PATH, 'utf8'));
        }
    } catch (e) {
        console.warn('Failed to load sessions from disk:', e);
    }
    return {};
}

function saveSessions(sessions: Record<string, any>) {
    try {
        fs.writeFileSync(SESSION_DB_PATH, JSON.stringify(sessions, null, 2));
    } catch (e) {
        console.warn('Failed to save sessions to disk:', e);
    }
}

const persistentRegistry = {
    get: (id: string) => {
        const sessions = loadSessions();
        return sessions[id];
    },
    set: (id: string, reqs: any) => {
        const sessions = loadSessions();
        sessions[id] = reqs;
        saveSessions(sessions);
    },
    delete: (id: string) => {
        const sessions = loadSessions();
        delete sessions[id];
        saveSessions(sessions);
    },
    has: (id: string) => {
        const sessions = loadSessions();
        return !!sessions[id];
    }
};

// Lazy-initialize to ensure dotenv has loaded env vars before we read them
let _rpcClient: NanoRpcClient | null = null;
let _facilitator: NanoSessionFacilitatorHandler | null = null;
let _spentSet: InMemorySpentSet | null = null;

function getRpcClient(): NanoRpcClient {
    if (!_rpcClient) {
        if (!process.env.NANO_RPC_URL) {
            throw new Error('NANO_RPC_URL environment variable is not set');
        }
        _rpcClient = new NanoRpcClient({
            endpoints: [process.env.NANO_RPC_URL],
            timeoutMs: 15000
        });
    }
    return _rpcClient;
}

function getFacilitator(): NanoSessionFacilitatorHandler {
    if (!_facilitator) {
        _spentSet = new InMemorySpentSet();
        _facilitator = new NanoSessionFacilitatorHandler({
            rpcClient: getRpcClient(),
            spentSet: _spentSet,
            sessionRegistry: persistentRegistry
        });
    }
    return _facilitator;
}

/**
 * Determine the base URL for the resource based on request headers.
 * Precedence: X-Forwarded-Host > X-Proxy-Host > Host
 * Protocol: X-Forwarded-Proto > req.protocol
 */
function getResourceBaseUrl(req: Request): string {
    // Protocol: check X-Forwarded-Proto first (standard proxy header)
    const proto = req.header('X-Forwarded-Proto') || req.protocol;
    
    // Host: precedence for proxy scenarios
    const forwardedHost = req.header('X-Forwarded-Host');
    const proxyHost = req.header('X-Proxy-Host');
    const hostHeader = req.header('Host');
    
    // Use first available host in precedence order
    const host = forwardedHost || proxyHost || hostHeader || 'localhost:3001';
    
    return `${proto}://${host}`;
}

export const protectedRoute = Router();

protectedRoute.get('/', async (req: Request, res: Response) => {
    const paymentProof = req.header('X-Payment-Block');
    const incomingSessionId = req.header('X-Payment-Session');
    const facilitator = getFacilitator();

    // If the client provided a block hash, verify it
    if (paymentProof && incomingSessionId) {
        // Retrieve the stored requirements for this session (issued during the 402 response)
        const storedReqs = facilitator.getStoredRequirements(incomingSessionId);
        
        if (!storedReqs) {
            res.status(402).json({ error: "Session not found or expired. Please request a new payment." });
            return;
        }

        try {
            const result = await facilitator.handleVerify(storedReqs, { blockHash: paymentProof });

            if (result?.isValid) {
                const exclusiveContent = `
                    <div class="exclusive-content">
                        <h4>Top Secret Project Roadmap (Rev 5)</h4>
                        <ul>
                            <li><strong>Q3:</strong> Mainnet general availability and stable RPC load balancers.</li>
                            <li><strong>Q4:</strong> x402-native browser extensions for seamless dust tagging.</li>
                            <li><strong>Q1 Next Year:</strong> Native mobile wallet integration for one-tap auth.</li>
                        </ul>
                    </div>
                `;
                res.json({
                    success: true,
                    message: "Payment accepted! You have access to the protected demo content.",
                    html: exclusiveContent
                });
                return;
            } else {
                res.status(402).json({ error: result?.error || "Invalid payment proof" });
                return;
            }
        } catch (e) {
            res.status(500).json({ error: "Verification error on server" });
            return;
        }
    }

    // No proof provided, demand payment
    const amountToCharge = '10000000000000000000000000000'; // 0.01 XNO in Raw
    const payToAddress = process.env.NANO_SERVER_ADDRESS!;

    // Generate x402 requirements
    let reqs = facilitator.getRequirements({
        amount: amountToCharge,
        payTo: payToAddress,
        maxTimeoutSeconds: 600 // 10 minute timeout
    });

    if (process.env.NANO_RPC_URL?.includes('beta') || process.env.NANO_RPC_URL?.includes('testnet') || process.env.NANO_WS_URL?.includes('peering')) {
        reqs.network = 'nano:testnet';
    }

    // Use the sessionId generated by the facilitator
    const newSessionId = reqs.extra.sessionId;

    // The FacilitatorHandler has likely already added a random tag
    const taggedAmountRaw = (BigInt(reqs.amount) + BigInt(reqs.extra.tag)).toString();

    // Register the session in our SSE tracker so we can push real-time updates when the websocket 
    // sees a transaction arriving with this exact taggedAmountRaw
    registerSession(newSessionId, taggedAmountRaw);

    // Return the HTTP 402 with PaymentRequired schema
    res.status(402)
        .setHeader('X-Payment-Required', JSON.stringify(reqs))
        .json({
            x402Version: 5, // Custom rev 5 value for demo context
            error: 'Payment Required',
            resource: {
                url: `${getResourceBaseUrl(req)}/api/protected`,
                description: 'Access to protected demo content',
                mimeType: 'application/json'
            },
            accepts: [reqs]
        });
});
