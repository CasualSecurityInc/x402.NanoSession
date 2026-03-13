/**
 * x402 type definitions for NanoSession adapter
 * These match the official x402 specification types from @x402/core
 * @see https://docs.x402.org/
 */

/**
 * Price can be a string (e.g., "$0.10"), number, or AssetAmount object.
 * When string/number, it represents a USD-like value that will be converted
 * to the native asset amount by the scheme's parsePrice method.
 */
export type Price = string | number | AssetAmount;

/**
 * Network identifier in CAIP-2 format.
 * @example "nano:mainnet" - Nano mainnet
 * @example "eip155:8453" - Base mainnet
 */
export type Network = `${string}:${string}`;

/**
 * Asset amount with asset identifier.
 * The amount is typically in the smallest unit (e.g., raw for Nano, wei for ETH).
 */
export interface AssetAmount {
  /** Amount in smallest unit (e.g., raw for Nano) */
  amount: string;
  /** Asset identifier (e.g., "XNO" for Nano, or contract address for tokens) */
  asset: string;
  /** Optional metadata (e.g., decimals, name, version) */
  extra?: Record<string, unknown>;
}

/**
 * Payment requirements as defined by x402.
 * Describes what the client must pay to access a resource.
 */
export interface PaymentRequirements {
  /** Payment scheme identifier (e.g., "exact" for immediate payment) */
  scheme: string;
  /** Network identifier in CAIP-2 format */
  network: Network;
  /** Asset identifier */
  asset: string;
  /** Amount to pay in smallest unit */
  amount: string;
  /** Destination address for payment */
  payTo: string;
  /** Maximum time in seconds to complete payment */
  maxTimeoutSeconds: number;
  /** Scheme-specific extra data (e.g., NanoSession metadata) */
  extra?: Record<string, unknown>;
}

/**
 * Payment payload as defined by x402.
 * Contains the cryptographic proof of payment submitted by the client.
 */
export interface PaymentPayload {
  /** x402 protocol version */
  x402Version: number;
  /** The payment proof and scheme-specific data */
  payload: {
    /** The cryptographic proof (e.g., block hash for Nano) */
    proof?: string;
    /** Additional scheme-specific payload data */
    [key: string]: unknown;
  };
  /** Optional extension data */
  extra?: Record<string, unknown>;
}

/**
 * Facilitator extension interface.
 * Extensions provide additional capabilities to facilitators
 * (e.g., gas sponsoring, batch signing).
 */
export interface FacilitatorExtension {
  /** Unique extension identifier */
  key: string;
}

/**
 * Context passed to facilitator verify/settle methods.
 * Provides access to registered facilitator extensions.
 */
export interface FacilitatorContext {
  /**
   * Get a registered extension by key.
   * @param key - The extension identifier
   * @returns The extension instance, or undefined if not registered
   */
  getExtension<T extends FacilitatorExtension = FacilitatorExtension>(key: string): T | undefined;
}

/**
 * Supported response from facilitator.
 */
export interface SupportedResponse {
  /** Kinds of payments supported */
  kinds: Array<{
    x402Version: number;
    scheme: string;
    network: Network;
    extra?: Record<string, unknown>;
  }>;
  /** Extension keys supported */
  extensions: string[];
  /** Signers per network */
  signers: Record<Network, string[]>;
}

/**
 * Verify response from facilitator.
 * Indicates whether a payment proof is valid.
 */
export interface VerifyResponse {
  /** Whether the payment is valid */
  isValid: boolean;
  /**
   * Machine-readable error code if invalid.
   * @example "scheme_mismatch" - Wrong scheme/network
   * @example "invalid_requirements" - Malformed requirements
   * @example "verification_failed" - Cryptographic verification failed
   */
  invalidReason?: string;
  /**
   * Human-readable error message if invalid.
   * Provides more context than invalidReason.
   */
  invalidMessage?: string;
  /** The payer address, if determinable */
  payer?: string;
  /** Extension-specific response data */
  extensions?: Record<string, unknown>;
}

/**
 * Settle response from facilitator.
 * Indicates whether a payment was successfully settled (finalized).
 */
