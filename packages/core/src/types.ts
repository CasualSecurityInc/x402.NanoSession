/**
 * NanoSession x402 V2 standard types
 */

export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

export interface NanoSessionExtra {
  /** Unique tag for request identification */
  tag: number;
  /** Session identifier */
  id: string;
  /** Tag modulus used for calculation */
  tagModulus: number;
  /** Multiplier to shift the tag into higher decimals */
  tagMultiplier?: string;
  /** ISO timestamp when tag reservation expires */
  expiresAt?: string;
}

export interface PaymentRequirements {
  /** Payment scheme identifier (must be "exact") */
  scheme: string;
  /** Network identifier (e.g. "nano:mainnet") */
  network: string;
  /** Asset identifier (e.g. "XNO") */
  asset: string;
  /** Base amount in raw (smallest Nano unit) */
  amount: string;
  /** Address to pay the base amount + tag to */
  payTo: string;
  /** Maximum time in seconds to complete payment */
  maxTimeoutSeconds: number;
  /** Scheme-specific NanoSession extra data, now namespaced */
  extra: {
    nanoSession: NanoSessionExtra;
    [key: string]: unknown;
  };
}

export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
}

export interface PaymentPayload {
  x402Version: 2;
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: {
    /** The Nano block hash serving as the proof of payment */
    proof: string;
  };
  extensions?: Record<string, unknown>;
}
