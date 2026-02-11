import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NanoRpcClient } from '../client.js';

describe('NanoRpcClient', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('constructor requires at least one endpoint', () => {
    expect(() => new NanoRpcClient({ endpoints: [] })).toThrow();
  });

  test('getBlockInfo returns block data', async () => {
    const mockResponse = {
      block_account: 'nano_account',
      amount: '500000000000000000000000000',
      balance: '1000000000000000000000000000',
      height: '42',
      confirmed: 'true',
      subtype: 'send',
      contents: {
        type: 'state',
        account: 'nano_account',
        previous: 'PREV123',
        representative: 'nano_rep',
        balance: '1000000000000000000000000000',
        link: 'LINK456',
        link_as_account: 'nano_destination',
        signature: 'SIG789',
        work: 'WORK000'
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const client = new NanoRpcClient({ endpoints: ['https://rpc.nano.to'] });
    const result = await client.getBlockInfo('ABC123');

    expect(result.hash).toBe('ABC123');
    expect(result.type).toBe('state');
    expect(result.subtype).toBe('send');
    expect(result.amount).toBe('500000000000000000000000000');
    expect(result.confirmed).toBe(true);
    expect(result.height).toBe(42);
    expect(result.link).toBe('LINK456');
    expect(result.link_as_account).toBe('nano_destination');
    expect(result.previous).toBe('PREV123');
  });

  test('failover tries next endpoint on failure', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('First endpoint failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          block_account: 'nano_account',
          amount: '0',
          balance: '0',
          height: '1',
          confirmed: 'true',
          subtype: 'send',
          contents: {
            type: 'state',
            account: 'nano_account',
            previous: '0',
            representative: 'nano_rep',
            balance: '0',
            link: '0',
            signature: 'SIG',
            work: 'WORK'
          }
        })
      });

    const client = new NanoRpcClient({
      endpoints: ['https://fail1.com', 'https://success.com'],
      maxRetries: 1
    });

    const result = await client.getBlockInfo('XYZ789');
    
    expect(result.hash).toBe('XYZ789');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('throws error when all endpoints fail', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const client = new NanoRpcClient({
      endpoints: ['https://fail1.com', 'https://fail2.com'],
      maxRetries: 1
    });

    await expect(client.getBlockInfo('HASH')).rejects.toThrow();
  });

  test('getAccountInfo returns account data', async () => {
    const mockResponse = {
      frontier: 'FRONTIER123',
      representative: 'nano_rep',
      balance: '1000000000000000000000000000',
      block_count: '100'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const client = new NanoRpcClient({ endpoints: ['https://rpc.nano.to'] });
    const result = await client.getAccountInfo('nano_account');

    expect(result.frontier).toBe('FRONTIER123');
    expect(result.representative).toBe('nano_rep');
    expect(result.balance).toBe('1000000000000000000000000000');
    expect(result.block_count).toBe(100);
  });
});
