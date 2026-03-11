/**
 * Spent set storage interface and implementations
 * Prevents double-spending by tracking used block hashes
 */

/**
 * Interface for spent set storage implementations
 */
export interface SpentSetStorage {
  /**
   * Check if a block hash has been spent
   */
  has(blockHash: string): Promise<boolean>;

  /**
   * Mark a block hash as spent
   */
  add(blockHash: string): Promise<void>;

  /**
   * Atomically add a block hash only if it doesn't already exist.
   * Returns true if added successfully, false if already spent.
   * This is critical for preventing race conditions in settlement.
   */
  addIfNotExists(blockHash: string): Promise<boolean>;
}

/**
 * In-memory implementation of SpentSetStorage
 * Suitable for development and testing
 * For production, use a persistent storage implementation
 */
export class InMemorySpentSet implements SpentSetStorage {
  private spentHashes: Map<string, number>;
  private readonly ttlMs: number;

  /**
   * @param ttlMs Time-to-live in milliseconds (default: 30 days)
   */
  constructor(ttlMs: number = 30 * 24 * 60 * 60 * 1000) {
    this.spentHashes = new Map();
    this.ttlMs = ttlMs;
  }

  async has(blockHash: string): Promise<boolean> {
    const expiry = this.spentHashes.get(blockHash);
    if (!expiry) return false;

    if (expiry < Date.now()) {
      this.spentHashes.delete(blockHash);
      return false;
    }

    return true;
  }

  async add(blockHash: string): Promise<void> {
    this.spentHashes.set(blockHash, Date.now() + this.ttlMs);
  }

  async addIfNotExists(blockHash: string): Promise<boolean> {
    const now = Date.now();
    const expiry = this.spentHashes.get(blockHash);
    
    // Check if exists and not expired
    if (expiry && expiry >= now) {
      return false;
    }
    
    // Atomically set the new expiry
    this.spentHashes.set(blockHash, now + this.ttlMs);
    return true;
  }

  /**
   * Get the number of spent hashes (for testing/debugging)
   */
  size(): number {
    return this.spentHashes.size;
  }

  /**
   * Clear all spent hashes (for testing)
   */
  clear(): void {
    this.spentHashes.clear();
  }

  /**
   * Manual prune of expired entries
   */
  prune(): void {
    const now = Date.now();
    for (const [hash, expiry] of this.spentHashes.entries()) {
      if (expiry < now) {
        this.spentHashes.delete(hash);
      }
    }
  }
}
