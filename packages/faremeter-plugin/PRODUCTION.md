# Production Deployment Guide

This document covers security-critical requirements for deploying NanoSession with Faremeter in production.

## Critical: Spent Set Storage

**The default in-memory spent set is NOT suitable for production.**

The spent set prevents replay attacks by tracking which block hashes have already been used for payment. The in-memory implementation:
- Resets on server restart (allowing replay of old payments)
- Does not scale across multiple server instances
- Loses data on crashes

### Implementing Persistent Storage

You MUST implement the `SpentSetStorage` interface with a persistent backend:

```typescript
import { SpentSetStorage } from '@nanosession/server';

export interface SpentSetStorage {
  /** Check if a block hash has been spent */
  has(blockHash: string): Promise<boolean>;
  /** Mark a block hash as spent */
  add(blockHash: string): Promise<void>;
}
```

### Redis Implementation (Recommended)

Redis is ideal for spent sets due to its speed, atomic operations, and built-in TTL support.

```typescript
import { createClient } from 'redis';
import type { SpentSetStorage } from '@nanosession/server';

export class RedisSpentSet implements SpentSetStorage {
  private client: ReturnType<typeof createClient>;
  private prefix: string;
  private ttlSeconds: number;

  constructor(options: {
    redisUrl: string;
    prefix?: string;
    ttlSeconds?: number;
  }) {
    this.client = createClient({ url: options.redisUrl });
    this.prefix = options.prefix ?? 'nanosession:spent:';
    // TTL should be longer than max session timeout
    this.ttlSeconds = options.ttlSeconds ?? 86400; // 24 hours
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async has(blockHash: string): Promise<boolean> {
    const result = await this.client.exists(this.prefix + blockHash);
    return result === 1;
  }

  async add(blockHash: string): Promise<void> {
    await this.client.set(this.prefix + blockHash, '1', {
      EX: this.ttlSeconds,
      NX: true, // Only set if not exists (atomic)
    });
  }
}

// Usage:
const spentSet = new RedisSpentSet({
  redisUrl: process.env.REDIS_URL!,
  ttlSeconds: 86400 * 7, // 7 days
});
await spentSet.connect();

const facilitatorHandler = createFacilitatorHandler({
  rpcClient,
  payTo: process.env.NANO_ADDRESS!,
  spentSet, // Pass the persistent implementation
});
```

### PostgreSQL Implementation

For existing database infrastructure:

```typescript
import { Pool } from 'pg';
import type { SpentSetStorage } from '@nanosession/server';

export class PostgresSpentSet implements SpentSetStorage {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS nanosession_spent (
        block_hash VARCHAR(64) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_spent_created_at 
        ON nanosession_spent(created_at);
    `);
  }

  async has(blockHash: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM nanosession_spent WHERE block_hash = $1',
      [blockHash]
    );
    return result.rowCount > 0;
  }

  async add(blockHash: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO nanosession_spent (block_hash) VALUES ($1) ON CONFLICT DO NOTHING',
      [blockHash]
    );
  }

  // Optional: Clean up old entries
  async cleanup(maxAgeSeconds: number): Promise<void> {
    await this.pool.query(
      `DELETE FROM nanosession_spent 
       WHERE created_at < NOW() - INTERVAL '${maxAgeSeconds} seconds'`
    );
  }
}
```

## RPC Node Configuration

### Running Your Own Node

For production, run your own Nano node instead of relying on public RPC endpoints:
- Eliminates rate limiting concerns
- Provides consistent latency
- Ensures privacy (no third-party sees your payment patterns)

```typescript
const rpcClient = new NanoRpcClient({
  endpoints: [
    'http://your-primary-node:7076',
    'http://your-backup-node:7076',
    'https://rpc.nano.to', // Public fallback
  ],
});
```

### Node Requirements

- Enable RPC with `block_info` and `account_info` actions
- Ensure node is synchronized with the network
- Monitor confirmation times (should be < 1 second typically)

## Multi-Instance Deployment

When running multiple server instances:

1. **Shared Spent Set**: All instances MUST share the same spent set storage
2. **Session Affinity**: Not required (sessions are stateless after initial requirements)
3. **Load Balancing**: Standard HTTP load balancing works fine

```
┌──────────────┐     ┌──────────────┐
│  Instance 1  │────▶│              │
├──────────────┤     │    Redis     │
│  Instance 2  │────▶│  Spent Set   │
├──────────────┤     │              │
│  Instance N  │────▶│              │
└──────────────┘     └──────────────┘
```

## Monitoring

### Key Metrics

Monitor these for operational health:

| Metric | Alert Threshold | Description |
|--------|-----------------|-------------|
| Payment verification latency | > 2s | RPC or network issues |
| Spent set size | > 10M entries | May need TTL cleanup |
| Replay attempt rate | > 1% of requests | Possible attack |
| RPC endpoint failures | Any | Switch to backup |

### Logging

Log these events for audit trails:
- Payment verified (success/failure with reason)
- Payment settled (success/failure)
- Replay attempts (block hash already spent)
- Session expirations

## Security Checklist

Before going to production, verify:

- [ ] **Spent set is persistent** (Redis, PostgreSQL, etc.)
- [ ] **Spent set is shared** across all server instances
- [ ] **RPC endpoint is reliable** (own node or multiple fallbacks)
- [ ] **Environment variables are secured** (not in code, not in logs)
- [ ] **HTTPS is enforced** for all payment-related endpoints
- [ ] **Rate limiting** is in place to prevent abuse
- [ ] **Monitoring and alerting** are configured
- [ ] **Backup RPC endpoints** are configured

## Attack Mitigations

| Attack | Mitigation |
|--------|------------|
| Receipt Theft | Session-bound tags (built-in to NanoSession) |
| Replay Attack | Persistent spent set (YOU must implement) |
| Session Spoofing | Cryptographically random session IDs (built-in) |
| Double Spend | Nano's block-lattice prevents this at protocol level |

## TTL Considerations

Spent set entries can be cleaned up after a reasonable time:

- **Minimum TTL**: `maxTimeoutSeconds + buffer` (e.g., 10 minutes)
- **Recommended TTL**: 24 hours to 7 days
- **Maximum practical TTL**: Unlimited (but increases storage)

Block hashes are unique per transaction, so the only concern is storage costs, not security.
