/**
 * Payment-Identifier Extension for x402 V2
 *
 * Utility helpers for the `payment-identifier` extension, which provides
 * client-generated idempotency keys for deduplicating payment requests.
 *
 * This module mirrors the Coinbase x402 extension API:
 * - Server declares support via `declarePaymentIdentifierExtension()`
 * - Client appends an id via `appendPaymentIdentifierToExtensions()`
 * - Server extracts/validates via `extractPaymentIdentifier()` etc.
 *
 * SECURITY NOTE: This extension is orthogonal to NanoSession's anti-replay
 * mechanisms (spent set, session binding, signature binding). It operates
 * at the HTTP request layer for retry deduplication only.
 *
 * @see https://docs.x402.org/ — Extension: payment-identifier
 */

import { randomBytes } from 'crypto';
import type { PaymentPayload } from './types.js';

// ── Constants ────────────────────────────────────────────────────────

/** Extension key for the payment-identifier extension */
export const PAYMENT_IDENTIFIER = 'payment-identifier';

/** Minimum length for a payment identifier */
export const PAYMENT_ID_MIN_LENGTH = 16;

/** Maximum length for a payment identifier */
export const PAYMENT_ID_MAX_LENGTH = 128;

/** Pattern for valid payment identifier characters (alphanumeric, hyphens, underscores) */
export const PAYMENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// ── Types ────────────────────────────────────────────────────────────

/** Payment identifier info containing the required flag and optional client-provided ID */
export interface PaymentIdentifierInfo {
  /** Whether the server requires clients to include a payment identifier */
  required: boolean;
  /** Client-provided unique identifier for idempotency (16–128 chars, alphanumeric/hyphens/underscores) */
  id?: string;
}

/** JSON Schema type for the payment-identifier extension */
export interface PaymentIdentifierSchema {
  $schema: 'https://json-schema.org/draft/2020-12/schema';
  type: 'object';
  properties: {
    required: { type: 'boolean' };
    id: { type: 'string'; minLength: number; maxLength: number; pattern: string };
  };
  required: ['required'];
}

/** Payment identifier extension object (info + schema) */
export interface PaymentIdentifierExtension {
  info: PaymentIdentifierInfo;
  schema: PaymentIdentifierSchema;
}

/** Result of payment identifier validation */
export interface PaymentIdentifierValidationResult {
  valid: boolean;
  errors?: string[];
}

// ── Schema ───────────────────────────────────────────────────────────

/** JSON Schema for validating payment identifier info (Draft 2020-12) */
export const paymentIdentifierSchema: PaymentIdentifierSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    required: { type: 'boolean' },
    id: {
      type: 'string',
      minLength: PAYMENT_ID_MIN_LENGTH,
      maxLength: PAYMENT_ID_MAX_LENGTH,
      pattern: '^[a-zA-Z0-9_-]+$'
    }
  },
  required: ['required']
};

// ── Utility functions ────────────────────────────────────────────────

/**
 * Generates a unique payment identifier.
 * @param prefix Optional prefix (default: "pay_")
 * @returns A unique payment identifier string (prefix + 32 hex chars)
 */
export function generatePaymentId(prefix: string = 'pay_'): string {
  const hex = randomBytes(16).toString('hex');
  return `${prefix}${hex}`;
}

/**
 * Validates that a payment ID meets format requirements.
 * @param id The payment ID to validate
 * @returns True if valid (16–128 chars, alphanumeric/hyphens/underscores)
 */
export function isValidPaymentId(id: string): boolean {
  if (typeof id !== 'string') return false;
  if (id.length < PAYMENT_ID_MIN_LENGTH || id.length > PAYMENT_ID_MAX_LENGTH) return false;
  return PAYMENT_ID_PATTERN.test(id);
}

// ── Type guard ───────────────────────────────────────────────────────

/**
 * Type guard: checks if an object is a valid payment-identifier extension structure.
 * Checks basic structure only (info.required boolean); does NOT validate id format.
 */
export function isPaymentIdentifierExtension(
  extension: unknown
): extension is PaymentIdentifierExtension {
  if (!extension || typeof extension !== 'object') return false;
  const ext = extension as Partial<PaymentIdentifierExtension>;
  if (!ext.info || typeof ext.info !== 'object') return false;
  return typeof (ext.info as Partial<PaymentIdentifierInfo>).required === 'boolean';
}

// ── Server helpers ───────────────────────────────────────────────────

/**
 * Declares the payment-identifier extension for inclusion in PaymentRequired.extensions.
 *
 * @param required Whether clients must provide a payment identifier (default: false)
 * @returns A PaymentIdentifierExtension ready for `extensions[PAYMENT_IDENTIFIER]`
 *
 * @example
 * ```ts
 * const paymentRequired = createPaymentRequired({
 *   resource: { url },
 *   accepts: [requirements],
 *   extensions: {
 *     [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension()
 *   }
 * });
 * ```
 */
