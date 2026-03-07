/**
 * FacilitatorHandler implementation for x402/Faremeter compatibility
 * Handles nano-session payment verification and settlement
 */

import {
  SCHEME,
  NETWORK,
  TAG_MODULUS,
  TAG_MULTIPLIER,
  assertValidPaymentRequirements,
  assertValidRawAmount,
  createPaymentRequirements
} from '@nanosession/core';
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
  /** Optional tag modulus override (defaults to TAG_MODULUS) */
  tagModulus?: number;
  /** Optional tag multiplier override (defaults to TAG_MULTIPLIER) */
  tagMultiplier?: string | bigint;
}

/**
 * Supported payment scheme information
 */
export interface SupportedScheme {
  /** x402 protocol version */
  x402Version: 2;
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
  private activeSessionAmounts: Map<string, string>;
  private tagModulus: number;
  private tagMultiplier: bigint;

  constructor(options: HandlerOptions) {
    this.rpcClient = options.rpcClient;
    this.spentSet = options.spentSet ?? new InMemorySpentSet();
    this.tagModulus = NanoSessionFacilitatorHandler.resolveTagModulus(
      options.tagModulus ?? TAG_MODULUS
    );
    this.tagMultiplier = NanoSessionFacilitatorHandler.resolveTagMultiplier(
      options.tagMultiplier ?? TAG_MULTIPLIER
    );

    // Default implementation using Map
    const inMemoryRegistry = new Map<string, PaymentRequirements>();
    this.sessionRegistry = options.sessionRegistry ?? {
      get: (id) => inMemoryRegistry.get(id),
      set: (id, reqs) => inMemoryRegistry.set(id, reqs),
      delete: (id) => { inMemoryRegistry.delete(id); },
      has: (id) => inMemoryRegistry.has(id)
    };
    this.activeSessionAmounts = new Map();
  }

