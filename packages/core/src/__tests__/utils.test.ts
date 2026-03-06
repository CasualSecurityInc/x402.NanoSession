import { describe, test, expect } from 'vitest';
import { calculateTaggedAmount } from '../utils.js';
import { SCHEME, NETWORK, ASSET } from '../constants.js';
import type { PaymentRequirements } from '../types.js';

describe('calculateTaggedAmount', () => {
    test('calculates correct amount without multiplier (defaults to 1)', () => {
        const reqs: PaymentRequirements = {
            scheme: SCHEME,
            network: NETWORK,
            asset: ASSET,
            amount: '1000',
            payTo: 'nano_123',
            maxTimeoutSeconds: 60,
            extra: {
                nanoSession: {
                    tag: 42,
                    id: 'test',
                    tagModulus: 100
                }
            }
        };
        expect(calculateTaggedAmount(reqs)).toBe('1042');
    });

    test('calculates correct amount with large multiplier', () => {
        const reqs: PaymentRequirements = {
            scheme: SCHEME,
            network: NETWORK,
            asset: ASSET,
            amount: '10000000000000000000000000000', // 1 XNO
            payTo: 'nano_123',
            maxTimeoutSeconds: 60,
            extra: {
                nanoSession: {
                    tag: 8649,
                    id: 'test',
                    tagModulus: 10000,
                    tagMultiplier: '100000000000000000000' // 10^20
                }
            }
        };
        // 10^28 + 8649 * 10^20 = 10000864900000000000000000000
        expect(calculateTaggedAmount(reqs)).toBe('10000864900000000000000000000');
    });

    test('returns base amount if nanoSession extra is missing', () => {
        const reqs: any = {
            amount: '1000',
            extra: {}
        };
        expect(calculateTaggedAmount(reqs)).toBe('1000');
    });
});
