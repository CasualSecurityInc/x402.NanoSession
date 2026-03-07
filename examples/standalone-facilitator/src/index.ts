import express, { Request, Response } from 'express';
import cors from 'cors';
import { NanoSessionFacilitatorHandler } from '@nanosession/facilitator';
import { NanoRpcClient } from '@nanosession/rpc';
import type { PaymentRequirements, PaymentPayload } from '@nanosession/core';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Initialize Nano RPC Client
const rpcClient = new NanoRpcClient({
    endpoints: ['https://rpc.nano.to', 'https://nano.yt/api'] // Default mainnet endpoints
});

// Initialize the Facilitator Handler
// In a real production app, you would inject a Redis or Postgres SpentSet backend here
const handler = new NanoSessionFacilitatorHandler({
    rpcClient
});

/**
 * Standard x402 POST /verify endpoint
 * Verifies a payment payload against the requirements without settling.
 */
app.post('/verify', async (req: Request, res: Response): Promise<void> => {
    try {
        const requirements = req.body.paymentDetails as PaymentRequirements;
        const payload = req.body.paymentPayload as PaymentPayload;

        if (!requirements || !payload) {
            res.status(400).json({ error: 'Missing paymentDetails or paymentPayload' });
            return;
        }

        const result = await handler.handleVerify(requirements, payload);
        if (!result) {
            res.status(400).json({ error: 'Unsupported payment scheme or network' });
            return;
        }

        if (result.isValid) {
            res.status(200).json({ valid: true });
        } else {
            res.status(400).json({ valid: false, error: result.error });
        }
    } catch (error) {
        console.error('Error during verification:', error);
        res.status(500).json({ valid: false, error: 'Internal server error' });
    }
});

/**
 * Standard x402 POST /settle endpoint
 * Verifies and executes the settlement (preventing double spends).
 */
app.post('/settle', async (req: Request, res: Response): Promise<void> => {
    try {
        const requirements = req.body.paymentDetails as PaymentRequirements;
        const payload = req.body.paymentPayload as PaymentPayload;

        if (!requirements || !payload) {
            res.status(400).json({ error: 'Missing paymentDetails or paymentPayload' });
            return;
        }

        const result = await handler.handleSettle(requirements, payload);
        if (!result) {
            res.status(400).json({ error: 'Unsupported payment scheme or network' });
            return;
        }

        if (result.success) {
            res.status(200).json({
                success: true,
                transactionHash: result.transactionHash
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error during settlement:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Helper endpoint to generate requirements
 * (Not strictly part of the standard x402 facilitator spec, but useful for clients 
 * interacting directly with this standalone server).
 */
app.post('/requirements', (req: Request, res: Response) => {
    const { resourceAmountRaw, amount, payTo, maxTimeoutSeconds } = req.body;
    const resolvedResourceAmountRaw = resourceAmountRaw ?? amount;
    if (!resolvedResourceAmountRaw || !payTo) {
        return res.status(400).json({ error: 'Missing resourceAmountRaw (or amount) or payTo' });
    }

    const requirements = handler.getRequirements({
        resourceAmountRaw: resolvedResourceAmountRaw,
        payTo,
        maxTimeoutSeconds: maxTimeoutSeconds || 600
    });

    res.status(200).json(requirements);
});

app.listen(PORT, () => {
    console.log(`Standalone x402 Facilitator Server running on port ${PORT}`);
});
