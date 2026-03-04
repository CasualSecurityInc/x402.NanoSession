import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { testApp } from './app';
import crypto from 'crypto';

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

        it('should return 410 SESSION_LOST for unknown session IDs', async () => {
            const fakeSessionId = crypto.randomUUID();
            const response = await request(testApp)
                .get('/api/protected')
                .set('X-Payment-Block', 'A1B2C3D4A1B2C3D4A1B2C3D4A1B2C3D4')
                .set('X-Payment-Session', fakeSessionId);

            expect(response.status).toBe(410);
            expect(response.body.code).toBe('SESSION_LOST');
        });
    });

});
