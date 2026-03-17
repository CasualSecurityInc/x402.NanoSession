import 'dotenv/config';
import { wrap } from '@faremeter/fetch';
import { createPaymentHandler } from '@nanosession/faremeter';
import { NanoRpcClient } from '@nanosession/rpc';

const RPC_URL = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const SEED = process.env.NANO_PAYER_SEED;
const ACCOUNT_INDEX = parseInt(process.env.NANO_ACCOUNT_INDEX || '0', 10);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000/weather';

if (!SEED) {
  console.error('❌ Error: NANO_PAYER_SEED environment variable is required');
  console.log('💡 Tip: Set NANO_PAYER_SEED to the 64-character hex seed of your Nano wallet.');
  process.exit(1);
}

// Re-assert SEED is defined for TypeScript
const payerSeed = SEED as string;

async function main() {
  console.log('🚀 NanoSession + Faremeter Client starting...');
  console.log(`📡 Requesting ${SERVER_URL}...`);

  const rpcClient = new NanoRpcClient({ endpoints: [RPC_URL] });
  
  // Create Faremeter-compatible Nano payment handler
  const paymentHandler = createPaymentHandler({
    rpcClient,
    seed: payerSeed,
  });

  try {
    // Perform the request using wrapped fetch
    // It will automatically handle 402 responses using the provided handler
    const faremeterFetch = wrap(fetch, { handlers: [paymentHandler] });
    const response = await faremeterFetch(SERVER_URL);

    if (response.ok) {
      const data = await response.json();
      console.log('\n✨ Request Successful!');
      console.log('--------------------');
      console.log(JSON.stringify(data, null, 2));
      console.log('--------------------');
    } else {
      console.error(`\n❌ Request Failed! Status: ${response.status}`);
      console.error(await response.text());
    }
  } catch (error) {
    console.error('\n💥 Unexpected Error:', error);
    if (error instanceof Error) {
      console.error(error.message);
      if (error.message.includes('Insufficient balance')) {
        console.log('\n💡 Tip: Make sure your wallet is funded. Check your address via:');
        console.log(`   npx nanocurrency-cli derive-address --seed ${payerSeed.slice(0, 8)}... --index ${ACCOUNT_INDEX}`);
      }
    }
  }
}

main().catch(console.error);
