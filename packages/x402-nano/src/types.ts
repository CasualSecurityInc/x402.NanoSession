/**
 * x402 type definitions for NanoSession adapter
 * These match the official x402 specification types
 */

/** Price can be a string (e.g., "$0.10"), number, or AssetAmount object */
export type Price = string | number | AssetAmount;

/** Network identifier in CAIP-2 format (e.g., "nano:mainnet") */
export type Network = string;

/** Asset amount with asset identifier */
export interface AssetAmount {
  amount: string;
  asset: string;
  extra?: Record<string, unknown>;
}

/** Payment requirements as defined by x402 */
export interface PaymentRequirements {
  scheme: string;
  network: Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

/** Payment payload as defined by x402 */
export interface PaymentPayload {
  x402Version: number;
  payload: {
    proof: string;
    [key: string]: unknown;
  };
  extra?: Record<string, unknown>;
}

/** Facilitator extension interface */
export interface FacilitatorExtension {
  key: string;
  // Extension-specific methods
}

/** Context passed to facilitator verify/settle methods */
export interface FacilitatorContext {
  getExtension<T extends FacilitatorExtension = FacilitatorExtension>(key: string): T | undefined;
}

/** Verify response from facilitator */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
  extensions?: Record<string, unknown>;
}

/** Settle response from facilitator */
export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  payer?: string;
  transaction: string;
  network: Network;
  extensions?: Record<string, unknown>;
}

/** Money parser function type */
export type MoneyParser = (amount: number, network: Network) => Promise<AssetAmount | null>;

/** Context passed to createPaymentPayload */
export interface PaymentPayloadContext {
  extensions?: Record<string, unknown>;
}

/** Result of createPaymentPayload */
export type PaymentPayloadResult = Pick<PaymentPayload, "x402Version" | "payload"> & {
  extensions?: Record<string, unknown>;
};

/** SchemeNetworkServer interface - for resource servers */
export interface SchemeNetworkServer {
  readonly scheme: string;
  parsePrice(price: Price, network: Network): Promise<AssetAmount>;
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

/** SchemeNetworkFacilitator interface - for facilitators */
export interface SchemeNetworkFacilitator {
  readonly scheme: string;
  readonly caipFamily: string;
  getExtra(network: Network): Record<string, unknown> | undefined;
  getSigners(network: string): string[];
  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    context?: FacilitatorContext,
  ): Promise<VerifyResponse>;
  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    context?: FacilitatorContext,
  ): Promise<SettleResponse>;
}

/** SchemeNetworkClient interface - for clients */
export interface SchemeNetworkClient {
  readonly scheme: string;
  createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
    context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult>;
}
