/**
 * FacilitatorHandler implementation for x402/Faremeter compatibility
 * Handles nano-session payment verification and settlement
 */

import { SCHEME, NETWORK, ASSET } from '@nanosession/core';
import type { PaymentRequirements, PaymentPayload } from '@nanosession/core';
import type { NanoRpcClient } from '@nanosession/rpc';
import type { SpentSetStorage } from './spent-set.js';
import { InMemorySpentSet } from './spent-set.js';
import { randomBytes } from 'crypto';

/**
 * Configuration options for the handler
 */
export interface HandlerOptions {
  /** Nano RPC client instance */
  rpcClient: NanoRpcClient;
  /** Optional spent set storage (defaults to in-memory) */
  spentSet?: SpentSetStorage;
}

/**
 * Supported payment scheme information
 */
export interface SupportedScheme {
  /** x402 protocol version */
  x402Version: string;
  /** Payment scheme identifier */
  scheme: string;
  /** Network identifier (CAIP-2 format) */
  network: string;
}

/**
 * Result of payment verification
 */
export interface VerifyResult {
  /** Whether the payment is valid */
  isValid: boolean;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Result of payment settlement
 */
export interface SettleResult {
  /** Whether settlement succeeded */
  success: boolean;
  /** Transaction hash if successful */
  transactionHash?: string;
  /** Error message if settlement failed */
  error?: string;
}

/**
 * NanoSession Facilitator Handler
 * Implements x402/Faremeter FacilitatorHandler interface
 */
export class NanoSessionFacilitatorHandler {
  private rpcClient: NanoRpcClient;
  private spentSet: SpentSetStorage;

  constructor(options: HandlerOptions) {
    this.rpcClient = options.rpcClient;
    this.spentSet = options.spentSet ?? new InMemorySpentSet();
  }

  /**
   * Returns list of supported payment schemes
   */
  getSupported(): SupportedScheme[] {
    return [
      {
        x402Version: '0.1.0',
        scheme: SCHEME,
        network: NETWORK
      }
    ];
  }

  /**
   * Generates payment requirements with unique tag and session ID
   */
  getRequirements(args: {
    amount: string;
    payTo: string;
    maxTimeoutSeconds?: number;
    tagModulus?: number;
  }): PaymentRequirements {
    // Generate unique tag (random number mod tagModulus)
    const tagModulus = args.tagModulus ?? 1_000_000;
    const randomValue = randomBytes(4).readUInt32BE(0);
    const tag = randomValue % tagModulus;

    // Generate session ID
    const sessionId = randomBytes(16).toString('hex');

    // Calculate expiration time
    const expiresAt = new Date(
      Date.now() + (args.maxTimeoutSeconds ?? 300) * 1000
    ).toISOString();

    return {
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      amount: args.amount,
      payTo: args.payTo,
      maxTimeoutSeconds: args.maxTimeoutSeconds ?? 300,
      extra: {
        tag,
        sessionId,
        tagModulus,
        expiresAt
      }
    };
  }

  /**
   * Verifies a payment without marking it as spent
   * Returns null if scheme doesn't match
   */
  async handleVerify(
    requirements: PaymentRequirements,
    payload: PaymentPayload
  ): Promise<VerifyResult | null> {
    // Return null for non-matching schemes
    if (requirements.scheme !== SCHEME || requirements.network !== NETWORK) {
      return null;
    }

    try {
      // Get block information from Nano RPC
      const blockInfo = await this.rpcClient.getBlockInfo(payload.blockHash);

      // Verify block is confirmed
      if (!blockInfo.confirmed) {
        return {
          isValid: false,
          error: 'Block not confirmed'
        };
      }

      // Verify destination address matches
      // Support both `link_as_account` and `link` fields for compatibility with mocks
      const destination = blockInfo.link_as_account ?? blockInfo.link;
      if (destination !== requirements.payTo) {
        return {
          isValid: false,
          error: `Destination mismatch: expected ${requirements.payTo}, got ${destination}`
        };
      }

      // Verify amount matches
      if (blockInfo.amount !== requirements.amount) {
        return {
          isValid: false,
          error: `Amount mismatch: expected ${requirements.amount}, got ${blockInfo.amount}`
        };
      }

      // Verify tag matches (derived from amount - encoded in least significant digits)
      // Tag = amount % TAG_MODULUS (10,000,000 for 7 digits)
      const amountBigInt = BigInt(blockInfo.amount);
      const actualTag = Number(amountBigInt % BigInt(requirements.extra.tagModulus));

      if (actualTag !== requirements.extra.tag) {
        return {
          isValid: false,
          error: `Tag mismatch: expected ${requirements.extra.tag}, got ${actualTag} (from amount ${blockInfo.amount})`
        };
      }

      // All checks passed
      return {
        isValid: true
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Verifies and settles a payment (marks as spent)
   * Returns null if scheme doesn't match
   */
  async handleSettle(
    requirements: PaymentRequirements,
    payload: PaymentPayload
  ): Promise<SettleResult | null> {
    // Return null for non-matching schemes
    if (requirements.scheme !== SCHEME || requirements.network !== NETWORK) {
      return null;
    }

    try {
      // Check if already spent
      const isSpent = await this.spentSet.has(payload.blockHash);
      if (isSpent) {
        return {
          success: false,
          error: 'Block hash already spent'
        };
      }

      // Verify payment
      const verifyResult = await this.handleVerify(requirements, payload);
      
      // handleVerify returns null for non-matching schemes (already checked above)
      // but TypeScript doesn't know that, so handle it
      if (!verifyResult) {
        return {
          success: false,
          error: 'Scheme verification failed unexpectedly'
        };
      }

      if (!verifyResult.isValid) {
        return {
          success: false,
          error: verifyResult.error
        };
      }

      // Mark as spent
      await this.spentSet.add(payload.blockHash);

      return {
        success: true,
        transactionHash: payload.blockHash
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
