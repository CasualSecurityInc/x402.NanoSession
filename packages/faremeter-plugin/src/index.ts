/**
 * @nanosession/faremeter
 *
 * Faremeter adapter for NanoSession x402 payments.
 *
 * This package bridges NanoSession's payment handlers to the Faremeter
 * middleware interface, enabling Nano payments in any Faremeter-compatible
 * x402 server or client.
 *
 * @packageDocumentation
 *
 * @example Server-side (Facilitator)
 * ```typescript
 * import { createFacilitatorHandler } from '@nanosession/faremeter';
 * import { NanoRpcClient } from '@nanosession/rpc';
 *
 * const rpcClient = new NanoRpcClient({ endpoints: ['https://rpc.nano.to'] });
 * const facilitator = createFacilitatorHandler({
 *   rpcClient,
 *   payTo: 'nano_your_address',
 *   defaultAmount: '1000000000000000000000000', // 0.001 XNO
 * });
 * ```
 *
 * @example Client-side (Payment)
 * ```typescript
 * import { createPaymentHandler } from '@nanosession/faremeter';
 * import { NanoRpcClient } from '@nanosession/rpc';
 *
 * const rpcClient = new NanoRpcClient({ endpoints: ['https://rpc.nano.to'] });
 * const paymentHandler = createPaymentHandler({
 *   rpcClient,
 *   seed: process.env.NANO_WALLET_SEED!,
 * });
 * ```
 */

export { createFacilitatorHandler, type FacilitatorOptions } from './facilitator.js';
export { createPaymentHandler, type PaymentHandlerOptions } from './client.js';
