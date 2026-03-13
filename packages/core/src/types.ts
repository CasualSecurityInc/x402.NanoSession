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
  /** Session identifier */
  id: string;
  /** Human/audit-visible tag value */
  tag: number;
  /** Underlying resource price before tag amount is added (raw) */
  resourceAmountRaw: string;
  /** Tag component encoded into the payment amount (raw) */
  tagAmountRaw: string;
  /** ISO timestamp when tag reservation expires */
  expiresAt?: string;
}

export interface NanoSignatureExtra {
  /** The canonical URL that must be signed (prevents replay attacks across different endpoints) */
  url: string;
  /** The message template that the client must sign (e.g., "block_hash+url") */
  messageToSign?: string;
}

/**
 * Network identifier in CAIP-2 format.
 * @example "nano:mainnet" - Nano mainnet
 */
export type Network = `${string}:${string}`;

export interface PaymentRequirements {
  /** Payment scheme identifier (must be "exact") */
  scheme: string;
  /** Network identifier (e.g. "nano:mainnet") */
  network: Network;
  /** Asset identifier (e.g. "XNO") */
  asset: string;
  /** Total amount to send in raw (normative payment amount) */
  amount: string;
  /** Address to pay the total amount to */
  payTo: string;
  /** Maximum time in seconds to complete payment */
  maxTimeoutSeconds: number;
  /** Scheme-specific extra data, now namespaced for Rev 7 Dual-Track */
  extra: {
    nanoSession?: NanoSessionExtra;
    nanoSignature?: NanoSignatureExtra;
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
  /** The cryptographic payload */
  payload: {
    /** The Nano block hash serving as the proof of payment */
    proof: string;
    /** In Track 2 (nano-exact-broadcast-signature), the Ed25519 signature binding the block to the URL */
    signature?: string;
  };
  /** Optional protocol extensions */
  extensions?: Record<string, unknown>;
}
