import { deriveAddressFromSeed } from '@nanosession/core';

/**
 * Interface for providing payment addresses based on session identifiers.
 * This can be used to implement unique addresses per session or a static address.
 * 
 * According to Extension A (Pools), the facilitator can support multiple
 * destination addresses to improve scalability.
 */
export interface AddressPool {
    /**
     * Returns the Nano address for the given session.
     * @param sessionId The session identifier
     */
    getAddress(sessionId: string): string;
}

/**
 * A standard implementation of AddressPool that returns a single static address
 * derived from a seed and account index.
 */
export class StandardAccountPool implements AddressPool {
    private seed: string;
    private accountIndex: number;

    /**
     * @param seed The 64-character hex seed
     * @param accountIndex The Nano account index (default: 1)
     */
    constructor(seed: string, accountIndex: number = 1) {
        this.seed = seed;
        this.accountIndex = accountIndex;
    }

    /**
     * Returns the static Nano address for all sessions.
     * @param _sessionId The session ID (ignored in this implementation)
     */
    getAddress(_sessionId: string): string {
        return deriveAddressFromSeed(this.seed, this.accountIndex);
    }
}
