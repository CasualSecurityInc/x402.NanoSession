/**
 * Calculation utilities for NanoSession
 */

import type { PaymentRequirements } from './types.js';
import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';

/**
 * Derives a Nano address from a seed and account index.
 * 
 * @param seed The 64-character hex seed
 * @param index The Nano account index (default: 0)
 * @returns Standard nano_... address string
 */
export function deriveAddressFromSeed(seed: string, index: number = 0): string {
    const secretKeyHex = deriveSecretKey(seed, index);
    const publicKeyHex = derivePublicKey(secretKeyHex);
    return deriveAddress(publicKeyHex, { useNanoPrefix: true });
}

/**
 * Calculates the total tagged amount for a NanoSession.
 * Formula: taggedAmount = baseAmount + tag
 * 
 * @param requirements The payment requirements containing base amount and tag
 * @returns Total amount in raw as a string
 */
export function calculateTaggedAmount(requirements: PaymentRequirements): string {
    const nanoSession = requirements.extra?.nanoSession;
    if (!nanoSession) {
        return requirements.amount;
    }

    const baseAmount = BigInt(requirements.amount);
    const tag = BigInt(nanoSession.tag);
    const tagMultiplier = BigInt(nanoSession.tagMultiplier || '1');

    return (baseAmount + (tag * tagMultiplier)).toString();
}
