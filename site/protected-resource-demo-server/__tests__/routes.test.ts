import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { testApp, testRegisterSession } from './app';
import crypto from 'crypto';

// Mock process.env for the tests
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

        it('should return 402 Payment Required when access is denied', async () => {
            const response = await request(testApp).get('/api/protected');

            expect(response.status).toBe(402);
            expect(response.headers['x-payment-required']).toBeDefined();

            const requirements = JSON.parse(response.headers['x-payment-required']);

            expect(requirements.network).toBe('nano:mainnet');
            expect(requirements.payTo).toBe(process.env.NANO_SERVER_ADDRESS);
            expect(requirements.amount).toBe('10000000000000000000000000000'); // Base 0.01 XNO
            expect(requirements.extra).toBeDefined();
            expect(requirements.extra.tag).toBeDefined();
            expect(requirements.extra.sessionId).toBeDefined();
            expect(response.body.error).toBe('Payment Required');
            expect(response.body.x402Version).toBe(5);
        });

        it('should reject invalid payment proofs with a 402', async () => {
            const fakeSessionId = crypto.randomUUID();
            // In our mock, submitting a fake hash without a real confirmed Nano block should fail
            const response = await request(testApp)
                .get('/api/protected')
                .set('X-Payment-Block', 'A1B2C3D4A1B2C3D4A1B2C3D4A1B2C3D4')
                .set('X-Payment-Session', fakeSessionId);

            expect(response.status).toBe(402);
        });
    });

});
