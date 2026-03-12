/**
 * NanoSession server implementation for the Exact payment scheme.
 * Implements SchemeNetworkServer interface for x402 compatibility.
 */

import type {
  SchemeNetworkServer,
  Price,
  Network,
  AssetAmount,
  PaymentRequirements,
  MoneyParser
} from './types.js';
import { SCHEME, NETWORK, ASSET } from '@nanosession/core';
import type { NanoSessionFacilitatorHandler } from '@nanosession/facilitator';
import { x402ContextStorage } from './context.js';
import { parseMoneyToRawNano, isAssetAmount } from './converter.js';

/**
 * NanoSession server implementation for the Exact payment scheme.
 * Handles price parsing and payment requirement enhancement for Nano payments.
 */
export class ExactNanoScheme implements SchemeNetworkServer {
  readonly scheme = SCHEME;
  private moneyParsers: MoneyParser[] = [];
  private handler?: NanoSessionFacilitatorHandler;

  /**
   * Creates a new ExactNanoScheme instance.
   * 
   * @param handler - Optional facilitator handler for dynamic requirement generation
   */
  constructor(handler?: NanoSessionFacilitatorHandler) {
    this.handler = handler;
  }

  /**
   * Register a custom money parser in the parser chain.
   * Multiple parsers can be registered - they will be tried in registration order.
   * Each parser receives a decimal amount (e.g., 1.50 for $1.50).
   * If a parser returns null, the next parser in the chain will be tried.
   * The default parser is always the final fallback.
   *
   * @param parser - Custom function to convert amount to AssetAmount (or null to skip)
   * @returns The server instance for chaining
   */
  registerMoneyParser(parser: MoneyParser): ExactNanoScheme {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parses a price into an asset amount.
   * If price is already an AssetAmount, returns it directly.
   * If price is Money (string | number), parses to decimal and tries custom parsers.
   * Falls back to default conversion if all custom parsers return null.
   *
   * @param price - The price to parse
   * @param network - The network to use (must be nano:mainnet or compatible)
   * @returns Promise that resolves to the parsed asset amount
   * @throws Error if network is not supported or price format is invalid
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    // Validate network
    if (!network.startsWith('nano:')) {
      throw new Error(`Unsupported network for NanoSession: ${network}. Expected nano:*`);
    }

    // If already an AssetAmount, validate and return it
    if (isAssetAmount(price)) {
      if (!price.asset) {
        throw new Error(`Asset must be specified for AssetAmount on network ${network}`);
      }
      return {
        amount: price.amount,
        asset: price.asset,
        extra: price.extra || {},
      };
    }

    // Parse Money to decimal number
    const amount = this.parseMoneyToDecimal(price);

    // Try each custom money parser in order
    for (const parser of this.moneyParsers) {
      const result = await parser(amount, network);
      if (result !== null) {
        return result;
      }
    }

    // All custom parsers returned null, use default conversion
    return this.defaultMoneyConversion(amount, network);
  }

  /**
   * Build payment requirements for this scheme/network combination.
   * For NanoSession, this uses the facilitator handler to generate
   * session-specific metadata (tags, IDs) or signature messages.
   *
   * @param paymentRequirements - The base payment requirements
   * @param supportedKind - The supported kind from facilitator (unused)
   * @param extensionKeys - Extension keys supported by the facilitator (unused)
   * @returns Payment requirements ready to be sent to clients
   */
  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    extensionKeys: string[],
  ): Promise<PaymentRequirements> {
    // Mark unused parameters to satisfy linter
    void supportedKind;
    void extensionKeys;

    if (!this.handler) {
      // If no handler is provided, we can't generate dynamic requirements
      return paymentRequirements;
    }

    // Track 2: nanoSignature (Stateless)
    if (paymentRequirements.extra?.nanoSignature) {
      return this.handler.getSignatureRequirements({
        amount: paymentRequirements.amount,
        payTo: paymentRequirements.payTo,
        maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds,
      });
    }

    // Track 1: nanoSession (Stateful)
    // Check if we have a session ID in the context (Session Recovery)
    const context = x402ContextStorage.getStore();
    if (context?.sessionId) {
      const recovered = this.handler.getStoredRequirements(context.sessionId);
      if (recovered) {
        return recovered;
      } else {
        console.warn(`[x402-adapter] Session ${context.sessionId} not found in registry (expired or reloaded)`);
      }
    }

    // Normal generation
    return this.handler.getRequirements({
      resourceAmountRaw: paymentRequirements.amount,
      payTo: paymentRequirements.payTo,
      maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds,
    });
  }

  /**
   * Parse Money (string | number) to a decimal number.
   * Handles formats like "$1.50", "1.50", 1.50, etc.
   *
   * @param money - The money value to parse
   * @returns Decimal number
   * @throws Error if format is invalid
   */
  private parseMoneyToDecimal(money: string | number): number {
    if (typeof money === 'number') {
      return money;
    }

    // Remove $ sign and whitespace, then parse
    const cleanMoney = money.replace(/^\$/, '').trim();
    const amount = parseFloat(cleanMoney);

    if (isNaN(amount)) {
      throw new Error(`Invalid money format: ${money}`);
    }

    return amount;
  }

  /**
   * Default money conversion implementation.
   * Converts decimal amount to Nano raw amount.
   * Nano has 30 decimal places.
   *
   * @param amount - The decimal amount (e.g., 0.001 for 0.001 XNO)
   * @param network - The network to use
   * @returns The parsed asset amount in Nano raw units
   */
  private defaultMoneyConversion(amount: number, network: Network): AssetAmount {
    // Validate network
    if (!network.startsWith('nano:')) {
      throw new Error(`Unsupported network for NanoSession: ${network}`);
    }

    // Convert to raw (Nano has 30 decimals)
    // Use string to prevent precision loss for large amounts
    const rawAmount = parseMoneyToRawNano(amount.toString());

    return {
      amount: rawAmount,
      asset: ASSET,
      extra: {
        decimals: 30,
        network: network,
      },
    };
  }
}
