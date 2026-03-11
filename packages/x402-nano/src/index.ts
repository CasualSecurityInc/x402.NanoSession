/**
 * @x402/nano
 * x402 adapter for NanoSession - Nano cryptocurrency payment mechanism
 * 
 * This package provides x402-compatible implementations for the NanoSession protocol,
 * allowing Nano cryptocurrency to be used in x402 payment flows.
 * 
 * @example
 * ```typescript
 * // Server-side usage
 * import { ExactNanoScheme } from '@x402/nano/server';
 * 
 * const scheme = new ExactNanoScheme();
 * const assetAmount = await scheme.parsePrice("$0.001", "nano:mainnet");
 * ```
 * 
 * @example
 * ```typescript
 * // Facilitator usage
 * import { ExactNanoFacilitator } from '@x402/nano/facilitator';
 * 
 * const facilitator = new ExactNanoFacilitator({
 *   rpcClient: nanoRpcClient,
 * });
 * 
 * const verifyResult = await facilitator.verify(payload, requirements);
 * ```
 * 
 * @example
 * ```typescript
 * // Client usage
 * import { ExactNanoClient } from '@x402/nano/client';
 * 
 * const client = new ExactNanoClient({
 *   rpcClient: nanoRpcClient,
 *   seed: 'your-hex-seed',
 * });
 * 
 * const paymentPayload = await client.createPaymentPayload(2, requirements);
 * ```
 */

// Re-export types
export type {
  // x402 types
  Price,
  Network,
  AssetAmount,
  PaymentRequirements,
  PaymentPayload,
  FacilitatorContext,
  VerifyResponse,
  SettleResponse,
  MoneyParser,
  PaymentPayloadContext,
  PaymentPayloadResult,
  SchemeNetworkServer,
  SchemeNetworkFacilitator,
  SchemeNetworkClient,
} from './types.js';

// Re-export converter utilities
export {
  toNanoRequirements,
  toX402Requirements,
  toNanoPayload,
  toX402Payload,
  parseMoneyToRawNano,
  isAssetAmount,
  isNanoSessionRequirements,
  getDefaultNanoAssetAmount,
} from './converter.js';

// Version
export const VERSION = '0.1.0';
