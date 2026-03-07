/**
 * Utilities for encoding and decoding standard x402 V2 JSON payloads
 */

import type { PaymentRequired, PaymentPayload } from './types.js';

/**
 * Encodes a PaymentRequired object into a Base64 string for the PAYMENT-REQUIRED header
 */
export function encodePaymentRequired(payload: PaymentRequired): string {
  // Ensure the object has the correct x402Version
  const standardPayload = { ...payload, x402Version: 2 };
  return Buffer.from(JSON.stringify(standardPayload)).toString('base64');
}

/**
 * Decodes a Base64 string from the PAYMENT-REQUIRED header into a PaymentRequired object
 */
export function decodePaymentRequired(base64Str: string): PaymentRequired {
  const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
  const payload = JSON.parse(jsonStr) as PaymentRequired;

  if (payload.x402Version !== 2) {
    throw new Error(`Unsupported x402 version: ${payload.x402Version}. Expected 2.`);
  }

  return payload;
}

/**
 * Encodes a PaymentPayload object into a Base64 string for the PAYMENT-SIGNATURE header
 */
export function encodePaymentSignature(payload: PaymentPayload): string {
  // Ensure the object has the correct x402Version
  const standardPayload = { ...payload, x402Version: 2 };
  return Buffer.from(JSON.stringify(standardPayload)).toString('base64');
}

/**
 * Decodes a Base64 string from the PAYMENT-SIGNATURE header into a PaymentPayload object
 */
export function decodePaymentSignature(base64Str: string): PaymentPayload {
  const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
  const payload = JSON.parse(jsonStr) as PaymentPayload;

  if (payload.x402Version !== 2) {
    throw new Error(`Unsupported x402 version: ${payload.x402Version}. Expected 2.`);
  }

  return payload;
}
