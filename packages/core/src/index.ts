/**
 * @nanosession/core
 * Core types and constants for NanoSession x402 integration
 */

// Constants
export const TAG_MODULUS = 10_000_000;
export const SCHEME = 'nano-session';
export const NETWORK = 'nano:mainnet';
export const ASSET = 'XNO';

// Version
export const VERSION = '0.1.0';

// Placeholder for future types
export interface NanoSessionHeaders {
  sessionId: string;
  address: string;
  priceRaw: string;
  tag: number;
  expires: string;
}

// Placeholder for future functions
export function hello(): string {
  return 'Hello from @nanosession/core!';
}
