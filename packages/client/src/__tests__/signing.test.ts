import { describe, test, expect } from 'vitest';
import { signMessage, deriveKeyPair } from '../signing.js';

describe('signing', () => {
    test('signMessage generates valid deterministic Ed25519 signature', () => {
        const seed = '0'.repeat(64);
        const keyPair = deriveKeyPair(seed, 0);
        const message = 'MOCK_BLOCK_HASHhttps://api.example.com/data';

        const secretKeyHex = Buffer.from(keyPair.secretKey).toString('hex');
        const signature = signMessage(message, secretKeyHex);

        expect(signature).toBeDefined();
        expect(signature).toMatch(/^[0-9A-Fa-f]{128}$/);

        // Test determinism
        const signature2 = signMessage(message, secretKeyHex);
        expect(signature).toBe(signature2);
    });
});
