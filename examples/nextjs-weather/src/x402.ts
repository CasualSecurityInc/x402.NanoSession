import { x402ResourceServer } from "@x402/core/server";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactNanoScheme } from "@nanosession/x402/server";
import { ExactNanoFacilitator } from "@nanosession/x402/facilitator";
import { NanoRpcClient } from "@nanosession/rpc";
import { deriveAddressFromSeed } from "@nanosession/core";

const rpcEndpoints = (process.env.NANO_RPC_URL || "https://rpc.nano.to")
  .split(',')
  .map(u => u.trim());

const rpcClient = new NanoRpcClient({
  endpoints: rpcEndpoints
});

// Track 2 (nanoSignature) configuration
// These are optional - Track 1 works without them
const seed = process.env.NANO_SEED;
const accountIndex = process.env.NANO_ACCOUNT_INDEX
  ? parseInt(process.env.NANO_ACCOUNT_INDEX, 10)
  : 0;
const receiveMode = process.env.NANO_RECEIVE_MODE as 'sync' | 'async' | undefined;

// Derive the facilitator's receiving address from seed (for Track 2)
// This is used by route.ts to set payTo correctly
export const facilitatorAddress = seed
  ? deriveAddressFromSeed(seed, accountIndex)
  : undefined;

// Warn if Track 2 is advertised but seed not configured
if (!seed) {
  console.warn('[x402] NANO_SEED not configured - Track 2 (nanoSignature) will not work. Set NANO_SEED to enable.');
}

export const facilitator = new x402Facilitator();
const nanoFacilitator = new ExactNanoFacilitator({
  rpcClient,
  seed,
  accountIndex,
  receiveMode,
});
facilitator.register("nano:mainnet", nanoFacilitator);

export const server = new x402ResourceServer(facilitator);
const nanoScheme = new ExactNanoScheme(nanoFacilitator.getUnderlyingHandler());
server.register("nano:mainnet", nanoScheme);

// Log accepted routes on startup
console.log('\n🛡️ [x402] Protected Routes:');
console.log('   - /api/weather (nano:mainnet) [exact]');
console.log('   - Track 1: nanoSession (Session ID + Tagged Proof)');
console.log('   - Track 2: nanoSignature (Cryptographic Proof)');
if (facilitatorAddress) {
  console.log(`   - Pay To: ${facilitatorAddress}`);
}
console.log('');
