import 'dotenv/config';
import express from 'express';
import { createFacilitatorHandler } from '@nanosession/faremeter';
import { NanoRpcClient } from '@nanosession/rpc';
import { SCHEME, NETWORK } from '@nanosession/core';

const PORT = process.env.FACILITATOR_PORT || 4000;
const RPC_URL = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const RECEIVING_ADDRESS = process.env.NANO_FACILITATOR_ADDRESS;
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT || '1000000000000000000000000'; // 1.0 XNO
const FACILITATOR_SEED = process.env.NANO_FACILITATOR_SEED;

if (!RECEIVING_ADDRESS) {
  console.error('❌ Error: NANO_FACILITATOR_ADDRESS environment variable is required');
  console.log('💡 Tip: Set NANO_FACILITATOR_ADDRESS to the address you want to receive funds at.');
  process.exit(1);
}

const rpcClient = new NanoRpcClient({ endpoints: [RPC_URL] });
const facilitatorHandler = createFacilitatorHandler({
  rpcClient,
  payTo: RECEIVING_ADDRESS,
  defaultResourceAmountRaw: PAYMENT_AMOUNT,
  maxTimeoutSeconds: 300,
  // If seed is provided, the facilitator will automatically pocket funds (Track 2)
  // spentSet: undefined, // defaults to InMemorySpentSet
});

const app = express();
app.use(express.json());

// Enable CORS for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Faremeter Endpoints

/**
 * POST /accepts
 * Returns payment requirements for the requested schemes/networks.
 */
app.post('/accepts', async (req, res) => {
  try {
    const { accepts } = req.body;
    console.log(`📋 Received /accepts request for ${accepts?.length || 0} schemes`);
    
    const enriched = await facilitatorHandler.getRequirements(accepts || []);
    
    res.json({
      x402Version: 2,
      accepts: enriched,
    });
  } catch (error) {
    console.error('❌ Error in /accepts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /verify
 * Verifies a payment payload.
 */
app.post('/verify', async (req, res) => {
  try {
    const { paymentRequirements, paymentPayload } = req.body;
    console.log(`🔍 Received /verify request for block: ${paymentPayload?.payload?.proof?.slice(0, 16)}...`);

    const result = await facilitatorHandler.handleVerify?.(
      paymentRequirements,
      paymentPayload
    );

    if (result) {
      console.log(`✅ Verification result: ${result.isValid ? 'VALID' : 'INVALID'}`);
      res.json(result);
    } else {
      console.log('⚠️ Verification result: NOT SUPPORTED');
      res.status(400).json({ isValid: false, invalidReason: 'Scheme not supported' });
    }
  } catch (error) {
    console.error('❌ Error in /verify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /settle
 * Settles a payment (finalizes and marks as spent).
 */
app.post('/settle', async (req, res) => {
  try {
    const { paymentRequirements, paymentPayload } = req.body;
    console.log(`💰 Received /settle request for block: ${paymentPayload?.payload?.proof?.slice(0, 16)}...`);

    const result = await facilitatorHandler.handleSettle(
      paymentRequirements,
      paymentPayload
    );

    if (result) {
      console.log(`💰 Settlement result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.success) {
        console.log(`🔗 Transaction Hash: ${result.txHash}`);
      }
      res.json({
        success: result.success,
        transaction: result.txHash,
        network: result.networkId,
        errorReason: result.error,
      });
    } else {
      console.log('⚠️ Settlement result: NOT SUPPORTED');
      res.status(400).json({ success: false, errorReason: 'Scheme not supported' });
    }
  } catch (error) {
    console.error('❌ Error in /settle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', scheme: SCHEME, network: NETWORK });
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║           NanoSession Faremeter Facilitator                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Facilitator running on http://localhost:${PORT}`);
  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`🎯 Pay To: ${RECEIVING_ADDRESS}`);
  console.log(`💵 Amount: ${PAYMENT_AMOUNT} raw`);
  console.log('');
  console.log('Waiting for payment requests...');
  console.log('');
});