export function declarePaymentIdentifierExtension(
  required: boolean = false
): PaymentIdentifierExtension {
  return {
    info: { required },
    schema: paymentIdentifierSchema
  };
}

// ── Client helpers ───────────────────────────────────────────────────

/**
 * Appends a payment identifier to the extensions object if the server declared support.
 *
 * Reads the server's `payment-identifier` declaration from extensions and appends the
 * client's ID. If the extension is not present (server didn't declare it), returns
 * extensions unchanged.
 *
 * @param extensions The extensions object from PaymentRequired (modified in place)
 * @param id Optional custom payment ID (auto-generated if omitted)
 * @returns The modified extensions object (same reference)
 * @throws If the provided ID is invalid
 */
export function appendPaymentIdentifierToExtensions(
  extensions: Record<string, unknown>,
  id?: string
): Record<string, unknown> {
  const extension = extensions[PAYMENT_IDENTIFIER];
  if (!isPaymentIdentifierExtension(extension)) return extensions;

  const paymentId = id ?? generatePaymentId();
  if (!isValidPaymentId(paymentId)) {
    throw new Error(
      `Invalid payment ID: "${paymentId}". ` +
      'ID must be 16-128 characters containing only alphanumeric characters, hyphens, and underscores.'
    );
  }

  extension.info.id = paymentId;
  return extensions;
}

// ── Extraction / validation ──────────────────────────────────────────

/**
 * Extracts the payment identifier from a PaymentPayload.
 * @param paymentPayload The payment payload to extract from
 * @param validate Whether to validate the ID format before returning (default: true)
 * @returns The payment ID string, or null if not present or invalid
 */
export function extractPaymentIdentifier(
  paymentPayload: PaymentPayload,
  validate: boolean = true
): string | null {
  if (!paymentPayload.extensions) return null;

  const extension = paymentPayload.extensions[PAYMENT_IDENTIFIER];
  if (!extension || typeof extension !== 'object') return null;

  const ext = extension as Partial<PaymentIdentifierExtension>;
  if (!ext.info || typeof ext.info !== 'object') return null;

  const info = ext.info as Partial<PaymentIdentifierInfo>;
  if (typeof info.id !== 'string') return null;
  if (validate && !isValidPaymentId(info.id)) return null;

  return info.id;
}

/**
 * Checks if a PaymentPayload contains a payment-identifier extension.
 */
export function hasPaymentIdentifier(paymentPayload: PaymentPayload): boolean {
  return !!(paymentPayload.extensions && paymentPayload.extensions[PAYMENT_IDENTIFIER]);
}

/**
 * Checks if the server requires a payment identifier.
 * @param extension The payment-identifier extension object from PaymentRequired
 */
export function isPaymentIdentifierRequired(extension: unknown): boolean {
  if (!isPaymentIdentifierExtension(extension)) return false;
  return extension.info.required === true;
}

/**
 * Validates that a payment identifier is provided when required by the server.
 *
 * @param paymentPayload The client's payment payload
 * @param serverRequired Whether the server requires a payment identifier
 * @returns Validation result — invalid if required but not provided or malformed
 */
export function validatePaymentIdentifierRequirement(
  paymentPayload: PaymentPayload,
  serverRequired: boolean
): PaymentIdentifierValidationResult {
  if (!serverRequired) return { valid: true };

  const id = extractPaymentIdentifier(paymentPayload, false);
  if (!id) {
    return {
      valid: false,
      errors: ['Server requires a payment identifier but none was provided']
    };
  }

  if (!isValidPaymentId(id)) {
    return {
      valid: false,
      errors: [
        'Invalid payment ID format. ID must be 16-128 characters containing only alphanumeric characters, hyphens, and underscores.'
      ]
    };
  }

  return { valid: true };
}

/**
 * Validates a payment-identifier extension object structure and id format.
 *
 * @param extension The extension object to validate
 * @returns Validation result with errors if invalid
 */
export function validatePaymentIdentifier(
  extension: unknown
): PaymentIdentifierValidationResult {
  if (!extension || typeof extension !== 'object') {
    return { valid: false, errors: ['Extension must be an object'] };
  }

  const ext = extension as Partial<PaymentIdentifierExtension>;
  if (!ext.info || typeof ext.info !== 'object') {
    return { valid: false, errors: ["Extension must have an 'info' property"] };
  }

  const info = ext.info as Partial<PaymentIdentifierInfo>;
  if (typeof info.required !== 'boolean') {
    return { valid: false, errors: ["Extension info must have a 'required' boolean property"] };
  }

  if (info.id !== undefined && typeof info.id !== 'string') {
    return { valid: false, errors: ["Extension info 'id' must be a string if provided"] };
  }

  if (info.id !== undefined && !isValidPaymentId(info.id)) {
    return {
      valid: false,
      errors: [
        'Invalid payment ID format. ID must be 16-128 characters containing only alphanumeric characters, hyphens, and underscores.'
      ]
    };
  }

  return { valid: true };
}
