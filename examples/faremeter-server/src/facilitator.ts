/*
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  WARNING: IN-MEMORY SPENT SET - NOT SUITABLE FOR PRODUCTION  ⚠️           ║
 * ║                                                                               ║
 * ║  This example uses an in-memory spent set that:                               ║
 * ║    - Resets on server restart (allows replay attacks)                         ║
 * ║    - Does not scale across multiple instances                                 ║
 * ║    - Is NOT suitable for production use                                       ║
 * ║                                                                               ║
 * ║  For production, implement SpentSetStorage with:                              ║
 * ║    - Redis (recommended for horizontal scaling)                               ║
 * ║    - PostgreSQL/MySQL (for existing database infrastructure)                  ║
 * ║    - DynamoDB (for AWS deployments)                                           ║
 * ║                                                                               ║
 * ║  See: packages/faremeter-plugin/PRODUCTION.md                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import { createServer, IncomingMessage } from 'http';
import { createFacilitatorHandler } from '@nanosession/faremeter';
import { NanoRpcClient } from '@nanosession/rpc';
import { SCHEME, NETWORK } from '@nanosession/core';

const FACILITATOR_PORT = process.env.FACILITATOR_PORT || 4000;
const RPC_URL = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const RECEIVING_ADDRESS = process.env.NANO_SERVER_ADDRESS;
const DEFAULT_PAYMENT_AMOUNT = '1000000000000000000000000';

if (!RECEIVING_ADDRESS) {
  console.error('❌ NANO_SERVER_ADDRESS environment variable is required');
  process.exit(1);
}

const rpcClient = new NanoRpcClient({ endpoints: [RPC_URL] });
const facilitatorHandler = createFacilitatorHandler({
  rpcClient,
  payTo: RECEIVING_ADDRESS,
  defaultAmount: process.env.PAYMENT_AMOUNT || DEFAULT_PAYMENT_AMOUNT,
  maxTimeoutSeconds: 300,
});

async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

type AcceptsRequest = {
  x402Version?: number;
  accepts?: Array<{
    scheme?: string;
    network?: string;
    maxAmountRequired?: string;
    maxTimeoutSeconds?: number;
    resource?: string;
  }>;
};

type PaymentRequest = {
  x402Version?: number;
  paymentHeader?: string;
  paymentRequirements?: {
    scheme: string;
    network: string;
    asset: string;
    maxAmountRequired: string;
    payTo: string;
    maxTimeoutSeconds: number;
    resource: string;
    description: string;
    mimeType: string;
    outputSchema?: object;
    extra?: Record<string, unknown>;
  };
  paymentPayload?: {
    x402Version: number;
    scheme: string;
    network: string;
    asset?: string;
    payload: Record<string, unknown>;
  };
};

async function handleAccepts(req: IncomingMessage) {
  const body = await parseBody(req) as AcceptsRequest;
  console.log('📋 /accepts request:', JSON.stringify(body, null, 2));

  const accepts = body.accepts || [];
  
  const hasNano = accepts.some(a => a.scheme === SCHEME && a.network === NETWORK);
  if (!hasNano) {
    accepts.push({
      scheme: SCHEME,
      network: NETWORK,
      maxAmountRequired: process.env.PAYMENT_AMOUNT || DEFAULT_PAYMENT_AMOUNT,
      maxTimeoutSeconds: 300,
    });
  }

  const enrichedAccepts = await facilitatorHandler.getRequirements(accepts.map(a => ({
    scheme: a.scheme || SCHEME,
    network: a.network || NETWORK,
    asset: 'XNO',
    maxAmountRequired: a.maxAmountRequired || process.env.PAYMENT_AMOUNT || DEFAULT_PAYMENT_AMOUNT,
    payTo: RECEIVING_ADDRESS!,
    maxTimeoutSeconds: a.maxTimeoutSeconds || 300,
    resource: a.resource || '',
    description: '',
    mimeType: '',
  })));

  const response = {
    x402Version: body.x402Version || 1,
    accepts: enrichedAccepts,
    error: '',
  };

  console.log('📋 /accepts response:', JSON.stringify(response, null, 2));
  return { status: 200, body: response };
}

async function handleVerify(req: IncomingMessage) {
  const body = await parseBody(req) as PaymentRequest;
  console.log('🔍 /verify request:', JSON.stringify(body, null, 2));

  if (!body.paymentRequirements || !body.paymentPayload) {
    return { 
      status: 400, 
      body: { isValid: false, invalidReason: 'Missing paymentRequirements or paymentPayload' } 
    };
  }

  const result = await facilitatorHandler.handleVerify?.(
    body.paymentRequirements,
    body.paymentPayload
  );

  console.log('🔍 /verify response:', JSON.stringify(result, null, 2));
  return { 
    status: 200, 
    body: result || { isValid: false, invalidReason: 'Scheme not supported' } 
  };
}

async function handleSettle(req: IncomingMessage) {
  const body = await parseBody(req) as PaymentRequest;
  console.log('💰 /settle request:', JSON.stringify(body, null, 2));

  if (!body.paymentRequirements || !body.paymentPayload) {
    return { 
      status: 400, 
      body: { success: false, transaction: null, network: null, errorReason: 'Missing paymentRequirements or paymentPayload' } 
    };
  }

  const result = await facilitatorHandler.handleSettle(
    body.paymentRequirements,
    body.paymentPayload
  );

  const response = result ? {
    success: result.success,
    transaction: result.txHash,
    network: result.networkId,
    errorReason: result.error,
  } : {
    success: false,
    transaction: null,
    network: null,
    errorReason: 'Scheme not supported',
  };

  console.log('💰 /settle response:', JSON.stringify(response, null, 2));
  return { status: 200, body: response };
}

function handleHealth() {
  return { 
    status: 200, 
    body: { status: 'ok', scheme: SCHEME, network: NETWORK } 
  };
}

function handleNotFound() {
  return { 
    status: 404, 
    body: { 
      error: 'Not found',
      endpoints: ['POST /accepts', 'POST /verify', 'POST /settle', 'GET /health'],
    } 
  };
}

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    let result: { status: number; body: unknown };

    if (req.url === '/accepts' && req.method === 'POST') {
      result = await handleAccepts(req);
    } else if (req.url === '/verify' && req.method === 'POST') {
      result = await handleVerify(req);
    } else if (req.url === '/settle' && req.method === 'POST') {
      result = await handleSettle(req);
    } else if (req.url === '/health' && req.method === 'GET') {
      result = handleHealth();
    } else {
      result = handleNotFound();
    }

    res.writeHead(result.status);
    res.end(JSON.stringify(result.body));
  } catch (error) {
    console.error('❌ Error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    }));
  }
});

server.listen(FACILITATOR_PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║           NanoSession Facilitator Service                         ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log('║  ⚠️  WARNING: IN-MEMORY SPENT SET - NOT FOR PRODUCTION            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Facilitator running on http://localhost:${FACILITATOR_PORT}`);
  console.log('');
  console.log('Configuration:');
  console.log(`  RPC URL: ${RPC_URL}`);
  console.log(`  Receiving Address: ${RECEIVING_ADDRESS}`);
  console.log(`  Payment Amount: ${process.env.PAYMENT_AMOUNT || DEFAULT_PAYMENT_AMOUNT} raw`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST http://localhost:${FACILITATOR_PORT}/accepts`);
  console.log(`  POST http://localhost:${FACILITATOR_PORT}/verify`);
  console.log(`  POST http://localhost:${FACILITATOR_PORT}/settle`);
  console.log(`  GET  http://localhost:${FACILITATOR_PORT}/health`);
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down facilitator...');
  server.close(() => process.exit(0));
});
