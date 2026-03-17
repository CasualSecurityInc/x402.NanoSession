import { describe, test, expect } from 'vitest';
import {
  PAYMENT_IDENTIFIER,
  PAYMENT_ID_MIN_LENGTH,
  PAYMENT_ID_MAX_LENGTH,
  PAYMENT_ID_PATTERN,
  paymentIdentifierSchema,
  generatePaymentId,
  isValidPaymentId,
  isPaymentIdentifierExtension,
  declarePaymentIdentifierExtension,
  appendPaymentIdentifierToExtensions,
  extractPaymentIdentifier,
  hasPaymentIdentifier,
  isPaymentIdentifierRequired,
  validatePaymentIdentifierRequirement,
  validatePaymentIdentifier
} from '../payment-identifier.js';
import type { PaymentPayload } from '../types.js';

// ── Test helpers ─────────────────────────────────────────────────────

function makePayload(extensions?: Record<string, unknown>): PaymentPayload {
  return {
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network: 'nano:mainnet',
      asset: 'XNO',
      amount: '1000000',
      payTo: 'nano_abc',
      maxTimeoutSeconds: 180,
      extra: {
        nanoSession: {
          id: 'session-1',
          tag: 1234,
          resourceAmountRaw: '999000',
          tagAmountRaw: '1000'
        }
      }
    },
    payload: { proof: 'DEADBEEF' },
    ...(extensions !== undefined ? { extensions } : {})
  };
}

// ── Constants ────────────────────────────────────────────────────────

describe('constants', () => {
  test('PAYMENT_IDENTIFIER is the canonical extension key', () => {
    expect(PAYMENT_IDENTIFIER).toBe('payment-identifier');
  });

  test('length bounds are sensible', () => {
    expect(PAYMENT_ID_MIN_LENGTH).toBe(16);
    expect(PAYMENT_ID_MAX_LENGTH).toBe(128);
  });

  test('PAYMENT_ID_PATTERN accepts alphanumeric, hyphens, underscores', () => {
    expect(PAYMENT_ID_PATTERN.test('pay_abc123-XYZ_00')).toBe(true);
    expect(PAYMENT_ID_PATTERN.test('has spaces')).toBe(false);
    expect(PAYMENT_ID_PATTERN.test('special!@#')).toBe(false);
  });
});

// ── Schema ───────────────────────────────────────────────────────────

describe('paymentIdentifierSchema', () => {
  test('is valid JSON Schema Draft 2020-12', () => {
    expect(paymentIdentifierSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(paymentIdentifierSchema.type).toBe('object');
    expect(paymentIdentifierSchema.required).toEqual(['required']);
  });

  test('declares id field with correct constraints', () => {
    expect(paymentIdentifierSchema.properties.id.minLength).toBe(PAYMENT_ID_MIN_LENGTH);
    expect(paymentIdentifierSchema.properties.id.maxLength).toBe(PAYMENT_ID_MAX_LENGTH);
  });
});

// ── generatePaymentId ────────────────────────────────────────────────

describe('generatePaymentId', () => {
  test('generates valid IDs with default prefix', () => {
    const id = generatePaymentId();
    expect(id).toMatch(/^pay_[a-f0-9]{32}$/);
    expect(isValidPaymentId(id)).toBe(true);
  });

  test('generates valid IDs with custom prefix', () => {
    const id = generatePaymentId('txn_');
    expect(id).toMatch(/^txn_[a-f0-9]{32}$/);
    expect(isValidPaymentId(id)).toBe(true);
  });

  test('generates valid IDs with empty prefix', () => {
    const id = generatePaymentId('');
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(isValidPaymentId(id)).toBe(true);
  });

  test('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePaymentId()));
    expect(ids.size).toBe(100);
  });
});

// ── isValidPaymentId ─────────────────────────────────────────────────

describe('isValidPaymentId', () => {
  test('accepts valid IDs', () => {
    expect(isValidPaymentId('pay_abcdef1234567890')).toBe(true);
    expect(isValidPaymentId('a'.repeat(16))).toBe(true);
    expect(isValidPaymentId('a'.repeat(128))).toBe(true);
    expect(isValidPaymentId('abc-def_123-XYZ_0')).toBe(true);
  });

  test('rejects too-short IDs', () => {
    expect(isValidPaymentId('a'.repeat(15))).toBe(false);
    expect(isValidPaymentId('')).toBe(false);
  });

  test('rejects too-long IDs', () => {
    expect(isValidPaymentId('a'.repeat(129))).toBe(false);
  });

  test('rejects invalid characters', () => {
    expect(isValidPaymentId('pay_with spaces!!')).toBe(false);
    expect(isValidPaymentId('pay_special@chars')).toBe(false);
    expect(isValidPaymentId('pay_has.dots.here')).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isValidPaymentId(42 as unknown as string)).toBe(false);
    expect(isValidPaymentId(null as unknown as string)).toBe(false);
    expect(isValidPaymentId(undefined as unknown as string)).toBe(false);
  });
});

