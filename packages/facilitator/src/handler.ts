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
 * Interface for session storage
 */
export interface SessionRegistry {
  get(sessionId: string): PaymentRequirements | undefined;
  set(sessionId: string, requirements: PaymentRequirements): void;
  delete(sessionId: string): void;
  has(sessionId: string): boolean;
}

/**
 * Configuration options for the handler
 */
export interface HandlerOptions {
  /** Nano RPC client instance */
  rpcClient: NanoRpcClient;
  /** Optional spent set storage (defaults to in-memory) */
  spentSet?: SpentSetStorage;
  /** Optional session storage (defaults to in-memory Map) */
  sessionRegistry?: SessionRegistry;
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
  /** The transaction hash if verified */
  blockHash?: string;
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
 * 
 * SECURITY: This handler maintains a session registry to prevent session spoofing attacks.
 * Only session IDs issued via getRequirements() are considered valid.
 */
export class NanoSessionFacilitatorHandler {
  private rpcClient: NanoRpcClient;
  private spentSet: SpentSetStorage;
  /**
   * Session registry - maps sessionId to the PaymentRequirements that were issued.
   * This prevents attackers from submitting payments with forged session IDs.
   * See: AGENTS.md § Security-First Protocol Development
   */
  private sessionRegistry: SessionRegistry;

  constructor(options: HandlerOptions) {
    this.rpcClient = options.rpcClient;
    this.spentSet = options.spentSet ?? new InMemorySpentSet();

    // Default implementation using Map
    const inMemoryRegistry = new Map<string, PaymentRequirements>();
    this.sessionRegistry = options.sessionRegistry ?? {
      get: (id) => inMemoryRegistry.get(id),
      set: (id, reqs) => inMemoryRegistry.set(id, reqs),
      delete: (id) => { inMemoryRegistry.delete(id); },
      has: (id) => inMemoryRegistry.has(id)
    };
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

    const expiresAt = new Date(Date.now() + (args.maxTimeoutSeconds ?? 600) * 1000).toISOString();

    const requirements: PaymentRequirements = {
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      amount: args.amount,
      payTo: args.payTo,
      maxTimeoutSeconds: args.maxTimeoutSeconds ?? 600,
      extra: {
        tag,
        sessionId,
        tagModulus,
        expiresAt
      }
    };

    // Register session to prevent session spoofing attacks
    this.sessionRegistry.set(sessionId, requirements);

    return requirements;
  }

  /**
   * Retrieves stored requirements for a session ID
   * Returns undefined if session not found or expired
   */
  getStoredRequirements(sessionId: string): PaymentRequirements | undefined {
    const requirements = this.sessionRegistry.get(sessionId);
    if (!requirements) {
      return undefined;
    }

    // Check if session has expired
    const expiresAt = requirements.extra?.expiresAt;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      this.sessionRegistry.delete(sessionId);
      return undefined;
    }

    return requirements;
  }

  /**
   * Re-register a session from externally-supplied requirements.
   * Used for recovery when the in-memory registry is lost (e.g. server restart)
   * but the client still holds the original 402 requirements.
   * 
   * SECURITY: The caller must validate requirements.payTo matches the expected
   * server address before calling this. handleSettle still independently verifies
   * the block against the RPC node.
   */
  registerSessionFromRequirements(sessionId: string, requirements: PaymentRequirements): void {
    this.sessionRegistry.set(sessionId, requirements);
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
      let blockInfo = await this.rpcClient.getBlockInfo(payload.blockHash);

      // Simple retry logic for confirmation propagation delay
      // WebSocket often sees block faster than RPC node marks it as confirmed
      if (!blockInfo.confirmed) {
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          blockInfo = await this.rpcClient.getBlockInfo(payload.blockHash);
          if (blockInfo.confirmed) break;
        }
      }

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
          error: `Address mismatch: expected ${requirements.payTo}, got ${destination}`
        };
      }

      // Session Binding: Verify session ID matches
      // This protects against receipt-stealing attacks
      // We check if the payload (which can be extended) or the requirements match
      const payloadSessionId = (payload as any).sessionId ?? requirements.extra?.sessionId;
      if (payloadSessionId !== requirements.extra?.sessionId) {
        return {
          isValid: false,
          error: 'Session ID mismatch'
        };
      }

      // Session Registry Check: Ensure the session ID was actually issued by us
      // This protects against session spoofing attacks
      if (!this.sessionRegistry.has(requirements.extra?.sessionId)) {
        return {
          isValid: false,
          error: 'Session not found or expired'
        };
      }

      // Amount tagging: Verify amount matches base amount + session tag
      const actualAmount = BigInt(blockInfo.amount);
      const expectedAmount = BigInt(requirements.amount) + BigInt(requirements.extra?.tag ?? 0);

      if (actualAmount !== expectedAmount) {
        return {
          isValid: false,
          error: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`
        };
      }

      return {
        isValid: true,
        blockHash: payload.blockHash
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        error: message
      };
    }
  }

  /**
   * Settles a payment by verifying it and marking it as spent
   */
  async handleSettle(
    requirements: PaymentRequirements,
    payload: PaymentPayload
  ): Promise<SettleResult | null> {
    // Verify first
    const verifyResult = await this.handleVerify(requirements, payload);

    if (!verifyResult) {
      return null;
    }

    if (!verifyResult.isValid) {
      return {
        success: false,
        error: verifyResult.error
      };
    }

    // Check if already spent
    const isSpent = await this.spentSet.has(payload.blockHash);
    if (isSpent) {
      return {
        success: false,
        error: 'Payment already spent'
      };
    }

    // Mark as spent
    await this.spentSet.add(payload.blockHash);

    // Remove from session registry to prevent reuse
    if (requirements.extra?.sessionId) {
      this.sessionRegistry.delete(requirements.extra.sessionId);
    }

    return {
      success: true,
      transactionHash: payload.blockHash
    };
  }
}
