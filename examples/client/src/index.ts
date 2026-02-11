/**
 * Example: NanoSession Payment Client
 * 
 * This example demonstrates a client that automatically handles
 * HTTP 402 Payment Required responses by creating Nano payments.
 */

import { NanoSessionPaymentHandler } from '@nanosession/client';
import { NanoRpcClient } from '@nanosession/rpc';
import type { PaymentRequirements } from '@nanosession/core';

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const RPC_URL = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const SEED = process.env.NANO_TEST_SEED;
const MAX_SPEND = process.env.NANO_MAX_SPEND || '10000000000000000000000000'; // 0.01 XNO default

// Validate configuration
if (!SEED) {
  console.error('❌ Error: NANO_TEST_SEED environment variable is required');
  console.error('');
  console.error('Please set it before running the client:');
  console.error('  export NANO_TEST_SEED=your_64_char_hex_seed');
  console.error('');
  console.error('Or create an e2e.env file and source it:');
  console.error('  source ./e2e.env && npx tsx src/index.ts');
  process.exit(1);
}

// Initialize RPC client and payment handler
const rpcClient = new NanoRpcClient({ endpoints: [RPC_URL] });
const handler = new NanoSessionPaymentHandler({
  rpcClient,
  seed: SEED,
  maxSpend: MAX_SPEND
});

/**
 * Fetch wrapper that automatically handles 402 responses
 */
async function fetchWithPayment(url: string): Promise<Response> {
  // First attempt without payment
  console.log(`📡 Requesting ${url}...`);
  let response = await fetch(url);

  // If we get 402, handle the payment
  if (response.status === 402) {
    console.log('🔒 Received 402 Payment Required');
    
    // Extract payment requirements from header
    const paymentRequiredHeader = response.headers.get('X-Payment-Required');
    if (!paymentRequiredHeader) {
      throw new Error('Server returned 402 but no payment requirements');
    }

    const requirements: PaymentRequirements = JSON.parse(paymentRequiredHeader);
    console.log('💳 Payment Requirements:');
    console.log(`   Scheme: ${requirements.scheme}`);
    console.log(`   Network: ${requirements.network}`);
    console.log(`   Amount: ${requirements.amount} raw (${Number(requirements.amount) / 1e30} XNO)`);
    console.log(`   Pay To: ${requirements.payTo}`);
    console.log(`   Session ID: ${requirements.extra.sessionId}`);
    console.log(`   Tag: ${requirements.extra.tag}`);
    console.log('');

    // Check if we can afford it
    if (BigInt(requirements.amount) > BigInt(MAX_SPEND)) {
      throw new Error(`Payment amount exceeds max spend: ${requirements.amount} > ${MAX_SPEND}`);
    }

    // Create payment
    console.log('💰 Creating payment...');
    const execers = await handler.handle({}, [requirements]);
    
    if (execers.length === 0) {
      throw new Error('No payment execers created - scheme may not match');
    }

    // Execute the payment
    console.log('📤 Broadcasting payment to network...');
    const { payload } = await execers[0].exec();
    
    console.log('✅ Payment broadcast!');
    console.log(`   Block Hash: ${payload.blockHash}`);
    console.log('');

    // Retry the request with payment
    console.log('🔄 Retrying request with payment...');
    response = await fetch(url, {
      headers: {
        'X-Payment-Response': JSON.stringify(payload)
      }
    });
  }

  return response;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 NanoSession Example Client');
  console.log('');
  console.log('Configuration:');
  console.log(`  Server URL: ${SERVER_URL}`);
  console.log(`  RPC URL: ${RPC_URL}`);
  console.log(`  Max Spend: ${MAX_SPEND} raw (${Number(MAX_SPEND) / 1e30} XNO)`);
  console.log('');

  try {
    // Request the protected resource
    const response = await fetchWithPayment(`${SERVER_URL}/api/resource`);

    if (response.ok) {
      const data = await response.json();
      console.log('✨ Success! Resource received:');
      console.log('');
      console.log(JSON.stringify(data, null, 2));
      console.log('');
      console.log('Payment Flow Complete! 🎉');
    } else {
      const error = await response.json();
      console.error('❌ Request failed:');
      console.error(JSON.stringify(error, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the client
main();
