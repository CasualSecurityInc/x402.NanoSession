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
}

/**
 * In-memory implementation of SpentSetStorage
 * Suitable for development and testing
 * For production, use a persistent storage implementation
 */
export class InMemorySpentSet implements SpentSetStorage {
  private spentHashes: Set<string>;

  constructor() {
    this.spentHashes = new Set();
  }

  async has(blockHash: string): Promise<boolean> {
    return this.spentHashes.has(blockHash);
  }

  async add(blockHash: string): Promise<void> {
    this.spentHashes.add(blockHash);
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
}
