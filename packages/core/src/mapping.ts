/**
 * Backward-compatible aliases for the active builder encode/decode helpers.
 */

export {
  encodePaymentRequired,
  decodePaymentRequired,
  encodePaymentPayload as encodePaymentSignature,
  decodePaymentPayload as decodePaymentSignature,
  encodePaymentResponse,
  decodePaymentResponse,
} from './builders.js';
