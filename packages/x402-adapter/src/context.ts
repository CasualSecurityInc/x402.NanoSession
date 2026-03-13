import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context for x402 requirement matching and enhancement.
 * Allows preserving session state across rebuild-and-compare cycles
 * in x402ResourceServer.
 */
export interface X402Context {
  /** 
   * The session ID found in the client's request headers (PAYMENT-SIGNATURE).
   * If present, deterministic schemes like NanoSession can use it to 
   * "recover" the exact requirements that were previously issued.
   */
  sessionId?: string;

  /**
   * The URL of the requested resource.
   * Required for Track 2 (nanoSignature) verification to prevent cross-server replays.
   */
  url?: string;
}

/**
 * Storage for x402 context using AsyncLocalStorage.
 */
export const x402ContextStorage = new AsyncLocalStorage<X402Context>();

/**
 * Helper to execute a function within an x402 context.
 * 
 * @param context - The context to set
 * @param fn - The function to execute
 * @returns The result of the function
 */
export function withX402Context<T>(context: X402Context, fn: () => T): T {
  return x402ContextStorage.run(context, fn);
}
