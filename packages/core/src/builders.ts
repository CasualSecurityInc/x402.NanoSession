import type {
  Network,
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  ResourceInfo
} from './types.js';
import { ASSET, NETWORK, SCHEME } from './constants.js';
import { assertValidPaymentRequirements } from './utils.js';

export interface CreatePaymentRequiredArgs {
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  error?: string;
  extensions?: Record<string, unknown>;
}

export interface CreatePaymentPayloadArgs {
  accepted: PaymentRequirements;
  proof: string;
  signature?: string;
  resource?: ResourceInfo;
  extensions?: Record<string, unknown>;
}

export interface CreatePaymentRequirementsArgs {
  payTo: string;
  maxTimeoutSeconds: number;
  id: string;
  tag: number;
  resourceAmountRaw: string;
  tagAmountRaw: string;
  expiresAt: string;
  amount?: string;
  scheme?: string;
  network?: Network;
  asset?: string;
}

/**
 * Creates canonical NanoSession payment requirements and enforces
 * `amount = resourceAmountRaw + tagAmountRaw`.
 */
export function createPaymentRequirements(args: CreatePaymentRequirementsArgs): PaymentRequirements {
  const computedAmount = (
    BigInt(args.resourceAmountRaw) +
    BigInt(args.tagAmountRaw)
  ).toString();
  const resolvedAmount = args.amount ?? computedAmount;

  if (resolvedAmount !== computedAmount) {
    throw new Error(
      `Invalid requirements amount invariant: expected ${computedAmount}, got ${resolvedAmount}`
    );
  }

  const requirements: PaymentRequirements = {
    scheme: args.scheme ?? SCHEME,
    network: (args.network ?? NETWORK) as Network,
    asset: args.asset ?? ASSET,
    amount: resolvedAmount,
    payTo: args.payTo,
    maxTimeoutSeconds: args.maxTimeoutSeconds,
    extra: {
      nanoSession: {
        id: args.id,
        tag: args.tag,
        resourceAmountRaw: args.resourceAmountRaw,
        tagAmountRaw: args.tagAmountRaw,
        expiresAt: args.expiresAt
      }
    }
  };

  assertValidPaymentRequirements(requirements);
  return requirements;
}

export interface CreateSignatureRequirementsArgs {
  /** Destination account address */
  payTo: string;
  /** Maximum time in seconds to complete payment */
  maxTimeoutSeconds: number;
  /** Amount to pay in raw (clean resource price — no tagging) */
  amount: string;
  /** The canonical URL for signature binding (prevents replay attacks across different endpoints) */
  url: string;
  /** Template describing what the client must sign (default: "block_hash+url") */
  messageToSign?: string;
  scheme?: string;
  network?: Network;
  asset?: string;
}

/**
 * Creates canonical nanoSignature (stateless) payment requirements.
 * No session ID, no tag — the amount is the clean resource price.
 * Each variant MUST be a separate PaymentRequirements in the accepts array.
 */
export function createSignatureRequirements(args: CreateSignatureRequirementsArgs): PaymentRequirements {
  if (!args.amount || BigInt(args.amount) <= 0n) {
    throw new Error('Invalid signature requirements: amount must be positive');
  }

  if (!args.url || args.url.trim() === '') {
    throw new Error('Invalid signature requirements: url is required for replay protection');
  }

  const requirements: PaymentRequirements = {
    scheme: args.scheme ?? SCHEME,
    network: (args.network ?? NETWORK) as Network,
    asset: args.asset ?? ASSET,
    amount: args.amount,
    payTo: args.payTo,
    maxTimeoutSeconds: args.maxTimeoutSeconds,
    extra: {
      nanoSignature: {
        url: args.url,
        messageToSign: args.messageToSign ?? 'block_hash+url'
      }
    }
  };

  return requirements;
}

/**
 * Creates a canonical x402 PaymentRequired payload and validates all requirements.
 */
export function createPaymentRequired(args: CreatePaymentRequiredArgs): PaymentRequired {
  for (const requirement of args.accepts) {
    assertValidPaymentRequirements(requirement);
  }

  return {
    x402Version: 2,
    ...(args.error ? { error: args.error } : {}),
    resource: args.resource,
    accepts: args.accepts,
    ...(args.extensions ? { extensions: args.extensions } : {})
  };
}

/**
 * Creates a canonical x402 PaymentPayload and validates the accepted requirements.
 */
export function createPaymentPayload(args: CreatePaymentPayloadArgs): PaymentPayload {
  assertValidPaymentRequirements(args.accepted);
  const proof = args.proof.trim();
  if (!proof) {
    throw new Error('Invalid payment proof: missing payload.proof');
  }

  return {
    x402Version: 2,
    ...(args.resource ? { resource: args.resource } : {}),
    accepted: args.accepted,
    payload: { 
      proof,
      ...(args.signature ? { signature: args.signature } : {})
    },
    ...(args.extensions ? { extensions: args.extensions } : {})
  };
}

/**
 * Lightweight runtime validation for decoded payment payloads.
 */
export function assertValidPaymentPayload(payload: PaymentPayload): void {
  if (payload.x402Version !== 2) {
    throw new Error(`Unsupported x402 version: ${payload.x402Version}`);
  }
  assertValidPaymentRequirements(payload.accepted);
  if (!payload.payload?.proof || !payload.payload.proof.trim()) {
    throw new Error('Invalid payment proof: missing payload.proof');
  }
}