export interface SettleResponse {
  /** Whether settlement succeeded */
  success: boolean;
  /**
   * Machine-readable error code if failed.
   * @example "scheme_mismatch" - Wrong scheme/network
   * @example "settlement_failed" - Settlement could not complete
   */
  errorReason?: string;
  /** Human-readable error message if failed */
  errorMessage?: string;
  /** The payer address, if determinable */
  payer?: string;
  /** The transaction hash/identifier */
  transaction: string;
  /** The network where settlement occurred */
  network: Network;
  /** Extension-specific response data */
  extensions?: Record<string, unknown>;
}

/**
 * Money parser function type.
 * Converts a decimal amount to an AssetAmount.
 * @param amount - The decimal amount (e.g., 1.50 for $1.50)
 * @param network - The network identifier for context
 * @returns AssetAmount or null to try next parser in chain
 */
export type MoneyParser = (amount: number, network: Network) => Promise<AssetAmount | null>;

/**
 * Context passed to createPaymentPayload.
 * Contains server-declared extensions that the client may respond to.
 */
export interface PaymentPayloadContext {
  /** Extensions declared by the server in PaymentRequired */
  extensions?: Record<string, unknown>;
}

/**
 * Result of createPaymentPayload.
 * Contains the x402 version, payload data, and optional extensions.
 */
export type PaymentPayloadResult = Pick<PaymentPayload, "x402Version" | "payload"> & {
  /** Extension data to merge with server extensions */
  extensions?: Record<string, unknown>;
};

/**
 * SchemeNetworkServer interface - for resource servers.
 * Used by servers to parse prices and enhance payment requirements.
 */
export interface SchemeNetworkServer {
  /** The payment scheme identifier (e.g., "exact") */
  readonly scheme: string;
  /**
   * Parse a user-friendly price to scheme-specific amount and asset.
   * @param price - User-friendly price (e.g., "$0.10", AssetAmount)
   * @param network - The network identifier
   * @returns The parsed asset amount
   */
  parsePrice(price: Price, network: Network): Promise<AssetAmount>;
  /**
   * Enhance payment requirements with scheme-specific data.
   * @param paymentRequirements - Base requirements
   * @param supportedKind - Facilitator's supported kind info
   * @param facilitatorExtensions - Extension keys supported by facilitator
   * @returns Enhanced requirements ready for client
   */
  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    facilitatorExtensions: string[],
  ): Promise<PaymentRequirements>;
}

/**
 * SchemeNetworkFacilitator interface - for facilitators.
 * Used by facilitator services to verify and settle payments.
 */
export interface SchemeNetworkFacilitator {
  /** The payment scheme identifier (e.g., "exact") */
  readonly scheme: string;
  /**
   * CAIP family pattern for grouping signers.
   * @example "eip155:*" - All EVM chains
   * @example "nano:*" - All Nano networks
   */
  readonly caipFamily: string;
  /**
   * Returns support information for the facilitator.
   */
  getSupported(): Promise<SupportedResponse>;
  /**
   * Get mechanism-specific extra data for supported kinds endpoint.
   * @param network - The network identifier
   * @returns Extra data or undefined
   */
  getExtra(network: Network): Record<string, unknown> | undefined;
  /**
   * Get signer addresses for the supported response.
   * Used to help clients understand which addresses might sign/pay.
   * @param network - The network identifier
   * @returns Array of signer addresses (empty for feeless chains like Nano)
   */
  getSigners(network: Network): string[];
  /**
   * Verify a payment proof.
   * @param payload - The payment payload
   * @param requirements - The payment requirements
   * @param context - Facilitator context with extensions
   * @returns Verification result
   */
  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    context?: FacilitatorContext,
  ): Promise<VerifyResponse>;
  /**
   * Settle (finalize) a payment.
   * Marks the payment as spent to prevent double-spending.
   * @param payload - The payment payload
   * @param requirements - The payment requirements
   * @param context - Facilitator context with extensions
   * @returns Settlement result
   */
  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    context?: FacilitatorContext,
  ): Promise<SettleResponse>;
}

/**
 * SchemeNetworkClient interface - for clients.
 * Used by clients to create payment payloads.
 */
export interface SchemeNetworkClient {
  /** The payment scheme identifier (e.g., "exact") */
  readonly scheme: string;
  /**
   * Create a payment payload for the given requirements.
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - The payment requirements to satisfy
   * @param context - Context with server-declared extensions
   * @returns The payment payload result
   */
  createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
    context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult>;
}
