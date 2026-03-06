import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { testApp } from './app';
import crypto from 'crypto';

import { decodePaymentRequired, encodePaymentSignature } from '@nanosession/core';

// Mock process.env for the tests
process.env.NANO_RPC_URL = 'http://localhost:7076';
process.env.NANO_SERVER_ADDRESS = 'nano_3demo1something2something3something4something5something6';

// Mock the SSE module's session registration to ensure isolation
vi.mock('../routes/status', async () => {
    const actual = await vi.importActual('../routes/status');
    return {
        ...(actual as any),
        registerSession: vi.fn(),
    };
});

describe('Demo Server Routes', () => {

    describe('GET /api/protected', () => {

        it('should return 402 Payment Required when no proof is provided', async () => {
            const response = await request(testApp).get('/api/protected');

            expect(response.status).toBe(402);
            expect(response.headers['payment-required']).toBeDefined();

            const paymentRequired = decodePaymentRequired(response.headers['payment-required']);
            const requirements = paymentRequired.accepts[0];

            expect(requirements.network).toBe('nano:mainnet');
            expect(requirements.payTo).toBe(process.env.NANO_SERVER_ADDRESS);
            expect(requirements.amount).toBe('10000000000000000000000000000'); // Base 0.01 XNO
            expect(requirements.extra.nanoSession).toBeDefined();
            expect(requirements.extra.nanoSession.tag).toBeDefined();
            expect(requirements.extra.nanoSession.id).toBeDefined();
            expect(response.body.error).toBe('Payment Required');
            expect(response.body.x402Version).toBe(2);
        });

        it('should return 410 SESSION_LOST for unknown session IDs', async () => {
            const fakeSessionId = crypto.randomUUID();
            const mockSignature = encodePaymentSignature({
                x402Version: 2,
                accepted: {
                    scheme: 'exact',
                    network: 'nano:mainnet',
                    asset: 'XNO',
                    amount: '1000',
                    payTo: 'nano_123',
                    maxTimeoutSeconds: 60,
                    extra: {
                        nanoSession: {
                            tag: 1,
                            id: fakeSessionId,
                            tagModulus: 10
                        }
                    }
                },
                payload: { proof: 'A1B2C3D4A1B2C3D4A1B2C3D4A1B2C3D4' }
            });

            const response = await request(testApp)
                .get('/api/protected')
                .set('PAYMENT-SIGNATURE', mockSignature);

            expect(response.status).toBe(410);
            expect(response.body.code).toBe('SESSION_LOST');
        });
    });

});
