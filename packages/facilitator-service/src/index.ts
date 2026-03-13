/**
 * Reference Nano x402 Facilitator Service
 * Standardized standalone service for verifying and settling Nano payments.
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { NanoRpcClient } from '@nanosession/rpc';
import { ExactNanoFacilitator } from '@nanosession/x402/facilitator';
import { z } from 'zod';

// 1. Configuration Schema
const ConfigSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NANO_RPC_URL: z.string().default('https://rpc.nano.to'),
  NANO_SEED: z.string().optional(),
  NANO_ACCOUNT_INDEX: z.coerce.number().default(0),
  NANO_RECEIVE_MODE: z.enum(['sync', 'async']).default('sync'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.string().default('combined'),
});

const config = ConfigSchema.parse(process.env);

// 2. Initialize Core Components
const rpcClient = new NanoRpcClient({
  endpoints: config.NANO_RPC_URL.split(',').map(u => u.trim()),
});

const facilitator = new ExactNanoFacilitator({
  rpcClient,
  seed: config.NANO_SEED,
  accountIndex: config.NANO_ACCOUNT_INDEX,
  receiveMode: config.NANO_RECEIVE_MODE,
});

const app = express();

// 3. Middleware
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());
app.use(morgan(config.LOG_LEVEL));

// 4. Standard x402 Endpoints

/**
 * GET /supported
 * Returns information about supported payment schemes and networks.
 */
app.get('/supported', async (_req: Request, res: Response) => {
  try {
    const supported = await facilitator.getSupported();
    res.json(supported);
  } catch (error) {
    console.error('Error fetching supported kinds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /verify
 * Verifies a payment payload against requirements.
 */
app.post('/verify', async (req: Request, res: Response) => {
  try {
    const { paymentPayload, paymentDetails } = req.body;

    if (!paymentPayload || !paymentDetails) {
      return res.status(400).json({ error: 'Missing paymentPayload or paymentDetails' });
    }

    const result = await facilitator.verify(paymentPayload, paymentDetails);
    
    if (result.isValid) {
      res.json({ valid: true, payer: result.payer });
    } else {
      res.status(400).json({ 
        valid: false, 
        error: result.invalidReason, 
        message: result.invalidMessage 
      });
    }
  } catch (error) {
    console.error('Error during verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /settle
 * Settles a payment, preventing double-spending.
 */
app.post('/settle', async (req: Request, res: Response) => {
  try {
    const { paymentPayload, paymentDetails } = req.body;

    if (!paymentPayload || !paymentDetails) {
      return res.status(400).json({ error: 'Missing paymentPayload or paymentDetails' });
    }

    const result = await facilitator.settle(paymentPayload, paymentDetails);
    
    if (result.success) {
      res.json({ 
        success: true, 
        transaction: result.transaction,
        network: result.network,
        payer: result.payer 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.errorReason, 
        message: result.errorMessage 
      });
    }
  } catch (error) {
    console.error('Error during settlement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Helper Endpoints

/**
 * Health Check
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /requirements
 * Helper to generate NanoSession requirements (Track 1).
 */
app.post('/requirements', (req: Request, res: Response) => {
  try {
    const { amount, payTo, maxTimeoutSeconds } = req.body;
    
    if (!amount || !payTo) {
      return res.status(400).json({ error: 'Missing amount or payTo' });
    }

    const handler = facilitator.getUnderlyingHandler();
    const requirements = handler.getRequirements({
      resourceAmountRaw: amount,
      payTo,
      maxTimeoutSeconds: maxTimeoutSeconds || 600
    });

    res.json(requirements);
  } catch (error) {
    console.error('Error generating requirements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Start Server
app.listen(config.PORT, () => {
  console.log(`🚀 Nano Facilitator Service running on port ${config.PORT}`);
  console.log(`📡 RPC: ${config.NANO_RPC_URL}`);
  console.log(`🔐 Track 2: ${config.NANO_SEED ? 'Enabled' : 'Disabled (NANO_SEED is not set)'}`);
});
