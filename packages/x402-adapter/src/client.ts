/**
 * NanoSession client implementation for the Exact payment scheme.
 * Wraps NanoSessionPaymentHandler to implement SchemeNetworkClient interface.
 */

import type { NanoRpcClient } from '@nanosession/rpc';
import { NanoSessionPaymentHandler } from '@nanosession/client';
import { SCHEME, NETWORK } from '@nanosession/core';
import type {
  SchemeNetworkClient,
  PaymentRequirements,
  PaymentPayloadResult,
  PaymentPayloadContext
} from './types.js';
import { toNanoRequirements } from './converter.js';

/**
 * Configuration options for ExactNanoClient
 */
export interface ExactNanoClientConfig {
  /** Nano RPC client instance */
  rpcClient: NanoRpcClient;
  /** The 64-character hex seed used to derive accounts */
  seed: string;
  /** Optional limit on how much can be spent in raw (daily process lifetime) */
  maxSpend?: string;
  /** Nano account index used for sending (default: 0) */
  accountIndex?: number;
  /** Confirmation wait timeout in ms (default: 30s) */
  confirmationTimeoutMs?: number;
}

/**
 * NanoSession client implementation for the Exact payment scheme.
 * Wraps NanoSessionPaymentHandler to create payment payloads.
 */
export class ExactNanoClient implements SchemeNetworkClient {
  readonly scheme = SCHEME;
  private underlying: NanoSessionPaymentHandler;

  /**
   * Creates a new ExactNanoClient instance.
   *
   * @param config - Configuration for the client
   */
  constructor(config: ExactNanoClientConfig) {
    this.underlying = new NanoSessionPaymentHandler({
      rpcClient: config.rpcClient,
      seed: config.seed,
      maxSpend: config.maxSpend,
      accountIndex: config.accountIndex,
      confirmationTimeoutMs: config.confirmationTimeoutMs,
    });
  }

  /**
   * Creates a payment payload for the Exact scheme.
   * Executes the Nano payment and returns the block hash as proof.
   *
   * @param x402Version - The x402 protocol version (must be 2)
   * @param paymentRequirements - The payment requirements
   * @param _context - Optional context with server-declared extensions (unused)
   * @returns Promise resolving to a payment payload result
   * @throws Error if requirements don't match NanoSession scheme
   */
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
    _context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult> {
    // Validate x402 version
    if (x402Version !== 2) {
      throw new Error(`Unsupported x402 version: ${x402Version}. Only version 2 is supported.`);
    }

    // Validate scheme and network
    if (paymentRequirements.scheme !== SCHEME) {
      throw new Error(
        `Scheme mismatch: expected ${SCHEME}, got ${paymentRequirements.scheme}`
      );
    }

    if (paymentRequirements.network !== NETWORK) {
      throw new Error(
        `Network mismatch: expected ${NETWORK}, got ${paymentRequirements.network}`
      );
    }

    // Convert x402 requirements to NanoSession requirements
    const nanoReq = toNanoRequirements(paymentRequirements);
    if (!nanoReq) {
      throw new Error('Failed to convert requirements to NanoSession format');
    }

    // Use underlying handler to execute payment
    // Create a mock context since handle() expects it but we don't use it
    const execers = await this.underlying.handle({}, [nanoReq]);

    if (execers.length === 0) {
      throw new Error('No payment execers returned from handler');
    }

    // Execute the payment
    const execer = execers[0];
    const result = await execer.exec();

    return {
      x402Version: 2,
      payload: {
        proof: result.payload.payload.proof,
      },
    };
  }

  /**
   * Get the underlying NanoSessionPaymentHandler.
   * Use this to access advanced features like checking spend limits.
   *
   * @returns The underlying handler instance
   */
  getUnderlyingHandler(): NanoSessionPaymentHandler {
    return this.underlying;
  }
}
