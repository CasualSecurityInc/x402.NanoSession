import nacl from 'tweetnacl';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function deriveKeyPair(seed: string): KeyPair {
  const seedBytes = Buffer.from(seed, 'hex');
  return nacl.sign.keyPair.fromSeed(seedBytes.slice(0, 32));
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
