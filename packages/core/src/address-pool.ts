import { createRequire } from 'node:module';

export interface AddressPool {
  getAddress(sessionId: string): string;
}

type NanocurrencyModule = {
  deriveSecretKey: (seed: string, index: number) => string;
  derivePublicKey: (secretKeyHex: string) => string;
  deriveAddress: (publicKeyHex: string, options?: { useNanoPrefix?: boolean }) => string;
};

const require = createRequire(import.meta.url);

function deriveAddressFromSeed(seed: string, index: number = 0): string {
  const { deriveSecretKey, derivePublicKey, deriveAddress } = require('nanocurrency') as NanocurrencyModule;
  const secretKeyHex = deriveSecretKey(seed, index);
  const publicKeyHex = derivePublicKey(secretKeyHex);
  return deriveAddress(publicKeyHex, { useNanoPrefix: true });
}

export class StandardAccountPool implements AddressPool {
  private seed: string;
  private accountIndex: number;

  constructor(seed: string, accountIndex: number = 1) {
    this.seed = seed;
    this.accountIndex = accountIndex;
  }

  getAddress(_sessionId: string): string {
    return deriveAddressFromSeed(this.seed, this.accountIndex);
  }
}
