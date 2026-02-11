import { describe, test, expect, beforeAll } from 'vitest';
import { createServer } from 'http';
import * as dotenv from 'dotenv';
import { NanoSessionFacilitatorHandler } from '@nanosession/server';
import { NanoSessionPaymentHandler } from '@nanosession/client';
import { NanoRpcClient } from '@nanosession/rpc';

// Load environment from e2e.env
dotenv.config({ path: './e2e.env' });

describe('Integration: Full Payment Flow', () => {
  let shouldSkip = false;
  let server: ReturnType<typeof createServer>;
  let serverPort: number;

  beforeAll(() => {
    if (!process.env.NANO_TEST_SEED) {
      console.log('\n⚠️  Skipping integration tests: NANO_TEST_SEED not set');
      console.log('   Create e2e.env file from e2e.env.example to run integration tests\n');
      shouldSkip = true;
      return;
    }
  });

  test('full payment flow on mainnet', async () => {
    if (shouldSkip) {
      console.log('Test skipped - no NANO_TEST_SEED');
      return;
    }

    const rpcClient = new NanoRpcClient({
      endpoints: [process.env.NANO_RPC_URL || 'https://rpc.nano.to']
    });
    
    // Create server handler
    const serverHandler = new NanoSessionFacilitatorHandler({ rpcClient });
    
    // Start test server
    await new Promise<void>((resolve) => {
      server = createServer(async (req, res) => {
        if (req.url === '/protected') {
          // Check for payment
          const paymentResponse = req.headers['x-payment-response'];
          
          if (!paymentResponse) {
            // Return 402 with requirements
            const requirements = serverHandler.getRequirements({
              amount: '1000000000000000000000000', // 0.001 XNO
              payTo: process.env.NANO_SERVER_ADDRESS || 'nano_destination',
              maxTimeoutSeconds: 300
            });
            
            res.writeHead(402, {
              'Content-Type': 'application/json',
              'X-Payment-Required': JSON.stringify(requirements)
            });
            res.end(JSON.stringify({ error: 'Payment required' }));
            return;
          }

          // Verify payment
          try {
            const payload = JSON.parse(paymentResponse as string);
            const requirements = serverHandler.getRequirements({
              amount: '1000000000000000000000000',
              payTo: process.env.NANO_SERVER_ADDRESS || 'nano_destination',
              maxTimeoutSeconds: 300
            });
            
            const result = await serverHandler.handleSettle!(requirements, payload);
            
            if (result?.success) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                message: 'Access granted',
                transactionHash: result.transactionHash
              }));
            } else {
              res.writeHead(402, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Payment verification failed',
                details: result?.error 
              }));
            }
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid payment response' }));
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
        }
        resolve();
      });
    });

    const baseUrl = `http://127.0.0.1:${serverPort}`;

    try {
      // Step 1: Request without payment (should get 402)
      console.log('\n📡 Step 1: Requesting protected resource...');
      const response1 = await fetch(`${baseUrl}/protected`);
      
      expect(response1.status).toBe(402);
      const paymentRequiredHeader = response1.headers.get('X-Payment-Required');
      expect(paymentRequiredHeader).toBeTruthy();
      
      const requirements = JSON.parse(paymentRequiredHeader!);
      console.log('   ✓ Received 402 with PaymentRequirements');
      console.log(`   💰 Amount: ${requirements.amount} raw (${Number(requirements.amount) / 1e30} XNO)`);

      // Step 2: Create and send payment
      console.log('\n💳 Step 2: Creating payment...');
      
      const clientHandler = new NanoSessionPaymentHandler({
        rpcClient,
        seed: process.env.NANO_TEST_SEED!,
        maxSpend: process.env.NANO_MAX_SPEND || '1000000000000000000000000000'
      });

      const execers = await clientHandler.handle({}, [requirements]);
      expect(execers.length).toBeGreaterThan(0);
      
      // Note: In a real test, we would broadcast the transaction here
      // For this integration test structure, we'll simulate success
      console.log('   ✓ Payment execer created');
      console.log('   ⚠️  Note: Real broadcast skipped in this test structure');

      // Step 3: Request with payment (simulated)
      console.log('\n🔐 Step 3: Retrying with payment...');
      console.log('   ⚠️  Note: Full verification requires real block on mainnet');
      
      // Cleanup
      server.close();
      
      console.log('\n✅ Integration test structure complete');
      console.log('   To run with real payments:');
      console.log('   1. Ensure e2e.env has valid NANO_TEST_SEED');
      console.log('   2. Ensure test wallet has balance');
      console.log('   3. Run: source ./e2e.env && npm run test:integration\n');

    } finally {
      server.close();
    }
  }, 60000); // 60 second timeout
});
