/**
 * @nanosession/core
 * Core types, constants, and mapping for NanoSession x402 integration
 */

// Re-export from constants
export {
  TAG_MODULUS,
  TAG_MULTIPLIER,
  SCHEME,
  NETWORK,
  ASSET,
  VERSION,
  DEFAULT_TIMEOUT_SECONDS
} from './constants.js';

// Re-export from types
export type {
  NanoSessionExtra,
  NanoSignatureExtra,
  PaymentRequirements,
  PaymentPayload
} from './types.js';

// Re-export from mapping
export {
  encodePaymentRequired,
  decodePaymentRequired,
  encodePaymentSignature,
  decodePaymentSignature
} from './mapping.js';

export {
  createPaymentRequirements,
  createSignatureRequirements,
  createPaymentRequired,
  createPaymentPayload,
  assertValidPaymentPayload
} from './builders.js';

export {
  calculateTaggedAmount,
  deriveAddressFromSeed,
  assertValidRawAmount,
  assertValidPaymentRequirements
} from './utils.js';

// Re-export payment-identifier extension helpers
export {
  PAYMENT_IDENTIFIER,
  PAYMENT_ID_MIN_LENGTH,
  PAYMENT_ID_MAX_LENGTH,
  PAYMENT_ID_PATTERN,
  paymentIdentifierSchema,
  generatePaymentId,
  isValidPaymentId,
  isPaymentIdentifierExtension,
  declarePaymentIdentifierExtension,
  appendPaymentIdentifierToExtensions,
  extractPaymentIdentifier,
  hasPaymentIdentifier,
  isPaymentIdentifierRequired,
  validatePaymentIdentifierRequirement,
  validatePaymentIdentifier
} from './payment-identifier.js';

export type {
  PaymentIdentifierInfo,
  PaymentIdentifierExtension,
  PaymentIdentifierSchema,
  PaymentIdentifierValidationResult
} from './payment-identifier.js';
