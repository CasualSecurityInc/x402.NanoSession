/**
 * Example: NanoSession Payment-Protected Server
 * 
 * This example demonstrates a simple HTTP server that requires
 * Nano payments for accessing protected resources.
 */

import { createServer } from 'http';
import { NanoSessionFacilitatorHandler } from '@nanosession/server';
import { NanoRpcClient } from '@nanosession/rpc';

// Configuration
const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const RECEIVING_ADDRESS = process.env.NANO_SERVER_ADDRESS || 'nano_3example3example3example3example3example3example3example3example3example';
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT || '1000000000000000000000000'; // 0.001 XNO in raw

// Initialize RPC client and handler
const rpcClient = new NanoRpcClient({ endpoints: [RPC_URL] });
const handler = new NanoSessionFacilitatorHandler({ rpcClient });

// Create HTTP server
const server = createServer(async (req, res) => {
  // Add CORS headers for browser access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Payment-Response');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Protected resource endpoint
  if (req.url === '/api/resource' && req.method === 'GET') {
    // Check for payment response header
    const paymentResponse = req.headers['x-payment-response'];

    if (!paymentResponse) {
      // No payment provided - return 402 with requirements
      console.log('🔒 Payment required for /api/resource');
      
      const requirements = handler.getRequirements({
        amount: PAYMENT_AMOUNT,
        payTo: RECEIVING_ADDRESS,
        maxTimeoutSeconds: 300
      });

      res.writeHead(402, {
        'Content-Type': 'application/json',
        'X-Payment-Required': JSON.stringify(requirements)
      });
      
      res.end(JSON.stringify({
        error: 'Payment required',
        message: 'This resource requires a Nano payment to access',
        paymentRequirements: requirements
      }));
      return;
    }

    // Payment provided - verify and settle
    try {
      const payload = JSON.parse(paymentResponse as string);
      const requirements = handler.getRequirements({
        amount: PAYMENT_AMOUNT,
        payTo: RECEIVING_ADDRESS,
        maxTimeoutSeconds: 300
      });

      console.log('💳 Verifying payment...');
      const result = await handler.handleSettle!(requirements, payload);

      if (result?.success) {
        // Payment verified - grant access
        console.log('✅ Payment verified, granting access');
        console.log(`   Transaction: ${result.transactionHash}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Access granted!',
          resource: {
            id: 'example-resource-1',
            name: 'Premium Content',
            data: 'This is protected content that required a Nano payment to access.',
            timestamp: new Date().toISOString()
          },
          payment: {
            transactionHash: result.transactionHash,
            amount: PAYMENT_AMOUNT,
            amountXNO: (Number(PAYMENT_AMOUNT) / 1e30).toFixed(6)
          }
        }));
      } else {
        // Payment verification failed
        console.log('❌ Payment verification failed:', result?.error);
        
        res.writeHead(402, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Payment verification failed',
          details: result?.error
        }));
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Invalid payment response',
        message: error instanceof Error ? error.message : String(error)
      }));
    }
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', scheme: 'nano-session' }));
    return;
  }

  // Default response
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not found',
    availableEndpoints: [
      'GET /health - Health check',
      'GET /api/resource - Protected resource (requires payment)'
    ]
  }));
});

// Start server
server.listen(PORT, () => {
  console.log('🚀 NanoSession Example Server');
  console.log('');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Configuration:');
  console.log(`  RPC URL: ${RPC_URL}`);
  console.log(`  Receiving Address: ${RECEIVING_ADDRESS}`);
  console.log(`  Payment Amount: ${PAYMENT_AMOUNT} raw (${Number(PAYMENT_AMOUNT) / 1e30} XNO)`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET http://localhost:${PORT}/health`);
  console.log(`  GET http://localhost:${PORT}/api/resource`);
  console.log('');
  console.log('To test with payment, use the example client:');
  console.log(`  cd examples/client && npx tsx src/index.ts`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
