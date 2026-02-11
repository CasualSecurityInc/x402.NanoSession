/**
 * @nanosession/core
 * Core types, constants, and mapping for NanoSession x402 integration
 */

// Re-export from constants
export {
  TAG_MODULUS,
  SCHEME,
  NETWORK,
  ASSET,
  VERSION,
  DEFAULT_TIMEOUT_SECONDS
} from './constants.js';

// Re-export from types
export type {
  NanoSessionHeaders,
  NanoSessionExtra,
  PaymentRequirements,
  PaymentPayload
} from './types.js';

// Re-export from mapping
export {
  toX402Requirements,
  fromX402Requirements,
  toX402Payload
} from './mapping.js';
