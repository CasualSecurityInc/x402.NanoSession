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

  test('processBlock returns processed hash', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: 'ABCDEF' })
    });

    const client = new NanoRpcClient({ endpoints: ['https://rpc.nano.to'] });
    const hash = await client.processBlock({ type: 'state' });

    expect(hash).toBe('ABCDEF');
  });

  test('generateWork returns work value', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ work: 'ffff0000ffff0000' })
    });

    const client = new NanoRpcClient({ endpoints: ['https://rpc.nano.to'] });
    const work = await client.generateWork('ROOT_HASH');

    expect(work).toBe('ffff0000ffff0000');
  });

  test('URL query params are extracted and merged into RPC body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: 'TEST_HASH' })
    });

    const client = new NanoRpcClient({
      endpoints: ['https://rpc.nano.to?key=secret123&token=abc']
    });
    await client.processBlock({ type: 'state' });

    // Verify the request body includes the query params
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    
    expect(body.action).toBe('process');
    expect(body.key).toBe('secret123');
    expect(body.token).toBe('abc');
    // Base URL should not have query string
    expect(callArgs[0]).toBe('https://rpc.nano.to');
  });

  test('URL without query params works normally', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: 'TEST_HASH' })
    });

    const client = new NanoRpcClient({
      endpoints: ['https://rpc.nano.to']
    });
    await client.processBlock({ type: 'state' });

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    
    expect(body.action).toBe('process');
    expect(body.key).toBeUndefined();
    expect(callArgs[0]).toBe('https://rpc.nano.to');
  });

  test('multiple endpoints each have their own query params', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('First failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hash: 'TEST_HASH' })
      });

    const client = new NanoRpcClient({
      endpoints: [
        'https://primary.example.com?key=primary_key',
        'https://backup.example.com?key=backup_key&extra=param'
      ],
      maxRetries: 1
    });
    await client.processBlock({ type: 'state' });

    // First call should have primary key
    const firstCall = mockFetch.mock.calls[0];
    const firstBody = JSON.parse(firstCall[1].body);
    expect(firstBody.key).toBe('primary_key');
    expect(firstCall[0]).toBe('https://primary.example.com');

    // Second call (failover) should have backup key
    const secondCall = mockFetch.mock.calls[1];
    const secondBody = JSON.parse(secondCall[1].body);
    expect(secondBody.key).toBe('backup_key');
    expect(secondBody.extra).toBe('param');
    expect(secondCall[0]).toBe('https://backup.example.com');
  });

  test('connection refused error has user-friendly message', async () => {
    const fetchError = new TypeError('fetch failed');
    (fetchError as any).cause = { code: 'ECONNREFUSED', errno: -111 };
    mockFetch.mockRejectedValue(fetchError);

    const client = new NanoRpcClient({
      endpoints: ['https://rpc.example.com'],
      maxRetries: 1
    });

    try {
      await client.getBlockInfo('HASH');
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors[0].message).toBe('Connection refused by rpc.example.com');
    }
  });

  test('DNS not found error has user-friendly message', async () => {
    const fetchError = new TypeError('fetch failed');
    (fetchError as any).cause = { code: 'ENOTFOUND' };
    mockFetch.mockRejectedValue(fetchError);

    const client = new NanoRpcClient({
      endpoints: ['https://nonexistent.invalid'],
      maxRetries: 1
    });

    try {
      await client.getBlockInfo('HASH');
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors[0].message).toBe('Host not found: nonexistent.invalid');
    }
  });

  test('unknown network error includes error code', async () => {
    const fetchError = new TypeError('fetch failed');
    (fetchError as any).cause = { code: 'EUNKNOWN' };
    mockFetch.mockRejectedValue(fetchError);

    const client = new NanoRpcClient({
      endpoints: ['https://rpc.example.com'],
      maxRetries: 1
    });

    try {
      await client.getBlockInfo('HASH');
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors[0].message).toBe('Network error connecting to rpc.example.com (EUNKNOWN)');
    }
  });

  test('fetch failed without cause has generic message', async () => {
    const fetchError = new TypeError('fetch failed');
    mockFetch.mockRejectedValue(fetchError);

    const client = new NanoRpcClient({
      endpoints: ['https://rpc.example.com'],
      maxRetries: 1
    });

    try {
      await client.getBlockInfo('HASH');
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors[0].message).toBe('Network error connecting to rpc.example.com');
    }
  });
});
