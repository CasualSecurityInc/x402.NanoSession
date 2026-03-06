import { Request, Response, Router } from 'express';
import { NanoSessionFacilitatorHandler } from '@nanosession/facilitator';
import { NanoRpcClient } from '@nanosession/rpc';
import { registerSession } from './status';

// Lazy-initialize to ensure dotenv has loaded env vars before we read them
let _rpcClient: NanoRpcClient | null = null;
let _facilitator: NanoSessionFacilitatorHandler | null = null;

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
        _facilitator = new NanoSessionFacilitatorHandler({
            rpcClient: getRpcClient(),
            // Uses default InMemorySpentSet with TTL
            // Uses default in-memory session registry
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

/**
 * The exclusive content returned after successful payment.
 */
const EXCLUSIVE_CONTENT_HTML = `
    <div class="exclusive-content">
        <iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/TAT35tflCUM?si=TAzGQJ9jmgDuFgnw&amp;controls=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <p><em>This content was protected by a real Nano payment. No accounts, no sign-ups, no tracking. Just pay and access. If you were an agent, this and other x402 payments could be made frictionless by using <a href="https://github.com/CasualSecurityInc/x402.NanoSession/tree/main/packages" target="_blank" rel="noopener noreferrer">our client packages</a>.</em></p>
    </div>
`;

/**
 * Settle a payment proof and return the protected content on success.
 * Shared by both GET (with stored session) and POST (with client-supplied requirements).
 */
async function settleAndRespond(
    facilitator: NanoSessionFacilitatorHandler,
    requirements: any,
    blockHash: string,
    res: Response
) {
    const sessionId = requirements.extra?.sessionId || 'unknown';
    const tag = requirements.extra?.tag || 'unknown';

    try {
        const result = await facilitator.handleSettle(requirements, { blockHash });

        if (result?.success) {
            console.log(`[AUDIT] Tag spent: tag=${tag} session=${String(sessionId).slice(0, 8)}... block=${blockHash.slice(0, 8)}...`);
            res.json({
                success: true,
                message: "Payment accepted! You have access to the protected demo content.",
                html: EXCLUSIVE_CONTENT_HTML
            });
            console.log(`[AUDIT] Protected content served: tag=${tag} session=${String(sessionId).slice(0, 8)}... block=${blockHash.slice(0, 8)}...`);
        } else {
            console.warn(`[AUDIT] Payment rejected: tag=${tag} session=${String(sessionId).slice(0, 8)}... block=${blockHash.slice(0, 8)}... error=${result?.error}`);
            res.status(402).json({ error: result?.error || "Invalid payment proof" });
        }
    } catch (e) {
        console.error(`[AUDIT] Settlement error: tag=${tag} session=${String(sessionId).slice(0, 8)}... block=${blockHash.slice(0, 8)}...`, e);
        res.status(500).json({ error: "Verification error on server" });
    }
}

/**
 * GET /api/protected
 * - Without proof headers: returns 402 with payment requirements
 * - With X-Payment-Block + X-Payment-Session: verifies stored session
 */
protectedRoute.get('/', async (req: Request, res: Response) => {
    const t0 = Date.now();
    const paymentProof = req.header('X-Payment-Block');
    const incomingSessionId = req.header('X-Payment-Session');
    const facilitator = getFacilitator();

    // If the client provided a block hash, verify it
    if (paymentProof && incomingSessionId) {
        console.log(`[API] GET /api/protected with proof block=${paymentProof.slice(0, 8)}... session=${incomingSessionId.slice(0, 8)}...`);
        const storedReqs = facilitator.getStoredRequirements(incomingSessionId);

        if (!storedReqs) {
            // Session was lost (server restart, expiry, etc.)
            // Return a specific status so the client knows to retry with POST
            console.warn(`[protected] Session not found: ${incomingSessionId} (in-memory registry lost, likely server restart) [${Date.now() - t0}ms]`);
            res.status(410).json({
                error: "Payment session expired from server memory. Retrying verification...",
                code: 'SESSION_LOST'
            });
            return;
        }

        await settleAndRespond(facilitator, storedReqs, paymentProof, res);
        console.log(`[API] GET /api/protected settle completed [${Date.now() - t0}ms]`);
        return;
    }

    // No proof provided, demand payment
    const amountToCharge = '10000000000000000000000000000'; // 0.01 XNO in Raw
    const payToAddress = process.env.NANO_SERVER_ADDRESS!;

    // Generate x402 requirements (automatically registers session in-memory)
    const reqs = facilitator.getRequirements({
        amount: amountToCharge,
        payTo: payToAddress,
        maxTimeoutSeconds: 180, // 3 minute timeout
        tagModulus: 10000,      // Limits tags to 0-9999 to fit into 0.019999 headroom
        tagMultiplier: process.env.NANO_TAG_MULTIPLIER
    });

    if (process.env.NANO_RPC_URL?.includes('beta') || process.env.NANO_RPC_URL?.includes('testnet') || process.env.NANO_WS_URL?.includes('peering')) {
        reqs.network = 'nano:testnet';
    }

    // Use the sessionId generated by the facilitator
    const newSessionId = reqs.extra.sessionId;

    // The FacilitatorHandler has likely already added a random tag
    const tagMultiplier = BigInt(reqs.extra.tagMultiplier || '1');
    const taggedAmountRaw = (BigInt(reqs.amount) + BigInt(reqs.extra.tag) * tagMultiplier).toString();

    // Register the session in our SSE tracker so we can push real-time updates
    registerSession(newSessionId, taggedAmountRaw);

    // Return the HTTP 402 with PaymentRequired schema
    res.status(402)
        .setHeader('X-Payment-Required', JSON.stringify(reqs))
        .json({
            x402Version: 5,
            error: 'Payment Required',
            resource: {
                url: `${getResourceBaseUrl(req)}/api/protected`,
                description: 'Access to protected demo content',
                mimeType: 'application/json'
            },
            accepts: [reqs]
        });
});

/**
 * POST /api/protected
 * Fallback verification: the client sends back the original 402 requirements
 * in the body along with the block hash. Used when the GET verification fails
 * because the server lost its in-memory session (e.g. after restart).
 *
 * SECURITY: This is safe because handleSettle independently verifies:
 *   - Block exists and is confirmed on the Nano network (RPC check)
 *   - Destination address matches requirements.payTo
 *   - Amount matches requirements.amount + tag
 *   - Block hasn't been spent before (spent set)
 * The client cannot forge a valid block hash.
 */
protectedRoute.post('/', async (req: Request, res: Response) => {
    const t0 = Date.now();
    const { blockHash, requirements } = req.body;
    console.log(`[API] POST /api/protected block=${blockHash?.slice(0, 8)}...`);

    if (!blockHash || !requirements) {
        res.status(400).json({ error: "Missing blockHash or requirements in request body" });
        return;
    }

    // Validate that payTo matches our server address (prevent redirecting payments)
    if (requirements.payTo !== process.env.NANO_SERVER_ADDRESS) {
        console.warn(`[protected] POST verify: payTo mismatch. Expected ${process.env.NANO_SERVER_ADDRESS}, got ${requirements.payTo}`);
        res.status(400).json({ error: "Invalid payment destination" });
        return;
    }

    const facilitator = getFacilitator();

    // Re-register the session so handleVerify's sessionRegistry.has() check passes
    const sessionId = requirements.extra?.sessionId;
    if (sessionId) {
        console.info(`[protected] Re-registering lost session ${sessionId} from client-supplied requirements`);
        facilitator.registerSessionFromRequirements(sessionId, requirements);
    }

    await settleAndRespond(facilitator, requirements, blockHash, res);
    console.log(`[API] POST /api/protected settle completed [${Date.now() - t0}ms]`);
});