// ── isPaymentIdentifierExtension (type guard) ────────────────────────

describe('isPaymentIdentifierExtension', () => {
  test('accepts valid extension structure', () => {
    const ext = declarePaymentIdentifierExtension();
    expect(isPaymentIdentifierExtension(ext)).toBe(true);
  });

  test('accepts extension with id', () => {
    const ext = declarePaymentIdentifierExtension();
    ext.info.id = generatePaymentId();
    expect(isPaymentIdentifierExtension(ext)).toBe(true);
  });

  test('rejects null/undefined/primitive', () => {
    expect(isPaymentIdentifierExtension(null)).toBe(false);
    expect(isPaymentIdentifierExtension(undefined)).toBe(false);
    expect(isPaymentIdentifierExtension('string')).toBe(false);
    expect(isPaymentIdentifierExtension(42)).toBe(false);
  });

  test('rejects missing info', () => {
    expect(isPaymentIdentifierExtension({})).toBe(false);
    expect(isPaymentIdentifierExtension({ schema: {} })).toBe(false);
  });

  test('rejects info without required boolean', () => {
    expect(isPaymentIdentifierExtension({ info: {} })).toBe(false);
    expect(isPaymentIdentifierExtension({ info: { required: 'yes' } })).toBe(false);
  });
});

// ── declarePaymentIdentifierExtension ────────────────────────────────

describe('declarePaymentIdentifierExtension', () => {
  test('creates optional declaration by default', () => {
    const ext = declarePaymentIdentifierExtension();
    expect(ext.info.required).toBe(false);
    expect(ext.info.id).toBeUndefined();
    expect(ext.schema).toEqual(paymentIdentifierSchema);
  });

  test('creates required declaration', () => {
    const ext = declarePaymentIdentifierExtension(true);
    expect(ext.info.required).toBe(true);
  });
});

// ── appendPaymentIdentifierToExtensions ──────────────────────────────

describe('appendPaymentIdentifierToExtensions', () => {
  test('appends generated id when extension is declared', () => {
    const extensions: Record<string, unknown> = {
      [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension()
    };
    const result = appendPaymentIdentifierToExtensions(extensions);
    expect(result).toBe(extensions); // same reference

    const ext = extensions[PAYMENT_IDENTIFIER] as { info: { id?: string } };
    expect(ext.info.id).toBeDefined();
    expect(isValidPaymentId(ext.info.id!)).toBe(true);
  });

  test('appends custom id', () => {
    const extensions: Record<string, unknown> = {
      [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension()
    };
    const customId = 'pay_custom_id_abcdef';
    appendPaymentIdentifierToExtensions(extensions, customId);

    const ext = extensions[PAYMENT_IDENTIFIER] as { info: { id?: string } };
    expect(ext.info.id).toBe(customId);
  });

  test('returns unchanged extensions when extension not declared', () => {
    const extensions: Record<string, unknown> = { other: 'value' };
    const result = appendPaymentIdentifierToExtensions(extensions);
    expect(result).toBe(extensions);
    expect(extensions[PAYMENT_IDENTIFIER]).toBeUndefined();
  });

  test('throws on invalid custom id', () => {
    const extensions: Record<string, unknown> = {
      [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension()
    };
    expect(() =>
      appendPaymentIdentifierToExtensions(extensions, 'short')
    ).toThrow(/Invalid payment ID/);
  });
});

// ── extractPaymentIdentifier ─────────────────────────────────────────

describe('extractPaymentIdentifier', () => {
  test('extracts id from valid payload', () => {
    const id = generatePaymentId();
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: {
        info: { required: false, id },
        schema: paymentIdentifierSchema
      }
    });
    expect(extractPaymentIdentifier(payload)).toBe(id);
  });

  test('returns null when no extensions', () => {
    expect(extractPaymentIdentifier(makePayload())).toBeNull();
  });

  test('returns null when extension present but no id', () => {
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: {
        info: { required: false },
        schema: paymentIdentifierSchema
      }
    });
    expect(extractPaymentIdentifier(payload)).toBeNull();
  });

  test('returns null for invalid id when validate=true', () => {
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: {
        info: { required: false, id: 'bad' },
        schema: paymentIdentifierSchema
      }
    });
    expect(extractPaymentIdentifier(payload, true)).toBeNull();
  });

  test('returns invalid id when validate=false', () => {
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: {
        info: { required: false, id: 'bad' },
        schema: paymentIdentifierSchema
      }
    });
    expect(extractPaymentIdentifier(payload, false)).toBe('bad');
  });
});

// ── hasPaymentIdentifier ─────────────────────────────────────────────

describe('hasPaymentIdentifier', () => {
  test('returns true when extension present', () => {
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension()
    });
    expect(hasPaymentIdentifier(payload)).toBe(true);
  });

  test('returns false when no extensions', () => {
    expect(hasPaymentIdentifier(makePayload())).toBe(false);
  });

  test('returns false when extensions present but no payment-identifier', () => {
    expect(hasPaymentIdentifier(makePayload({ other: true }))).toBe(false);
  });
});

