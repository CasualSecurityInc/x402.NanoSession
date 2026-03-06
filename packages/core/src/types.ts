/**
 * NanoSession x402 V2 standard types
 */

/**
 * Metadata about the requested resource
 */
export interface ResourceInfo {
  /** Public URL of the resource */
  url: string;
  /** Human-readable description */
  description?: string;
  /** Content type of the resource */
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

/**
 * Standard x402 V2 Payment Required response payload
 */
export interface PaymentRequired {
  /** Protocol version (must be 2) */
  x402Version: 2;
  /** Human-readable error message */
  error?: string;
  /** Information about the protected resource */
  resource: ResourceInfo;
  /** List of accepted payment requirements */
  accepts: PaymentRequirements[];
  /** Optional protocol extensions */
  extensions?: Record<string, unknown>;
}

/**
 * Standard x402 V2 Payment Response payload (Signature)
 */
export interface PaymentPayload {
  /** Protocol version (must be 2) */
  x402Version: 2;
  /** Information about the resource being paid for */
  resource?: ResourceInfo;
  /** The requirements that this payment satisfies */
  accepted: PaymentRequirements;
  /** The cryptographic proof of payment */
  payload: {
    /** The Nano block hash serving as the proof of payment */
    proof: string;
  };
  /** Optional protocol extensions */
  extensions?: Record<string, unknown>;
}
