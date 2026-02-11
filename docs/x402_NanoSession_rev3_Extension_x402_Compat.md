---
title: "x402 Compatibility Extension"
version: "rev3"
status: "draft"
---

# x402 Compatibility Extension

## Abstract

This document specifies the compatibility layer between the NanoSession protocol and the x402 payment standard. NanoSession implements the x402 protocol for feeless, instant machine-to-machine payments using the Nano cryptocurrency.

## Motivation

The x402 standard provides a uniform way to request and verify payments over HTTP. By implementing x402 compatibility, NanoSession can:

- Integrate with existing x402 infrastructure
- Use standardized payment headers
- Support both direct verification and facilitator delegation
- Enable seamless interoperability with other x402-compliant systems

## Schema Mapping

### PaymentRequirements Mapping

NanoSession maps its protocol-specific fields to x402 PaymentRequirements:

| x402 Field | NanoSession Source | Description |
|------------|-------------------|-------------|
| `scheme` | Constant: `"nano-session"` | Protocol identifier |
| `network` | Constant: `"nano:mainnet"` | CAIP-2 chain identifier |
| `asset` | Constant: `"XNO"` | Asset identifier |
| `amount` | `X-Payment-Amount` header | Amount in raw (smallest unit) |
| `payTo` | `X-Payment-Address` header | Destination Nano address |
| `maxTimeoutSeconds` | `X-Payment-Expires` header | Expiration time |
| `extra.tag` | `X-Payment-Tag` header | Payment tag |
| `extra.sessionId` | Generated UUID | Session identifier |
| `extra.tagModulus` | Constant: `10000000` | Tag modulus for validation |
| `extra.expiresAt` | ISO 8601 timestamp | Expiration timestamp |

### PaymentPayload Mapping

| x402 Field | NanoSession Source | Description |
|------------|-------------------|-------------|
| `blockHash` | Nano block hash | 64-character hex string |

## TypeScript Interfaces

```typescript
// x402 PaymentRequirements
interface PaymentRequirements {
  scheme: string;              // "nano-session"
  network: string;             // "nano:mainnet"
  asset: string;               // "XNO"
  amount: string;              // Amount in raw
  payTo: string;               // Nano address
  maxTimeoutSeconds: number;   // Timeout duration
  extra: {
    tag: number;               // Payment tag
    sessionId: string;         // Session UUID
    tagModulus: number;        // Tag modulus
    expiresAt: string;         // ISO 8601 timestamp
  };
}

// x402 PaymentPayload
interface PaymentPayload {
  blockHash: string;           // 64-char hex Nano block hash
}
```

## Bidirectional Conversion

### NanoSession to x402

```typescript
function toX402Requirements(headers: NanoSessionHeaders): PaymentRequirements {
  return {
    scheme: 'nano-session',
    network: 'nano:mainnet',
    asset: 'XNO',
    amount: headers.amount,
    payTo: headers.address,
    maxTimeoutSeconds: calculateTimeout(headers.expiresAt),
    extra: {
      tag: headers.tag,
      sessionId: generateSessionId(),
      tagModulus: 10000000,
      expiresAt: headers.expiresAt
    }
  };
}
```

### x402 to NanoSession

```typescript
function fromX402Requirements(req: PaymentRequirements): NanoSessionHeaders {
  return {
    amount: req.amount,
    address: req.payTo,
    tag: req.extra.tag,
    expiresAt: req.extra.expiresAt
  };
}
```

## FacilitatorHandler Interface

For Faremeter compatibility, implement the FacilitatorHandler interface:

```typescript
interface FacilitatorHandler {
  /** Returns supported payment schemes */
  getSupported(): SupportedScheme[];
  
  /** Generates payment requirements for a request */
  getRequirements(args: {
    amount: string;
    payTo: string;
    maxTimeoutSeconds?: number;
  }): PaymentRequirements;
  
  /** Verifies payment without settling */
  handleVerify(
    requirements: PaymentRequirements,
    payload: PaymentPayload
  ): Promise<VerifyResult | null>;
  
  /** Verifies and settles payment */
  handleSettle(
    requirements: PaymentRequirements,
    payload: PaymentPayload
  ): Promise<SettleResult | null>;
}

interface SupportedScheme {
  x402Version: string;
  scheme: string;
  network: string;
}

interface VerifyResult {
  isValid: boolean;
  error?: string;
}

interface SettleResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}
```

## PaymentHandler Interface

For x402 client compatibility, implement the PaymentHandler interface:

```typescript
type PaymentHandler = (
  context: unknown,
  accepts: PaymentRequirements[]
) => Promise<PaymentExecer[]>;

interface PaymentExecer {
  requirements: PaymentRequirements;
  exec: () => Promise<{ payload: PaymentPayload }>;
}
```

## Verification Flow

### Direct Verification (No Facilitator)

1. Server receives request with `X-Payment-Response` header
2. Server parses PaymentPayload from header
3. Server calls Nano RPC `block_info` with block hash
4. Server verifies:
   - Block is confirmed
   - Block destination matches `payTo`
   - Block amount matches `amount`
   - Block tag matches expected tag
   - Block hash not in spent set
5. Server marks block hash as spent
6. Server grants access

### Facilitator Delegation

1. Server receives request with `X-Payment-Response` header
2. Server forwards to facilitator with PaymentRequirements and PaymentPayload
3. Facilitator verifies via Nano RPC
4. Facilitator returns verification result
5. Server grants or denies access based on result

## HTTP Headers

### 402 Response Headers

```
HTTP/1.1 402 Payment Required
X-Payment-Required: {"scheme":"nano-session","network":"nano:mainnet",...}
Content-Type: application/json

{"error":"Payment required"}
```

### Payment Request Headers

```
GET /protected-resource HTTP/1.1
Host: example.com
X-Payment-Response: {"blockHash":"ABC123..."}
```

## Amount Precision

Nano uses 30 decimal places (raw is the smallest unit):

| XNO | Raw |
|-----|-----|
| 1 XNO | 1000000000000000000000000000000 |
| 0.001 XNO | 1000000000000000000000000 |
| 0.000001 XNO | 1000000000000000000000 |

## Security Considerations

### Spent Set

To prevent double-spending, servers must track spent block hashes:

- Store block hashes that have been successfully settled
- Reject payments with previously seen block hashes
- Default implementation uses in-memory storage
- Production systems should use persistent storage

### Tag Validation

Payment tags prevent replay attacks:

- Tags are derived from block hash modulo TAG_MODULUS
- Servers verify tag matches expected value
- Valid tags: 0 to TAG_MODULUS-1 (0 to 9,999,999)

### Timeout

Payment requirements include expiration:

- Default: 5 minutes (300 seconds)
- Servers should reject expired payment attempts
- Clients should verify payment hasn't expired before broadcasting

## Network Identifiers

### CAIP-2 Format

NanoSession uses the unofficial CAIP-2 identifier:

```
nano:mainnet  // Main network
nano:beta     // Beta network (for testing)
```

Note: Official CAIP-2 registration for Nano is pending.

## References

- [x402 Specification](https://github.com/coinbase/x402)
- [Nano Protocol Documentation](https://docs.nano.org/)
- [CAIP-2 Blockchain IDs](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)

## Implementation

Reference implementations:

- `@nanosession/server` - FacilitatorHandler implementation
- `@nanosession/client` - PaymentHandler implementation
- `@nanosession/core` - Types and schema mapping
- `@nanosession/rpc` - Nano RPC client
