import { deriveAddress, derivePublicKey, deriveSecretKey } from 'nanocurrency';

const DEFAULT_POOL_SIZE = 8;
const DEFAULT_START_INDEX = 1;

let nextOffset = 0;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function deriveAddressFromSeed(seed: string, index: number): string {
  const secretKey = deriveSecretKey(seed, index);
  const publicKey = derivePublicKey(secretKey);
  return deriveAddress(publicKey, { useNanoPrefix: true });
}

export function resetDemoDestinationPoolForTests() {
  nextOffset = 0;
}

export function getNextDemoDestination(): string {
  const seed = process.env.NANO_TEST_SEED;
  if (!seed) {
    if (!process.env.NANO_SERVER_ADDRESS) {
      throw new Error('NANO_SERVER_ADDRESS environment variable is not set');
    }

    return process.env.NANO_SERVER_ADDRESS;
  }

  const poolSize = parsePositiveInt(process.env.NANO_DEMO_ADDRESS_POOL_SIZE, DEFAULT_POOL_SIZE);
  const startIndex = parsePositiveInt(process.env.NANO_DEMO_ADDRESS_START_INDEX, DEFAULT_START_INDEX);
  const index = startIndex + (nextOffset % poolSize);
  nextOffset += 1;
  return deriveAddressFromSeed(seed, index);
}
