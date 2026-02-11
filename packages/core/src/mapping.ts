/**
 * Bidirectional mapping between NanoSession headers and x402 PaymentRequirements
 */

import type { NanoSessionHeaders, PaymentRequirements } from './types.js';
import { TAG_MODULUS, SCHEME, NETWORK, ASSET } from './constants.js';

/**
 * Converts NanoSession headers to x402 PaymentRequirements
 * @throws Error if tag is >= TAG_MODULUS
 */
export function toX402Requirements(headers: NanoSessionHeaders): PaymentRequirements {
  // Validate tag is within valid range
  if (headers.tag < 0 || headers.tag >= TAG_MODULUS) {
    throw new Error(`Tag must be between 0 and ${TAG_MODULUS - 1}, got ${headers.tag}`);
  }
  
  // Validate amount is multiple of TAG_MODULUS (prices should be aligned)
  const amount = BigInt(headers.priceRaw);
  if (amount % BigInt(TAG_MODULUS) !== BigInt(0)) {
    throw new Error(`Amount must be a multiple of TAG_MODULUS (${TAG_MODULUS})`);
  }
  
  // Calculate expiration
  const expiresAt = headers.expires;
  const now = new Date().toISOString();
  const maxTimeoutSeconds = Math.ceil(
    (new Date(expiresAt).getTime() - new Date(now).getTime()) / 1000
  );
  
  return {
    scheme: SCHEME,
    network: NETWORK,
    asset: ASSET,
    amount: headers.priceRaw,
    payTo: headers.address,
    maxTimeoutSeconds: Math.max(60, maxTimeoutSeconds), // Minimum 60 seconds
    extra: {
      tag: headers.tag,
      sessionId: headers.sessionId,
      tagModulus: TAG_MODULUS,
      expiresAt
    }
  };
}

/**
 * Converts x402 PaymentRequirements to NanoSession headers
 */
export function fromX402Requirements(requirements: PaymentRequirements): NanoSessionHeaders {
  return {
    sessionId: requirements.extra.sessionId,
    address: requirements.payTo,
    priceRaw: requirements.amount,
    tag: requirements.extra.tag,
    expires: requirements.extra.expiresAt
  };
}

/**
 * Creates an x402 PaymentPayload from a block hash
 */
export function toX402Payload(blockHash: string): { blockHash: string } {
  return { blockHash };
}