  private static resolveTagModulus(value: number): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('Invalid tagModulus: must be a positive integer');
    }
    return value;
  }

  private static resolveTagMultiplier(value: string | bigint): bigint {
    try {
      const multiplier = typeof value === 'bigint' ? value : BigInt(value);
      if (multiplier <= 0n) {
        throw new Error('tagMultiplier must be greater than zero');
      }
      return multiplier;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid tagMultiplier: ${message}`);
    }
  }

  private releaseSession(sessionId: string): void {
    this.sessionRegistry.delete(sessionId);
    this.activeSessionAmounts.delete(sessionId);
  }

  private isAmountInUse(amountRaw: string): boolean {
    for (const activeAmount of this.activeSessionAmounts.values()) {
      if (activeAmount === amountRaw) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the list of payment schemes supported by this facilitator.
   * @returns Array of supported protocol versions, schemes, and networks
   */
  getSupported(): SupportedScheme[] {
    return [
      {
        x402Version: 2,
        scheme: SCHEME,
        network: NETWORK
      }
    ];
  }

  /**
   * Generates new payment requirements for a session.
   * Internally generates a unique session ID and reserved payment tag.
   * 
   * @param args Configuration for the requirements
   * @returns Standard x402 PaymentRequirements object
   */
  getRequirements(args: {
    /** Resource amount in raw, before the tag amount is added */
    resourceAmountRaw: string;
    /** Destination account address */
    payTo: string;
    /** How long before session expires */
    maxTimeoutSeconds?: number;
    /** Optional deterministic tag value */
    tag?: number;
    /** Optional deterministic tag amount in raw */
    tagAmountRaw?: string;
    /** Optional tag modulus override */
    tagModulus?: number;
    /** Optional tag multiplier override */
    tagMultiplier?: string | bigint;
  }): PaymentRequirements {
    assertValidRawAmount(args.resourceAmountRaw, 'resourceAmountRaw');
    if (args.tagAmountRaw !== undefined) {
      assertValidRawAmount(args.tagAmountRaw, 'tagAmountRaw');
    }

    const maxTimeoutSeconds = args.maxTimeoutSeconds ?? 600;
    const expiresAt = new Date(Date.now() + maxTimeoutSeconds * 1000).toISOString();
    const deterministicTag = args.tag;
    const deterministicTagAmountRaw = args.tagAmountRaw;
    const tagModulus = NanoSessionFacilitatorHandler.resolveTagModulus(
      args.tagModulus ?? this.tagModulus
    );
    const tagMultiplier = NanoSessionFacilitatorHandler.resolveTagMultiplier(
      args.tagMultiplier ?? this.tagMultiplier
    );

    for (let attempt = 0; attempt < 16; attempt++) {
      const randomValue = randomBytes(4).readUInt32BE(0);
      const tag = deterministicTag ?? (randomValue % tagModulus);

      if (!Number.isInteger(tag) || tag < 0) {
        throw new Error('Invalid tag: must be a non-negative integer');
      }

      if (tag >= tagModulus) {
        throw new Error(`Invalid tag: must be less than tagModulus (${tagModulus})`);
      }

      const tagAmountRaw = deterministicTagAmountRaw ??
        (BigInt(tag) * tagMultiplier).toString();
      const amount = (BigInt(args.resourceAmountRaw) + BigInt(tagAmountRaw)).toString();

      if (this.isAmountInUse(amount)) {
        if (deterministicTag !== undefined || deterministicTagAmountRaw !== undefined) {
          throw new Error(`Tagged amount collision for active session: ${amount}`);
        }
        continue;
      }

      const sessionId = randomBytes(16).toString('hex');
      const requirements = createPaymentRequirements({
        payTo: args.payTo,
        maxTimeoutSeconds,
        id: sessionId,
        tag,
        resourceAmountRaw: args.resourceAmountRaw,
        tagAmountRaw,
        amount,
        expiresAt
      });

      this.sessionRegistry.set(sessionId, requirements);
      this.activeSessionAmounts.set(sessionId, amount);
      return requirements;
    }

    throw new Error('Unable to allocate unique tagged amount for session');
  }

  /**
   * Retrieves previously generated requirements for a session.
   * @param sessionId Hexadecimal session identifier
   * @returns The stored requirements, or undefined if not found or expired
   */
  getStoredRequirements(sessionId: string): PaymentRequirements | undefined {
    const requirements = this.sessionRegistry.get(sessionId);
    if (!requirements) {
      return undefined;
    }

    // Check if session has expired
    const expiresAt = requirements.extra?.nanoSession?.expiresAt;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      this.releaseSession(sessionId);
      return undefined;
    }

    return requirements;
  }

  /**
   * Re-registers a session from externally-supplied requirements.
   * Used for recovery when the in-memory registry is lost (e.g. server restart)
   * but the client still holds the original 402 requirements.
   * 
   * @WARNING: This skips session ID verification. Ensure you trust the
   * requirements if you use this to recover state.
   * 
   * @param sessionId Hexadecimal session identifier
   * @param requirements The requirements to register
   */
  registerSessionFromRequirements(sessionId: string, requirements: PaymentRequirements): void {
    assertValidPaymentRequirements(requirements);
    if (requirements.extra.nanoSession.id !== sessionId) {
      throw new Error('Session ID mismatch in registerSessionFromRequirements');
    }
    this.sessionRegistry.set(sessionId, requirements);
    this.activeSessionAmounts.set(sessionId, requirements.amount);
  }

  /**
   * Verifies that a payment proof (block hash) satisfies the given requirements.
   * Performs cryptographic validation, session checks, and amount verification.
   * 
   * @param requirements The requirements the payment must satisfy
   * @param payload The payment response containing the proof (hash)
   * @returns Verification result with validity status and optional error
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
      assertValidPaymentRequirements(requirements);
      const blockHash = payload.payload.proof;
      const sessionId = requirements.extra.nanoSession.id;

      // Session Binding: Verify session ID echoed by client
      const payloadSessionId = payload.accepted?.extra?.nanoSession?.id ?? sessionId;
      if (payloadSessionId !== sessionId) {
        return {
          isValid: false,
          error: 'Session ID mismatch'
        };
      }

      // Session Registry Check: Ensure the session was issued and active
      const issuedRequirements = this.sessionRegistry.get(sessionId);
      if (!issuedRequirements) {
        return {
          isValid: false,
          error: 'Session not found or expired'
        };
      }

      // Requirements consistency check: do not trust mutated requirements
      if (
        requirements.amount !== issuedRequirements.amount ||
        requirements.payTo !== issuedRequirements.payTo ||
        requirements.extra.nanoSession.tag !== issuedRequirements.extra.nanoSession.tag ||
        requirements.extra.nanoSession.resourceAmountRaw !== issuedRequirements.extra.nanoSession.resourceAmountRaw ||
        requirements.extra.nanoSession.tagAmountRaw !== issuedRequirements.extra.nanoSession.tagAmountRaw
      ) {
        return {
          isValid: false,
          error: 'Requirements mismatch for issued session'
        };
      }

      // Get block information from Nano RPC
      let blockInfo = await this.rpcClient.getBlockInfo(blockHash);

      // Simple retry logic for confirmation propagation delay
      // WebSocket often sees block faster than RPC node marks it as confirmed
      if (!blockInfo.confirmed) {
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          blockInfo = await this.rpcClient.getBlockInfo(blockHash);
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
      if (destination !== issuedRequirements.payTo) {
        return {
          isValid: false,
          error: `Address mismatch: expected ${issuedRequirements.payTo}, got ${destination}`
        };
      }

      // Amount check: expected amount is explicitly provided as requirements.amount
      const actualAmount = BigInt(blockInfo.amount);
      const expectedAmount = BigInt(issuedRequirements.amount);

      if (actualAmount !== expectedAmount) {
        return {
          isValid: false,
          error: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`
        };
      }

      return {
        isValid: true,
        blockHash: payload.payload.proof
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
   * Verifies and finalizes a payment (settlement).
   * Unlike verify, this marks the proof as spent to prevent double-spending.
   * 
   * @param requirements The requirements the payment must satisfy
   * @param payload The payment response containing the proof (hash)
   * @returns Settlement result with success status
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
    const isSpent = await this.spentSet.has(payload.payload.proof);
    if (isSpent) {
      return {
        success: false,
        error: 'Payment already spent'
      };
    }

    // Mark as spent
    await this.spentSet.add(payload.payload.proof);

    // Remove from session registry to prevent reuse
    if (requirements.extra?.nanoSession?.id) {
      this.releaseSession(requirements.extra.nanoSession.id);
    }

    return {
      success: true,
      transactionHash: payload.payload.proof
    };
  }
}
