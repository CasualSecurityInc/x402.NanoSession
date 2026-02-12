/**
 * TDD tests for Faremeter adapter
 * 
 * Security tests verify tag-based session binding (prevents receipt-stealing).
 * See AGENTS.md § Security-First Protocol Development for requirements.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { 
  x402,
  client
} from '@faremeter/types';
import { SCHEME, NETWORK, ASSET } from '@nanosession/core';

type x402PaymentRequirements = x402.x402PaymentRequirements;
type x402PaymentPayload = x402.x402PaymentPayload;
type RequestContext = client.RequestContext;

interface NanoSessionExtra {
  tag: number;
  sessionId: string;
  tagModulus: number;
  expiresAt: string;
}

import { createFacilitatorHandler, createPaymentHandler } from '../index.js';

// Mock RPC client
const createMockRpcClient = () => ({
  getBlockInfo: vi.fn(),
  getAccountInfo: vi.fn(),
});

describe('createFacilitatorHandler', () => {
  let mockRpcClient: ReturnType<typeof createMockRpcClient>;

  beforeEach(() => {
    mockRpcClient = createMockRpcClient();
  });

  test('returns object satisfying FacilitatorHandler type', () => {
    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_test_address',
    });

    // Type check: should have required FacilitatorHandler methods
    expect(typeof handler.getRequirements).toBe('function');
    expect(typeof handler.handleSettle).toBe('function');
    
    // Optional methods
    expect(typeof handler.getSupported).toBe('function');
    expect(typeof handler.handleVerify).toBe('function');
  });

  test('getSupported returns correct scheme/network tuple', async () => {
    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_test_address',
    });

    const supported = handler.getSupported!();
    
    expect(supported).toHaveLength(1);
    const first = await supported[0];
    expect(first).toMatchObject({
      x402Version: 1,
      scheme: SCHEME,
      network: NETWORK,
    });
  });

  test('getRequirements filters by scheme and enriches with session data', async () => {
    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_test_address',
      defaultAmount: '1000000000000000000000000', // 0.001 XNO
    });

    const inputRequirements: x402PaymentRequirements[] = [
      // Should match - our scheme
      {
        scheme: SCHEME,
        network: NETWORK,
        asset: ASSET,
        maxAmountRequired: '1000000000000000000000000',
        resource: '/api/test',
        description: 'Test resource',
        mimeType: 'application/json',
        payTo: 'nano_test_address',
        maxTimeoutSeconds: 300,
      },
      // Should NOT match - different scheme
      {
        scheme: 'exact',
        network: 'eip155:1',
        asset: 'USDC',
        maxAmountRequired: '1000000',
        resource: '/api/test',
        description: 'Test resource',
        mimeType: 'application/json',
        payTo: '0x123',
        maxTimeoutSeconds: 300,
      },
    ];

    const result = await handler.getRequirements(inputRequirements);
    
    expect(result).toHaveLength(1);
    expect(result[0].scheme).toBe(SCHEME);
    
    const extra = result[0].extra as NanoSessionExtra;
    expect(extra).toBeDefined();
    expect(extra.tag).toBeDefined();
    expect(extra.sessionId).toBeDefined();
    expect(extra.tagModulus).toBeDefined();
    expect(extra.expiresAt).toBeDefined();
  });

  test('handleVerify returns null for non-matching schemes', async () => {
    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_test_address',
    });

    const requirements: x402PaymentRequirements = {
      scheme: 'exact',
      network: 'eip155:1',
      asset: 'USDC',
      maxAmountRequired: '1000000',
      resource: '/api/test',
      description: 'Test resource',
      mimeType: 'application/json',
      payTo: '0x123',
      maxTimeoutSeconds: 300,
    };

    const payment: x402PaymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'eip155:1',
      payload: { txHash: '0xabc' },
    };

    const result = await handler.handleVerify!(requirements, payment);
    expect(result).toBeNull();
  });

  test('handleVerify returns valid response for correct payment', async () => {
    const baseAmount = '1000000000000000000000000';
    const tag = 42;
    const taggedAmount = (BigInt(baseAmount) + BigInt(tag)).toString();

    mockRpcClient.getBlockInfo.mockResolvedValueOnce({
      hash: 'VALID_BLOCK_HASH',
      confirmed: true,
      link_as_account: 'nano_destination',
      amount: taggedAmount,
    });

    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_destination',
    });

    const requirements: x402PaymentRequirements = {
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      maxAmountRequired: baseAmount,
      resource: '/api/test',
      description: 'Test resource',
      mimeType: 'application/json',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
      extra: {
        tag,
        sessionId: 'test-session',
        tagModulus: 1000000,
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      },
    };

    const payment: x402PaymentPayload = {
      x402Version: 1,
      scheme: SCHEME,
      network: NETWORK,
      payload: { blockHash: 'VALID_BLOCK_HASH' },
    };

    const result = await handler.handleVerify!(requirements, payment);

    expect(result).not.toBeNull();
    expect(result!.isValid).toBe(true);
    expect(result!.invalidReason).toBeFalsy();
  });

  test('handleSettle marks payment as spent and returns success', async () => {
    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_destination',
      defaultAmount: '1000000000000000000000000',
    });

    const inputReqs: x402PaymentRequirements[] = [{
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      maxAmountRequired: '1000000000000000000000000',
      resource: '/api/test',
      description: 'Test resource',
      mimeType: 'application/json',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
    }];

    const enriched = await handler.getRequirements(inputReqs);
    expect(enriched).toHaveLength(1);
    
    const requirements = enriched[0];
    const extra = requirements.extra as NanoSessionExtra;
    const taggedAmount = (BigInt(requirements.maxAmountRequired) + BigInt(extra.tag)).toString();

    mockRpcClient.getBlockInfo.mockResolvedValue({
      hash: 'SETTLE_BLOCK_HASH',
      confirmed: true,
      link_as_account: 'nano_destination',
      amount: taggedAmount,
    });

    const payment: x402PaymentPayload = {
      x402Version: 1,
      scheme: SCHEME,
      network: NETWORK,
      payload: { blockHash: 'SETTLE_BLOCK_HASH' },
    };

    const result = await handler.handleSettle(requirements, payment);

    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(result!.txHash).toBe('SETTLE_BLOCK_HASH');
    expect(result!.networkId).toBe(NETWORK);
  });
});

describe('createPaymentHandler', () => {
  let mockRpcClient: ReturnType<typeof createMockRpcClient>;

  beforeEach(() => {
    mockRpcClient = createMockRpcClient();
    mockRpcClient.getAccountInfo.mockResolvedValue({
      frontier: 'PREVIOUS_BLOCK_HASH',
      balance: '10000000000000000000000000000', // 10 XNO
      representative: 'nano_rep_address',
    });
  });

  test('returns function satisfying PaymentHandler type', () => {
    const handler = createPaymentHandler({
      rpcClient: mockRpcClient as any,
      seed: '0'.repeat(64),
    });

    // Should be a function
    expect(typeof handler).toBe('function');
  });

  test('handler filters accepts array by scheme', async () => {
    const handler = createPaymentHandler({
      rpcClient: mockRpcClient as any,
      seed: '0'.repeat(64),
    });

    const context: RequestContext = {
      request: new URL('https://example.com/api/test'),
    };

    const accepts: x402PaymentRequirements[] = [
      // Should match
      {
        scheme: SCHEME,
        network: NETWORK,
        asset: ASSET,
        maxAmountRequired: '1000000000000000000000000',
        resource: '/api/test',
        description: 'Test resource',
        mimeType: 'application/json',
        payTo: 'nano_destination',
        maxTimeoutSeconds: 300,
        extra: {
          tag: 42,
          sessionId: 'test-session',
          tagModulus: 1000000,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        },
      },
      // Should NOT match
      {
        scheme: 'exact',
        network: 'eip155:1',
        asset: 'USDC',
        maxAmountRequired: '1000000',
        resource: '/api/test',
        description: 'Test resource',
        mimeType: 'application/json',
        payTo: '0x123',
        maxTimeoutSeconds: 300,
      },
    ];

    const execers = await handler(context, accepts);

    // Should only return execer for nano-session
    expect(execers).toHaveLength(1);
    expect(execers[0].requirements.scheme).toBe(SCHEME);
  });

  test('PaymentExecer exec() returns payload structure', async () => {
    const handler = createPaymentHandler({
      rpcClient: mockRpcClient as any,
      seed: 'a'.repeat(64),
    });

    const context: RequestContext = {
      request: new URL('https://example.com/api/test'),
    };

    const accepts: x402PaymentRequirements[] = [
      {
        scheme: SCHEME,
        network: NETWORK,
        asset: ASSET,
        maxAmountRequired: '1000000000000000000000000',
        resource: '/api/test',
        description: 'Test resource',
        mimeType: 'application/json',
        payTo: 'nano_destination',
        maxTimeoutSeconds: 300,
        extra: {
          tag: 42,
          sessionId: 'test-session',
          tagModulus: 1000000,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        },
      },
    ];

    const execers = await handler(context, accepts);
    expect(execers).toHaveLength(1);
    expect(execers[0].requirements).toBeDefined();
    expect(typeof execers[0].exec).toBe('function');
  });
});

/**
 * SECURITY TESTS
 * 
 * These tests verify the NanoSession security model is preserved:
 * - Tag-based session binding (prevents receipt-stealing)
 * - Spent set checks (prevents replay attacks)
 * 
 * IMPORTANT: NanoSession binds payments to sessions via the tag encoded in
 * the payment amount, NOT via a sessionId field in PaymentPayload.
 * The server-side `requirements.extra.tag` is the source of truth.
 * Verification checks: `receivedAmount % tagModulus === expectedTag`
 */
