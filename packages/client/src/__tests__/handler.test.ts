import { describe, test, expect, vi } from 'vitest';
import { NanoSessionPaymentHandler } from '../handler.js';
import { SCHEME } from '@nanosession/core';
import type { PaymentRequirements } from '@nanosession/core';

describe('NanoSessionPaymentHandler', () => {
  const mockRpcClient = {
    getAccountInfo: vi.fn(),
    getBlockInfo: vi.fn(),
    confirmBlock: vi.fn(),
    processBlock: vi.fn(),
    generateWork: vi.fn(),
    getActiveDifficulty: vi.fn()
  };

  test('handle returns execer for matching scheme', async () => {
    const handler = new NanoSessionPaymentHandler({
      rpcClient: mockRpcClient as any,
      seed: 'a'.repeat(64)
    });

    const requirements: PaymentRequirements = {
      scheme: SCHEME,
      network: 'nano:mainnet',
      asset: 'XNO',
      amount: '1000000',
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
      extra: {
        nanoSession: {
          tag: 42,
          id: 'test',
          resourceAmountRaw: '999958',
          tagAmountRaw: '42',
          expiresAt: new Date().toISOString()
        }
      }
    };

    const execers = await handler.handle({}, [requirements]);

    expect(execers).toHaveLength(1);
    expect(execers[0].requirements).toBe(requirements);
    expect(typeof execers[0].exec).toBe('function');
  });

  test('handle returns empty for non-matching scheme', async () => {
    const handler = new NanoSessionPaymentHandler({
      rpcClient: mockRpcClient as any,
      seed: 'a'.repeat(64)
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
          tag: 1,
          id: 'other',
          resourceAmountRaw: '999999',
          tagAmountRaw: '1'
        }
      }
    };

    const execers = await handler.handle({}, [requirements]);

    expect(execers).toHaveLength(0);
  });

  test('budget limit prevents overspend', async () => {
    const handler = new NanoSessionPaymentHandler({
      rpcClient: mockRpcClient as any,
      seed: 'a'.repeat(64),
      maxSpend: '1000'
    });

    const requirements: PaymentRequirements = {
      scheme: SCHEME,
      network: 'nano:mainnet',
      asset: 'XNO',
      amount: '2000', // Exceeds maxSpend
      payTo: 'nano_destination',
      maxTimeoutSeconds: 300,
      extra: {
        nanoSession: {
          tag: 42,
          id: 'test',
          resourceAmountRaw: '1958',
          tagAmountRaw: '42',
          expiresAt: new Date().toISOString()
        }
      }
    };

    await expect(handler.handle({}, [requirements])).rejects.toThrow('exceeds max spend');
  });
});
