import { describe, test, expect } from 'vitest';
import { toX402Requirements, fromX402Requirements } from '../mapping.js';
import { TAG_MODULUS, SCHEME, NETWORK, ASSET } from '../constants.js';
import type { NanoSessionHeaders, PaymentRequirements } from '../types.js';

describe('toX402Requirements', () => {
  test('converts NanoSession headers to PaymentRequirements', () => {
    const headers: NanoSessionHeaders = {
      sessionId: 'test-session-123',
      address: 'nano_3xrpwut8n3w7rc7uwpz7yq5u3y1x3y4y5y6y7y8y9y0y1y2y3y4y5y6y7y8',
      priceRaw: '10000000000000000000000000',
      tag: 42,
      expires: new Date(Date.now() + 300000).toISOString()
    };
    
    const result = toX402Requirements(headers);
    
    expect(result.scheme).toBe(SCHEME);
    expect(result.network).toBe(NETWORK);
    expect(result.asset).toBe(ASSET);
    expect(result.amount).toBe(headers.priceRaw);
    expect(result.payTo).toBe(headers.address);
    expect(result.extra.tag).toBe(headers.tag);
    expect(result.extra.sessionId).toBe(headers.sessionId);
  });
  
  test('throws error for invalid tag >= TAG_MODULUS', () => {
    const headers: NanoSessionHeaders = {
      sessionId: 'test',
      address: 'nano_test',
      priceRaw: '10000000',
      tag: TAG_MODULUS,
      expires: new Date().toISOString()
    };
    
    expect(() => toX402Requirements(headers)).toThrow();
  });
});

describe('fromX402Requirements', () => {
  test('converts PaymentRequirements to NanoSession headers', () => {
    const requirements: PaymentRequirements = {
      scheme: SCHEME,
      network: NETWORK,
      asset: ASSET,
      amount: '10000000000000000000000000',
      payTo: 'nano_abc123',
      maxTimeoutSeconds: 300,
      extra: {
        tag: 42,
        sessionId: 'test-session',
        tagModulus: TAG_MODULUS,
        expiresAt: new Date().toISOString()
      }
    };
    
    const result = fromX402Requirements(requirements);
    
    expect(result.sessionId).toBe(requirements.extra.sessionId);
    expect(result.address).toBe(requirements.payTo);
    expect(result.priceRaw).toBe(requirements.amount);
    expect(result.tag).toBe(requirements.extra.tag);
  });
});

describe('round-trip mapping', () => {
  test('preserves data integrity', () => {
    const original: NanoSessionHeaders = {
      sessionId: 'round-trip-test',
      address: 'nano_xyz789',
      priceRaw: '5000000000000000000000000',
      tag: 123,
      expires: new Date(Date.now() + 60000).toISOString()
    };
    
    const requirements = toX402Requirements(original);
    const restored = fromX402Requirements(requirements);
    
    expect(restored.sessionId).toBe(original.sessionId);
    expect(restored.address).toBe(original.address);
    expect(restored.priceRaw).toBe(original.priceRaw);
    expect(restored.tag).toBe(original.tag);
  });
});
