import { deriveSecretKey, derivePublicKey, hashBlock, signBlock as nanoSignBlock } from 'nanocurrency';
import { deriveAddressFromSeed } from '@nanosession/core';

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

export { deriveAddressFromSeed } from '@nanosession/core';

/**
 * Parameters for creating a Nano state block (Send subtype)
 */
export interface SendBlockParams {
  /** The Nano account address creating the block */
  account: string;
  /** The hash of the previous block in the account chain */
  previous: string;
  /** The representative address for the account */
  representative: string;
  /** The remaining balance after the transaction (in raw) */
  balance: string;
  /** The destination account address (link field) */
  link: string;
}

/**
 * A block that has been signed and is ready for broadcast
 */
export interface SignedBlock extends SendBlockParams {
  /** The cryptographic signature of the block hash */
  signature: string;
  /** The proof-of-work for the block */
  work: string;
}

/**
 * Creates a Send block object from parameters.
 * Note: Currently a passthrough in this implementation.
 */
export function createSendBlock(params: SendBlockParams): SendBlockParams {
  return params;
}

/**
 * Signs a Nano block using the provided secret key.
 * @param block The block parameters to sign
 * @param secretKey The 64-byte secret key
 * @returns The hex-encoded signature
 */
export function signBlock(block: SendBlockParams, secretKey: Uint8Array): string {
  const blockHash = hashBlock({
    account: block.account,
    previous: block.previous,
    representative: block.representative,
    balance: block.balance,
    link: block.link,
  });
  return nanoSignBlock({
    hash: blockHash,
    secretKey: Buffer.from(secretKey).toString('hex'),
  });
}
