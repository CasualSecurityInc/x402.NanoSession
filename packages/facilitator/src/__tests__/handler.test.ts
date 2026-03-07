import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NanoSessionFacilitatorHandler } from '../handler.js';
import { InMemorySpentSet } from '../spent-set.js';
import { SCHEME } from '@nanosession/core';
import type { PaymentRequirements } from '@nanosession/core';

describe('InMemorySpentSet', () => {
  test('has returns false for new hash', async () => {
    const spentSet = new InMemorySpentSet();
    const result = await spentSet.has('NEW_HASH');
    expect(result).toBe(false);
  });

  test('add then has returns true', async () => {
    const spentSet = new InMemorySpentSet();
    await spentSet.add('TEST_HASH');
    const result = await spentSet.has('TEST_HASH');
    expect(result).toBe(true);
  });
});

describe('NanoSessionFacilitatorHandler', () => {
  const mockRpcClient = {
    getBlockInfo: vi.fn()
  };

  beforeEach(() => {
    mockRpcClient.getBlockInfo.mockClear();
  });

  test('getSupported returns nano-session scheme info', async () => {
    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any
    });

    const supported = await handler.getSupported();

    expect(supported).toHaveLength(1);
    expect(supported[0].scheme).toBe(SCHEME);
    expect(supported[0].network).toBe('nano:mainnet');
  });

  test('handleVerify returns null for non-matching scheme', async () => {
    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any
    });

    const requirements: PaymentRequirements = {
      scheme: 'evm-exact',
      network: 'eip155:1',
      asset: 'USDC',
      amount: '1000000',
      payTo: '0x123',
      maxTimeoutSeconds: 300,
      extra: {
        nanoSession: {
          tag: 0,
          id: 'test',
          resourceAmountRaw: '1000000',
          tagAmountRaw: '0',
          expiresAt: new Date().toISOString()
        }
      }
    };

    const mockPayload: any = { payload: { proof: '0xabc' }, accepted: requirements };
    const result = await handler.handleVerify(requirements, mockPayload);
    expect(result).toBeNull();
  });

  test('handleVerify returns valid for confirmed block', async () => {
    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any
    });

    const requirements = handler.getRequirements({
      resourceAmountRaw: '10000000',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300
    });

    mockRpcClient.getBlockInfo.mockResolvedValueOnce({
      hash: '0000002A',
      confirmed: true,
      link: 'nano_destination',
      link_as_account: 'nano_destination',
      amount: requirements.amount,
      height: 100
    });

    const mockPayload: any = { payload: { proof: '0000002A' }, accepted: requirements };
    const result = await handler.handleVerify(requirements, mockPayload);

    expect(result).not.toBeNull();
    expect(result!.isValid).toBe(true);
  });

  test('handleVerify rejects mutated requirement amount for same session', async () => {
    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any
    });

    const requirements = handler.getRequirements({
      resourceAmountRaw: '10000000',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300
    });

    const mutated: PaymentRequirements = {
      ...requirements,
      amount: (BigInt(requirements.amount) + 1n).toString(),
    };

    const mockPayload: any = { payload: { proof: '0000002A' }, accepted: mutated };
    const result = await handler.handleVerify(mutated, mockPayload);

    expect(result).not.toBeNull();
    expect(result!.isValid).toBe(false);
    expect(result!.error).toMatch(/Amount invariant violation|Requirements mismatch/);
  });

  test('handleVerify returns invalid for unconfirmed block', async () => {
    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any
    });

    const requirements = handler.getRequirements({
      resourceAmountRaw: '10000000',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300
    });

    mockRpcClient.getBlockInfo.mockResolvedValueOnce({
      hash: '00000029',
      confirmed: false,
      link: 'nano_destination',
      link_as_account: 'nano_destination',
      amount: requirements.amount
    });

    const mockPayload: any = { payload: { proof: '00000029' }, accepted: requirements };
    const result = await handler.handleVerify(requirements, mockPayload);

    expect(result).not.toBeNull();
    expect(result!.isValid).toBe(false);
  });

  test('handleSettle rejects duplicate blockHash', async () => {
    const spentSet = new InMemorySpentSet();
    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any,
      spentSet
    });

    const requirements = handler.getRequirements({
      resourceAmountRaw: '10000000',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300
    });

    mockRpcClient.getBlockInfo.mockResolvedValue({
      hash: '0000002A',
      confirmed: true,
      link: 'nano_destination',
      link_as_account: 'nano_destination',
      amount: requirements.amount
    });

    const mockPayload: any = { payload: { proof: '0000002A' }, accepted: requirements };

    const result1 = await handler.handleSettle(requirements, mockPayload);
    expect(result1).not.toBeNull();
    expect(result1!.success).toBe(true);

    const result2 = await handler.handleSettle(requirements, mockPayload);
    expect(result2).not.toBeNull();
    expect(result2!.success).toBe(false);
  });

  test('handleSettle rejects unknown sessionId (session spoofing attack)', async () => {
    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any
    });

    const fakeRequirements: PaymentRequirements = {
      scheme: SCHEME,
      network: 'nano:mainnet',
      asset: 'XNO',
      amount: '10000042',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
      extra: {
        nanoSession: {
          tag: 42,
          id: 'fake-session-never-issued',
          resourceAmountRaw: '10000000',
          tagAmountRaw: '42',
          expiresAt: new Date().toISOString()
        }
      }
    };

    const mockPayload: any = { payload: { proof: '0000002A' }, accepted: fakeRequirements };
    const result = await handler.handleSettle(fakeRequirements, mockPayload);

    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toBe('Session not found or expired');
  });
});
