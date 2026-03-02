import { Request, Response, Router } from 'express';
import { NanoSessionFacilitatorHandler, InMemorySpentSet } from '@nanosession/server';
import crypto from 'crypto';
import { registerSession } from './status';

export const protectedRoute = Router();

// Create a single instance of the facilitator handler with an in-memory spent set for the demo
const spentSet = new InMemorySpentSet();
const facilitator = new NanoSessionFacilitatorHandler({
    spentSet,
    tagModulus: 10000000 // 10 million raw tag range
});

protectedRoute.get('/', async (req: Request, res: Response) => {
    const paymentProof = req.header('X-Payment-Block');
    const sessionId = req.header('X-Payment-Session');

    // If the client provided a block hash, verify it
    if (paymentProof && sessionId) {
        // Generate requirements just to satisfy the API interface (amount isn't needed for verify in Nano)
        // In a real app we'd retrieve the session requirements here
        const mockReqs = facilitator.getRequirements({
            amount: '10000000000000000000000000000', // 0.01 XNO
            payTo: process.env.NANO_SERVER_ADDRESS!
        });

        // Add sessionId manually for the verify step (as per x402 rev4/5)
        mockReqs.extra.sessionId = sessionId;

        try {
            const result = await facilitator.handleVerify(mockReqs, { blockHash: paymentProof });

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

    // Specifically generate matching Rev5 fields 
    const newSessionId = crypto.randomUUID();
    reqs.extra.sessionId = newSessionId;

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
                url: 'http://localhost:3001/api/protected',
                description: 'Access to protected demo content',
                mimeType: 'application/json'
            },
            accepts: [reqs]
        });
});
