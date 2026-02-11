import nacl from 'tweetnacl';
import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Derive a keypair from a Nano seed and account index.
 * Uses Nano's seed+index model: secretKey = blake2b(seed || index)
 *
 * @param seed - 64-character hex seed
 * @param index - Account index (0 = first account, 1 = second, etc.)
 * @returns KeyPair with publicKey and secretKey as Uint8Arrays
 */
export function deriveKeyPair(seed: string, index: number = 0): KeyPair {
  // Use nanocurrency for proper HD derivation
  const secretKeyHex = deriveSecretKey(seed, index);
  const publicKeyHex = derivePublicKey(secretKeyHex);

  return {
    secretKey: Buffer.from(secretKeyHex, 'hex'),
    publicKey: Buffer.from(publicKeyHex, 'hex')
  };
}

/**
 * Derive a Nano address from a seed and account index.
 *
 * @param seed - 64-character hex seed
 * @param index - Account index (0 = first account, 1 = second, etc.)
 * @returns Nano address (nano_...)
 */
export function deriveAddressFromSeed(seed: string, index: number = 0): string {
  const secretKeyHex = deriveSecretKey(seed, index);
  const publicKeyHex = derivePublicKey(secretKeyHex);
  return deriveAddress(publicKeyHex, { useNanoPrefix: true });
}

export interface SendBlockParams {
  account: string;
  previous: string;
  representative: string;
  balance: string;
  link: string;
}

export interface SignedBlock extends SendBlockParams {
  signature: string;
  work: string;
}

export function createSendBlock(params: SendBlockParams): SendBlockParams {
  return params;
}

export function signBlock(block: SendBlockParams, secretKey: Uint8Array): string {
  const blockHash = hashBlock(block);
  const signature = nacl.sign.detached(blockHash, secretKey);
  return Buffer.from(signature).toString('hex');
}

function hashBlock(block: SendBlockParams): Uint8Array {
  // Simplified - in real implementation this would properly hash the block
  return new Uint8Array(32).fill(0);
}
