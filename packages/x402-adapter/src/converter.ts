/**
 * Type conversion utilities between x402 and NanoSession types
 */

import type {
  PaymentRequirements as NanoRequirements,
  PaymentPayload as NanoPayload,
  NanoSessionExtra
} from '@nanosession/core';
import {
  createPaymentRequirements as createNanoRequirements,
  createPaymentPayload as createNanoPayload,
  SCHEME,
  NETWORK,
  ASSET
} from '@nanosession/core';
import type {
  PaymentRequirements as X402Requirements,
  PaymentPayload as X402Payload,
  AssetAmount
} from './types.js';

/**
 * Convert x402 PaymentRequirements to NanoSession PaymentRequirements
 */
export function toNanoRequirements(req: X402Requirements): NanoRequirements | null {
  const extra = req.extra?.nanoSession as NanoSessionExtra | undefined;
  if (!extra) return null;

  // Validate required fields
  if (
    extra.id === undefined ||
    extra.tag === undefined ||
    !extra.resourceAmountRaw ||
    !extra.tagAmountRaw
  ) {
    return null;
  }

  const expiresAt = typeof extra.expiresAt === 'string'
    ? extra.expiresAt
    : new Date(Date.now() + req.maxTimeoutSeconds * 1000).toISOString();

  return createNanoRequirements({
    payTo: req.payTo,
    maxTimeoutSeconds: req.maxTimeoutSeconds,
    id: extra.id,
    tag: extra.tag,
    resourceAmountRaw: extra.resourceAmountRaw,
    tagAmountRaw: extra.tagAmountRaw,
    amount: req.amount,
    expiresAt,
    scheme: req.scheme,
    network: req.network,
    asset: req.asset
  });
}

/**
 * Convert NanoSession PaymentRequirements to x402 PaymentRequirements
 */
export function toX402Requirements(req: NanoRequirements): X402Requirements {
  return {
    scheme: req.scheme,
    network: req.network,
    asset: req.asset,
    amount: req.amount,
    payTo: req.payTo,
    maxTimeoutSeconds: req.maxTimeoutSeconds,
    extra: {
      nanoSession: {
        id: req.extra.nanoSession.id,
        tag: req.extra.nanoSession.tag,
        resourceAmountRaw: req.extra.nanoSession.resourceAmountRaw,
        tagAmountRaw: req.extra.nanoSession.tagAmountRaw,
        expiresAt: req.extra.nanoSession.expiresAt,
      }
    }
  };
}

/**
 * Convert x402 PaymentPayload to NanoSession PaymentPayload
 */
export function toNanoPayload(
  payload: X402Payload,
  requirements: NanoRequirements
): NanoPayload | null {
  const proof = payload.payload.proof;
  if (!proof) return null;

  return createNanoPayload({
    accepted: requirements,
    proof
  });
}

/**
 * Convert NanoSession PaymentPayload to x402 PaymentPayload
 */
export function toX402Payload(payload: NanoPayload): X402Payload {
  return {
    x402Version: 2,
    payload: {
      proof: payload.payload.proof
    },
    extra: payload.extensions
  };
}

/**
 * Parse a price string (e.g., "$0.001") to raw Nano amount
 * Nano has 30 decimal places
 * Uses string parsing to avoid floating-point precision loss
 */
export function parseMoneyToRawNano(price: string): string {
  // Remove $ sign and whitespace
  const cleanPrice = price.replace(/^\$/, '').trim();
  
  // Handle empty string
  if (cleanPrice === '' || cleanPrice === '-') {
    throw new Error(`Invalid price format: ${price}`);
  }
  
  // Reject scientific notation
  if (cleanPrice.includes('e') || cleanPrice.includes('E')) {
    throw new Error(`Scientific notation not supported: ${price}`);
  }
  
  // Parse as string to preserve precision
  const [intPart = '0', decPart = ''] = cleanPrice.split('.');
  
  // Validate parts are numeric
  if (!/^-?\d*$/.test(intPart) || !/^\d*$/.test(decPart)) {
    throw new Error(`Invalid price format: ${price}`);
  }
  
  // Handle negative
  const isNegative = intPart.startsWith('-');
  const absIntPart = isNegative ? intPart.slice(1) : intPart;
  
  // Pad decimal to 30 places (Nano precision)
  const paddedDec = decPart.padEnd(30, '0').slice(0, 30);
  
  // Combine and convert to BigInt
  const rawStr = (absIntPart || '0') + paddedDec;
  const rawAmount = BigInt(rawStr);
  
  return isNegative ? (-rawAmount).toString() : rawAmount.toString();
}

/**
 * Check if a price is already an AssetAmount
 */
export function isAssetAmount(price: unknown): price is AssetAmount {
  return (
    typeof price === 'object' &&
    price !== null &&
    'amount' in price &&
    'asset' in price
  );
}

/**
 * Check if requirements match NanoSession scheme
 */
export function isNanoSessionRequirements(req: X402Requirements): boolean {
  return req.scheme === SCHEME && req.network === NETWORK;
}

/**
 * Get default Nano asset amount for a given price
 */
export function getDefaultNanoAssetAmount(price: string): AssetAmount {
  return {
    amount: parseMoneyToRawNano(price),
    asset: ASSET,
    extra: {
      decimals: 30
    }
  };
}
