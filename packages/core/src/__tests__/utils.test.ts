import { describe, test, expect } from 'vitest';
import {
    calculateTaggedAmount,
    assertValidPaymentRequirements,
    assertValidRawAmount
} from '../utils.js';
import { SCHEME, NETWORK, ASSET } from '../constants.js';
import type { PaymentRequirements } from '../types.js';

const validRequirements: PaymentRequirements = {
    scheme: SCHEME,
    network: NETWORK,
    asset: ASSET,
    amount: '18007',
    payTo: 'nano_123',
    maxTimeoutSeconds: 60,
    extra: {
        nanoSession: {
            id: 'session-123',
            tag: 8007,
            resourceAmountRaw: '10000',
            tagAmountRaw: '8007'
        }
    }
};

describe('assertValidRawAmount', () => {
    test('accepts canonical raw values', () => {
        expect(() => assertValidRawAmount('0', 'amount')).not.toThrow();
        expect(() => assertValidRawAmount('42', 'amount')).not.toThrow();
        expect(() => assertValidRawAmount('1000000000000000000000000', 'amount')).not.toThrow();
    });

    test('rejects non-canonical raw values', () => {
        expect(() => assertValidRawAmount('01', 'amount')).toThrow();
        expect(() => assertValidRawAmount('-1', 'amount')).toThrow();
        expect(() => assertValidRawAmount('1.23', 'amount')).toThrow();
        expect(() => assertValidRawAmount('abc', 'amount')).toThrow();
    });
});

describe('assertValidPaymentRequirements', () => {
    test('accepts valid requirements with transparent amount parts', () => {
        expect(() => assertValidPaymentRequirements(validRequirements)).not.toThrow();
    });

    test('rejects mismatched amount decomposition', () => {
        const invalid: PaymentRequirements = {
            ...validRequirements,
            amount: '9999'
        };
        expect(() => assertValidPaymentRequirements(invalid)).toThrow(/Amount invariant violation/);
    });
});

describe('calculateTaggedAmount', () => {
    test('returns normative total amount from requirements.amount', () => {
        expect(calculateTaggedAmount(validRequirements)).toBe('18007');
    });
});
