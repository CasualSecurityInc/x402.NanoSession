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
    
    const supported = await handler.getSupported!();
    
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
        tag: 0,
        sessionId: 'test',
        tagModulus: 1000000,
        expiresAt: new Date().toISOString()
      }
    };
    
    const result = await handler.handleVerify!(requirements, { blockHash: '0xabc' });
    expect(result).toBeNull();
  });

  test('handleVerify returns valid for confirmed block', async () => {
    const baseAmount = '10000000';
    const tag = 42;
    const taggedAmount = (BigInt(baseAmount) + BigInt(tag)).toString();
    
    mockRpcClient.getBlockInfo.mockResolvedValueOnce({
      hash: '0000002A',
      confirmed: true,
      link: 'nano_destination',
      link_as_account: 'nano_destination',
      amount: taggedAmount,
      height: 100
    });

    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any
    });
    
    const requirements: PaymentRequirements = {
      scheme: SCHEME,
      network: 'nano:mainnet',
      asset: 'XNO',
      amount: baseAmount,
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
      extra: {
        tag,
        sessionId: 'test',
        tagModulus: 10000000,
        expiresAt: new Date().toISOString()
      }
    };
    const result = await handler.handleVerify!(requirements, { blockHash: '0000002A' });
    
    expect(result).not.toBeNull();
    expect(result!.isValid).toBe(true);
  });

  test('handleVerify returns invalid for unconfirmed block', async () => {
    const baseAmount = '10000000';
    const tag = 42;
    const taggedAmount = (BigInt(baseAmount) + BigInt(tag)).toString();
    
    mockRpcClient.getBlockInfo.mockResolvedValueOnce({
      hash: '00000029',
      confirmed: false,
      link: 'nano_destination',
      link_as_account: 'nano_destination',
      amount: taggedAmount
    });

    const handler = new NanoSessionFacilitatorHandler({
      rpcClient: mockRpcClient as any
    });
    
    const requirements: PaymentRequirements = {
      scheme: SCHEME,
      network: 'nano:mainnet',
      asset: 'XNO',
      amount: baseAmount,
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
      extra: {
        tag,
        sessionId: 'test',
        tagModulus: 10000000,
        expiresAt: new Date().toISOString()
      }
    };
    const result = await handler.handleVerify!(requirements, { blockHash: '00000029' });
    
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
      amount: '10000000',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300
    });
    
    const taggedAmount = (BigInt(requirements.amount) + BigInt(requirements.extra.tag)).toString();
    
    mockRpcClient.getBlockInfo.mockResolvedValue({
      hash: '0000002A',
      confirmed: true,
      link: 'nano_destination',
      link_as_account: 'nano_destination',
      amount: taggedAmount
    });
    
    // First settlement should succeed
    const result1 = await handler.handleSettle!(requirements, { blockHash: '0000002A' });
    expect(result1).not.toBeNull();
    expect(result1!.success).toBe(true);
    
    // Second settlement should fail (double spend)
    const result2 = await handler.handleSettle!(requirements, { blockHash: '0000002A' });
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
      amount: '10000000',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
      extra: {
        tag: 42,
        sessionId: 'fake-session-never-issued',
        tagModulus: 1000000,
        expiresAt: new Date().toISOString()
      }
    };
    
    const result = await handler.handleSettle!(fakeRequirements, { blockHash: '0000002A' });
    
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toBe('Unknown session ID');
  });
});
