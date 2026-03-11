import { describe, it, expect } from 'vitest';
import {
  parseMoneyToRawNano,
  isAssetAmount,
  toNanoRequirements,
  toX402Requirements,
  toNanoPayload,
  toX402Payload,
  isNanoSessionRequirements,
  getDefaultNanoAssetAmount
} from '../converter.js';
import { SCHEME, NETWORK, ASSET, createPaymentRequirements } from '@nanosession/core';

describe('parseMoneyToRawNano', () => {
  it('parses whole numbers', () => {
    expect(parseMoneyToRawNano('1')).toBe('1000000000000000000000000000000');
    expect(parseMoneyToRawNano('10')).toBe('10000000000000000000000000000000');
  });

  it('parses decimal numbers', () => {
    expect(parseMoneyToRawNano('0.001')).toBe('1000000000000000000000000000');
    expect(parseMoneyToRawNano('0.000001')).toBe('1000000000000000000000000');
  });

  it('handles very small amounts without precision loss', () => {
    expect(parseMoneyToRawNano('0.0000001')).toBe('100000000000000000000000');
    expect(parseMoneyToRawNano('0.00000001')).toBe('10000000000000000000000');
  });

  it('strips $ prefix', () => {
    expect(parseMoneyToRawNano('$0.001')).toBe('1000000000000000000000000000');
    expect(parseMoneyToRawNano('$ 0.001')).toBe('1000000000000000000000000000');
  });

  it('handles zero', () => {
    expect(parseMoneyToRawNano('0')).toBe('0');
    expect(parseMoneyToRawNano('0.0')).toBe('0');
  });

  it('handles large amounts', () => {
    expect(parseMoneyToRawNano('1337')).toBe('1337000000000000000000000000000000');
  });

  it('throws on invalid format', () => {
    expect(() => parseMoneyToRawNano('abc')).toThrow('Invalid price format');
    expect(() => parseMoneyToRawNano('')).toThrow('Invalid price format');
    expect(() => parseMoneyToRawNano('  ')).toThrow('Invalid price format');
  });
});

describe('isAssetAmount', () => {
  it('returns true for valid AssetAmount', () => {
    expect(isAssetAmount({ amount: '100', asset: 'XNO' })).toBe(true);
    expect(isAssetAmount({ amount: '100', asset: 'XNO', extra: {} })).toBe(true);
  });

  it('returns false for invalid inputs', () => {
    expect(isAssetAmount(null)).toBe(false);
    expect(isAssetAmount(undefined)).toBe(false);
    expect(isAssetAmount('string')).toBe(false);
    expect(isAssetAmount(123)).toBe(false);
    expect(isAssetAmount({ amount: '100' })).toBe(false);
    expect(isAssetAmount({ asset: 'XNO' })).toBe(false);
  });
});

describe('isNanoSessionRequirements', () => {
  it('returns true for matching scheme and network', () => {
    expect(isNanoSessionRequirements({
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      amount: '100',
      payTo: 'nano_abc',
      maxTimeoutSeconds: 300,
    })).toBe(true);
  });

  it('returns false for mismatched scheme', () => {
    expect(isNanoSessionRequirements({
      scheme: 'deferred',
      network: NETWORK,
      asset: ASSET,
      amount: '100',
      payTo: 'nano_abc',
      maxTimeoutSeconds: 300,
    })).toBe(false);
  });

  it('returns false for mismatched network', () => {
    expect(isNanoSessionRequirements({
      scheme: SCHEME,
      network: 'eip155:1',
      asset: ASSET,
      amount: '100',
      payTo: 'nano_abc',
      maxTimeoutSeconds: 300,
    })).toBe(false);
  });
});

