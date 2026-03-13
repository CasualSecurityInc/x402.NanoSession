/**
 * NanoSession protocol constants
 */

import type { Network } from './types.js';

/** Tag modulus for raw tagging (10 million) */
export const TAG_MODULUS = 10_000_000;

/**
 * Tag multiplier for raw tagging (string to preserve precision).
 * Defaults to "1" (no scaling).
 */
export const TAG_MULTIPLIER = '1';

/** Scheme identifier for NanoSession */
export const SCHEME = 'exact';

/** Network identifier (CAIP-2 format) - unofficial */
export const NETWORK: Network = 'nano:mainnet';

/** Asset identifier - Nano (XNO) */
export const ASSET = 'XNO';

/** Protocol version */
export const VERSION = '0.1.0';

/** Default payment timeout in seconds (5 minutes) */
export const DEFAULT_TIMEOUT_SECONDS = 300;
