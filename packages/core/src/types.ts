/**
 * NanoSession-specific types
 */

export interface NanoSessionHeaders {
  /** Session identifier */
  sessionId: string;
  /** Nano address to pay to */
  address: string;
  /** Price in raw (smallest Nano unit) */
  priceRaw: string;
  /** Unique tag for this payment (0 to TAG_MODULUS-1) */
  tag: number;
  /** ISO timestamp when tag expires */
  expires: string;
}

export interface NanoSessionExtra {
  /** Unique tag for request identification */
  tag: number;
  /** Session identifier */
  sessionId: string;
  /** Tag modulus used for calculation */
  tagModulus: number;
  /** ISO timestamp when tag reservation expires */
  expiresAt: string;
}

/**
 * x402-compatible types
 */

export interface PaymentRequirements {
  /** Payment scheme identifier */
  scheme: string;
  /** Network identifier (CAIP-2 format) */
  network: string;
  /** Asset identifier */
  asset: string;
  /** Amount in smallest unit */
  amount: string;
  /** Address to pay to */
  payTo: string;
  /** Maximum time in seconds to complete payment */
  maxTimeoutSeconds: number;
  /** Scheme-specific extra data */
  extra: NanoSessionExtra;
}

export interface PaymentPayload {
  /** Block hash as payment proof */
  blockHash: string;
}