describe('toNanoRequirements', () => {
  it('converts valid x402 requirements to NanoSession requirements', () => {
    const x402Req = {
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      amount: '1000000000000000000000000000000',
      payTo: 'nano_test',
      maxTimeoutSeconds: 300,
      extra: {
        nanoSession: {
          id: 'abc123',
          tag: 123,
          resourceAmountRaw: '999999999999999999999999999999',
          tagAmountRaw: '1',
          expiresAt: '2024-01-01T00:00:00Z',
        }
      }
    };

    const result = toNanoRequirements(x402Req);
    expect(result).not.toBeNull();
    expect(result?.scheme).toBe(SCHEME);
    expect(result?.network).toBe(NETWORK);
    expect(result?.extra.nanoSession.id).toBe('abc123');
    expect(result?.extra.nanoSession.tag).toBe(123);
  });

  it('returns null when nanoSession extra is missing', () => {
    const x402Req = {
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      amount: '100',
      payTo: 'nano_test',
      maxTimeoutSeconds: 300,
    };

    expect(toNanoRequirements(x402Req as any)).toBeNull();
  });

  it('returns null when required nanoSession fields are missing', () => {
    const x402Req = {
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      amount: '100',
      payTo: 'nano_test',
      maxTimeoutSeconds: 300,
      extra: {
        nanoSession: {
          id: 'abc123',
          // missing tag, resourceAmountRaw, tagAmountRaw
        }
      }
    };

    expect(toNanoRequirements(x402Req as any)).toBeNull();
  });
});

describe('toX402Requirements', () => {
  it('converts NanoSession requirements to x402 requirements', () => {
    const nanoReq = createPaymentRequirements({
      payTo: 'nano_test',
      maxTimeoutSeconds: 300,
      id: 'abc123',
      tag: 123,
      resourceAmountRaw: '999',
      tagAmountRaw: '1',
      amount: '1000',
      expiresAt: '2024-01-01T00:00:00Z',
    });

    const result = toX402Requirements(nanoReq);
    expect(result.scheme).toBe(SCHEME);
    expect(result.network).toBe(NETWORK);
    expect((result.extra?.nanoSession as any)?.id).toBe('abc123');
    expect((result.extra?.nanoSession as any)?.tag).toBe(123);
  });
});

describe('toNanoPayload', () => {
  it('converts valid x402 payload to NanoSession payload', () => {
    const nanoReq = createPaymentRequirements({
      payTo: 'nano_test',
      maxTimeoutSeconds: 300,
      id: 'abc123',
      tag: 123,
      resourceAmountRaw: '999',
      tagAmountRaw: '1',
      amount: '1000',
      expiresAt: '2024-01-01T00:00:00Z',
    });

    const x402Payload = {
      x402Version: 2,
      payload: {
        proof: 'ABC123BLOCKHASH',
      },
    };

    const result = toNanoPayload(x402Payload, nanoReq);
    expect(result).not.toBeNull();
    expect(result?.payload.proof).toBe('ABC123BLOCKHASH');
    expect(result?.accepted.extra.nanoSession.id).toBe('abc123');
  });

  it('returns null when proof is missing', () => {
    const nanoReq = createPaymentRequirements({
      payTo: 'nano_test',
      maxTimeoutSeconds: 300,
      id: 'abc123',
      tag: 123,
      resourceAmountRaw: '999',
      tagAmountRaw: '1',
      amount: '1000',
      expiresAt: '2024-01-01T00:00:00Z',
    });

    const x402Payload = {
      x402Version: 2,
      payload: {},
    };

    expect(toNanoPayload(x402Payload as any, nanoReq)).toBeNull();
  });
});

describe('toX402Payload', () => {
  it('converts NanoSession payload to x402 payload', () => {
    const nanoReq = createPaymentRequirements({
      payTo: 'nano_test',
      maxTimeoutSeconds: 300,
      id: 'abc123',
      tag: 123,
      resourceAmountRaw: '999',
      tagAmountRaw: '1',
      amount: '1000',
      expiresAt: '2024-01-01T00:00:00Z',
    });

    const nanoPayload = {
      x402Version: 2 as const,
      accepted: nanoReq,
      payload: {
        proof: 'ABC123BLOCKHASH',
      },
      extensions: { custom: 'data' },
    };

    const result = toX402Payload(nanoPayload as any);
    expect(result.x402Version).toBe(2);
    expect(result.payload.proof).toBe('ABC123BLOCKHASH');
    expect(result.extra).toEqual({ custom: 'data' });
  });
});

describe('getDefaultNanoAssetAmount', () => {
  it('returns correct AssetAmount for price', () => {
    const result = getDefaultNanoAssetAmount('0.001');
    expect(result.amount).toBe('1000000000000000000000000000');
    expect(result.asset).toBe(ASSET);
    expect(result.extra?.decimals).toBe(30);
  });
});