describe('Security: Attack Prevention', () => {
  let mockRpcClient: ReturnType<typeof createMockRpcClient>;

  beforeEach(() => {
    mockRpcClient = createMockRpcClient();
  });

  /**
   * Receipt-Stealing Attack Prevention
   * 
   * Attack vector: Attacker monitors server's payment address, sees a valid
   * block hash on-chain, and tries to use it with their own session.
   * 
   * Defense: The tag encoded in the payment amount must match the expected
   * tag for the session. Different sessions have different tags.
   */
  test('SECURITY: rejects payment with wrong tag (amount mismatch) - receipt-stealing prevention', async () => {
    const baseAmount = '1000000000000000000000000';
    const correctTag = 42;
    const wrongTag = 99; // Attacker's tag is different
    
    // Amount on chain has WRONG tag encoded
    const wrongTaggedAmount = (BigInt(baseAmount) + BigInt(wrongTag)).toString();

    mockRpcClient.getBlockInfo.mockResolvedValueOnce({
      hash: 'STOLEN_BLOCK_HASH',
      confirmed: true,
      link_as_account: 'nano_destination',
      amount: wrongTaggedAmount, // Amount with wrong tag
    });

    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_destination',
    });

    // Requirements expect the CORRECT tag
    const requirements: x402PaymentRequirements = {
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      maxAmountRequired: baseAmount,
      resource: '/api/test',
      description: 'Test resource',
      mimeType: 'application/json',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
      extra: {
        tag: correctTag, // Server expects THIS tag
        sessionId: 'victim-session',
        tagModulus: 1000000,
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      },
    };

    const payment: x402PaymentPayload = {
      x402Version: 1,
      scheme: SCHEME,
      network: NETWORK,
      payload: { blockHash: 'STOLEN_BLOCK_HASH' },
    };

    const result = await handler.handleVerify!(requirements, payment);

    // MUST reject - tag mismatch indicates receipt-stealing attempt
    expect(result).not.toBeNull();
    expect(result!.isValid).toBe(false);
    expect(result!.invalidReason).toMatch(/mismatch|tag|amount/i);
  });

  /**
   * Replay Attack Prevention
   * 
   * Attack vector: Attacker captures a valid block hash and tries to use
   * it multiple times to get multiple resources.
   * 
   * Defense: Spent set tracks used block hashes. Once settled, a hash
   * cannot be used again.
   */
  test('SECURITY: rejects already-spent block hash - replay attack prevention', async () => {
    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_destination',
      defaultAmount: '1000000000000000000000000',
    });

    const inputReqs: x402PaymentRequirements[] = [{
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      maxAmountRequired: '1000000000000000000000000',
      resource: '/api/test',
      description: 'Test resource',
      mimeType: 'application/json',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
    }];

    const enriched = await handler.getRequirements(inputReqs);
    expect(enriched).toHaveLength(1);
    
    const requirements = enriched[0];
    const extra = requirements.extra as { tag: number; sessionId: string; tagModulus: number; expiresAt: string };
    const taggedAmount = (BigInt(requirements.maxAmountRequired) + BigInt(extra.tag)).toString();

    mockRpcClient.getBlockInfo.mockResolvedValue({
      hash: 'ONCE_VALID_BLOCK_HASH',
      confirmed: true,
      link_as_account: 'nano_destination',
      amount: taggedAmount,
    });

    const payment: x402PaymentPayload = {
      x402Version: 1,
      scheme: SCHEME,
      network: NETWORK,
      payload: { blockHash: 'ONCE_VALID_BLOCK_HASH' },
    };

    // First settlement should succeed
    const result1 = await handler.handleSettle(requirements, payment);
    expect(result1).not.toBeNull();
    expect(result1!.success).toBe(true);

    // Second settlement should FAIL - replay attack blocked
    const result2 = await handler.handleSettle(requirements, payment);
    expect(result2).not.toBeNull();
    expect(result2!.success).toBe(false);
    expect(result2!.error).toMatch(/spent|already|duplicate/i);
  });

  /**
   * Handler Isolation
   * 
   * Verify that handlers correctly return null for non-matching schemes,
   * allowing other handlers to process the payment.
   */
  test('SECURITY: returns null for non-matching scheme - handler isolation', async () => {
    const handler = createFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      payTo: 'nano_destination',
    });

    const requirements: x402PaymentRequirements = {
      scheme: 'exact',
      network: 'eip155:1',
      asset: 'USDC',
      maxAmountRequired: '1000000',
      resource: '/api/test',
      description: 'Test resource',
      mimeType: 'application/json',
      payTo: '0x123',
      maxTimeoutSeconds: 300,
    };

    const payment: x402PaymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'eip155:1',
      payload: { txHash: '0xabc' },
    };

    // Both verify and settle should return null for non-matching schemes
    const verifyResult = await handler.handleVerify!(requirements, payment);
    expect(verifyResult).toBeNull();

    const settleResult = await handler.handleSettle(requirements, payment);
    expect(settleResult).toBeNull();
  });
});