// ── isPaymentIdentifierRequired ──────────────────────────────────────

describe('isPaymentIdentifierRequired', () => {
  test('returns true when required', () => {
    expect(isPaymentIdentifierRequired(declarePaymentIdentifierExtension(true))).toBe(true);
  });

  test('returns false when optional', () => {
    expect(isPaymentIdentifierRequired(declarePaymentIdentifierExtension(false))).toBe(false);
  });

  test('returns false for non-extension values', () => {
    expect(isPaymentIdentifierRequired(null)).toBe(false);
    expect(isPaymentIdentifierRequired(undefined)).toBe(false);
    expect(isPaymentIdentifierRequired({})).toBe(false);
  });
});

// ── validatePaymentIdentifierRequirement ─────────────────────────────

describe('validatePaymentIdentifierRequirement', () => {
  test('passes when not required', () => {
    const result = validatePaymentIdentifierRequirement(makePayload(), false);
    expect(result.valid).toBe(true);
  });

  test('passes when required and id present', () => {
    const id = generatePaymentId();
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: {
        info: { required: true, id },
        schema: paymentIdentifierSchema
      }
    });
    const result = validatePaymentIdentifierRequirement(payload, true);
    expect(result.valid).toBe(true);
  });

  test('fails when required but id missing', () => {
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: {
        info: { required: true },
        schema: paymentIdentifierSchema
      }
    });
    const result = validatePaymentIdentifierRequirement(payload, true);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toMatch(/requires a payment identifier/);
  });

  test('fails when required but id has invalid format', () => {
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: {
        info: { required: true, id: 'short' },
        schema: paymentIdentifierSchema
      }
    });
    const result = validatePaymentIdentifierRequirement(payload, true);
    expect(result.valid).toBe(false);
    expect(result.errors![0]).toMatch(/Invalid payment ID format/);
  });
});

// ── validatePaymentIdentifier ────────────────────────────────────────

describe('validatePaymentIdentifier', () => {
  test('validates correct extension', () => {
    const ext = declarePaymentIdentifierExtension();
    expect(validatePaymentIdentifier(ext).valid).toBe(true);
  });

  test('validates extension with valid id', () => {
    const ext = declarePaymentIdentifierExtension();
    ext.info.id = generatePaymentId();
    expect(validatePaymentIdentifier(ext).valid).toBe(true);
  });

  test('fails for non-object', () => {
    const result = validatePaymentIdentifier(null);
    expect(result.valid).toBe(false);
    expect(result.errors![0]).toMatch(/must be an object/);
  });

  test('fails for missing info', () => {
    const result = validatePaymentIdentifier({});
    expect(result.valid).toBe(false);
    expect(result.errors![0]).toMatch(/must have an 'info' property/);
  });

  test('fails for missing required boolean', () => {
    const result = validatePaymentIdentifier({ info: {} });
    expect(result.valid).toBe(false);
    expect(result.errors![0]).toMatch(/must have a 'required' boolean/);
  });

  test('fails for non-string id', () => {
    const result = validatePaymentIdentifier({ info: { required: false, id: 42 } });
    expect(result.valid).toBe(false);
    expect(result.errors![0]).toMatch(/'id' must be a string/);
  });

  test('fails for invalid id format', () => {
    const result = validatePaymentIdentifier({ info: { required: false, id: 'bad' } });
    expect(result.valid).toBe(false);
    expect(result.errors![0]).toMatch(/Invalid payment ID format/);
  });
});

// ── End-to-end flow ──────────────────────────────────────────────────

describe('end-to-end flow', () => {
  test('server declares → client appends → server extracts', () => {
    // Server: declare support
    const serverExtensions: Record<string, unknown> = {
      [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension()
    };

    // Client: append id
    appendPaymentIdentifierToExtensions(serverExtensions);

    // Client: build payload with extensions
    const payload = makePayload(serverExtensions);

    // Server: extract id
    const id = extractPaymentIdentifier(payload);
    expect(id).toBeDefined();
    expect(isValidPaymentId(id!)).toBe(true);
  });

  test('required flow: server requires → client provides → validation passes', () => {
    const ext = declarePaymentIdentifierExtension(true);
    const extensions: Record<string, unknown> = { [PAYMENT_IDENTIFIER]: ext };

    appendPaymentIdentifierToExtensions(extensions);
    const payload = makePayload(extensions);

    const serverRequired = isPaymentIdentifierRequired(ext);
    expect(serverRequired).toBe(true);

    const result = validatePaymentIdentifierRequirement(payload, serverRequired);
    expect(result.valid).toBe(true);
  });

  test('required flow: server requires → client omits → validation fails', () => {
    const payload = makePayload({
      [PAYMENT_IDENTIFIER]: { info: { required: true }, schema: paymentIdentifierSchema }
    });

    const result = validatePaymentIdentifierRequirement(payload, true);
    expect(result.valid).toBe(false);
  });
});
