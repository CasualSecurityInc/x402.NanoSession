/**
 * NanoSession protocol constants
 */

/** Tag modulus for raw tagging (10 million) */
export const TAG_MODULUS = 10_000_000;

/** Default tag multiplier for shifting decimal precision */
export const DEFAULT_TAG_MULTIPLIER = '1';

/** Scheme identifier for NanoSession */
export const SCHEME = 'exact';

/** Network identifier (CAIP-2 format) - unofficial */
export const NETWORK = 'nano:mainnet';

/** Asset identifier - Nano (XNO) */
export const ASSET = 'XNO';

/** Protocol version */
export const VERSION = '0.1.0';

/** Default payment timeout in seconds (5 minutes) */
export const DEFAULT_TIMEOUT_SECONDS = 300;
