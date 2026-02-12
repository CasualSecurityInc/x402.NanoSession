---
title: "x402 Compatibility Extension"
version: "rev4"
status: "draft"
date: "February 12, 2026"
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

## Verification

- The rev4 version MUST reference the rev4 protocol in its Extension For value.
- All content otherwise mirrors rev3, with only metadata updated.
