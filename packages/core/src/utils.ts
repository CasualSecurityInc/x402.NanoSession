/**
 * Calculation utilities for NanoSession
 */

import type { PaymentRequirements } from './types.js';
import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';

const RAW_AMOUNT_REGEX = /^(0|[1-9][0-9]*)$/;

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
 * Ensures a raw amount string is canonical (non-negative integer, no leading zeros except "0").
 */
export function assertValidRawAmount(raw: string, fieldName: string): void {
    if (!RAW_AMOUNT_REGEX.test(raw)) {
        throw new Error(`Invalid ${fieldName}: expected canonical raw integer string`);
    }
}

/**
 * Validates NanoSession payment requirement invariants.
 * This catches object-shape mismatches and arithmetic inconsistencies early.
 */
export function assertValidPaymentRequirements(requirements: PaymentRequirements): void {
    if (!requirements.extra?.nanoSession && !requirements.extra?.nanoSignature) {
        throw new Error('Missing extra.nanoSession or extra.nanoSignature');
    }

    if (requirements.extra?.nanoSession && requirements.extra?.nanoSignature) {
        throw new Error('Malformed requirements: nanoSession and nanoSignature are mutually exclusive');
    }

    assertValidRawAmount(requirements.amount, 'amount');

    if (requirements.extra?.nanoSession) {
        assertValidRawAmount(requirements.extra.nanoSession.resourceAmountRaw, 'extra.nanoSession.resourceAmountRaw');
        assertValidRawAmount(requirements.extra.nanoSession.tagAmountRaw, 'extra.nanoSession.tagAmountRaw');

        if (!Number.isInteger(requirements.extra.nanoSession.tag) || requirements.extra.nanoSession.tag < 0) {
            throw new Error('Invalid extra.nanoSession.tag: must be a non-negative integer');
        }

        if (!requirements.extra.nanoSession.id) {
            throw new Error('Missing extra.nanoSession.id');
        }

        const expectedTotal = (
            BigInt(requirements.extra.nanoSession.resourceAmountRaw) +
            BigInt(requirements.extra.nanoSession.tagAmountRaw)
        ).toString();

        if (requirements.amount !== expectedTotal) {
            throw new Error(
                `Amount invariant violation: amount=${requirements.amount}, expected=${expectedTotal}`
            );
        }
    } else if (requirements.extra?.nanoSignature) {
        if (!requirements.extra.nanoSignature.messageToSign) {
            throw new Error('Missing extra.nanoSignature.messageToSign');
        }
    }
}

/**
 * Returns the total payment amount for a NanoSession.
 * In the Rev 6 object model, `amount` is normative and equals:
 * `resourceAmountRaw + tagAmountRaw`.
 * 
 * @param requirements The payment requirements object
 * @returns Total amount in raw as a string
 */
export function calculateTaggedAmount(requirements: PaymentRequirements): string {
    assertValidPaymentRequirements(requirements);
    return requirements.amount;
}
