---
title: "x402 Compatibility Extension"
version: "rev5"
status: "draft"
date: "February 12, 2026"
---

# x402 Compatibility Extension

## Abstract

This document specifies the compatibility layer between NanoSession and the x402 payment standard. NanoSession implements x402 for feeless, instant machine-to-machine payments using Nano cryptocurrency.

## Motivation

The x402 standard provides a uniform way to request and verify payments over HTTP. By implementing x402 compatibility, NanoSession can:

- Integrate with existing x402 infrastructure (e.g., Faremeter)
- Use standardized payment headers and JSON structures
- Support both direct verification and facilitator delegation
- Enable interoperability with other x402-compliant systems

## Why Not "Exact" x402?

The original x402 protocol (x402.org) uses **wallet-signed authorizations** (EIP-712) where the client signs a message binding the payment to a specific request. NanoSession cannot use this approach due to Nano's architecture:

### The Frontier Problem

Creating a valid Nano send block requires knowing the account's current **frontier** (the hash of the most recent block). This creates a fundamental incompatibility with pre-signed authorizations:

1. **Frontier changes with every transaction**: If Client A prepares a signed block but Client B's transaction confirms first, Client A's block becomes invalid
2. **No atomic prepare-then-send**: Unlike EVM where you sign an authorization and submit it later, Nano blocks must reference current state
3. **Race conditions**: In high-frequency M2M scenarios, frontier collisions would be common

### No Memo/Data Field

Nano blocks contain only: `previous`, `representative`, `balance`, `link` (destination), `work`, `signature`. There is no arbitrary data field where request context could be embedded.

### Signature Scope

The block signature covers only the block content. It cannot bind the payment to an external request context (like EIP-712 does with typed structured data).

### Conclusion

An "exact" x402 implementation (as explored in projects like [x402nano](https://github.com/example/x402nano)) encounters these **frontier issues** and is not viable for production use. NanoSession's session-based approach provides equivalent security through explicit request binding.

## Schema Mapping

### PaymentRequirements Mapping

NanoSession maps its protocol-specific fields to x402 PaymentRequirements:

| x402 Field | NanoSession Source | Description |
|------------|-------------------|-------------|
| `scheme` | Constant: `"nano-session"` | Protocol identifier |
| `network` | Constant: `"nano:mainnet"` | CAIP-2 chain identifier |
| `asset` | Constant: `"XNO"` | Asset identifier |
| `amount` | `X-PAYMENT-AMOUNT` header | Base amount in raw |
| `payTo` | `X-PAYMENT-ADDRESS` header | Destination Nano address |
| `maxTimeoutSeconds` | Derived from `X-PAYMENT-EXPIRES` | Timeout duration |
| `extra.tag` | `X-PAYMENT-TAG` header | Payment tag |
| `extra.sessionId` | `X-PAYMENT-SESSION` header | **Mandatory** session identifier |
| `extra.tagModulus` | `X-PAYMENT-TAG-MODULUS` or default | Tag modulus (default: 10000000) |
| `extra.expiresAt` | `X-PAYMENT-EXPIRES` header | ISO 8601 expiration |

### PaymentPayload Mapping

| x402 Field | NanoSession Source | Description |
|------------|-------------------|-------------|
| `blockHash` | `X-PAYMENT-BLOCK` header | 64-character hex Nano block hash |
| `sessionId` | `X-PAYMENT-SESSION` header | **Mandatory** session identifier |

**Note:** The `sessionId` in the payload is mandatory for security. See [Protocol § Security Model](../protocol.md#1-security-model).

## TypeScript Interfaces

```typescript
// x402 PaymentRequirements
interface PaymentRequirements {
  scheme: string;              // "nano-session"
  network: string;             // "nano:mainnet"
  asset: string;               // "XNO"
  amount: string;              // Base amount in raw
  payTo: string;               // Nano address
  maxTimeoutSeconds: number;   // Timeout duration
  extra: {
    tag: number;               // Payment tag (0 to TAG_MODULUS-1)
    sessionId: string;         // Mandatory session identifier
    tagModulus: number;        // Tag modulus (default: 10000000)
    expiresAt: string;         // ISO 8601 timestamp
  };
}

// x402 PaymentPayload
interface PaymentPayload {
  blockHash: string;           // 64-char hex Nano block hash
  sessionId: string;           // Mandatory: must match requirements
}
```

## Bidirectional Conversion

### NanoSession Headers to x402

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
      sessionId: headers.sessionId,  // Mandatory
      tagModulus: headers.tagModulus ?? 10000000,
      expiresAt: headers.expiresAt
    }
  };
}
```

### x402 to NanoSession Headers

```typescript
function fromX402Requirements(req: PaymentRequirements): NanoSessionHeaders {
  return {
    amount: req.amount,
    address: req.payTo,
    tag: req.extra.tag,
    sessionId: req.extra.sessionId,  // Mandatory
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
  
  /** Generates payment requirements with mandatory sessionId */
  getRequirements(args: {
    amount: string;
    payTo: string;
    maxTimeoutSeconds?: number;
  }): PaymentRequirements;
  
  /** Verifies payment without settling (checks session binding) */
  handleVerify(
    requirements: PaymentRequirements,
    payload: PaymentPayload
  ): Promise<VerifyResult | null>;
  
  /** Verifies and settles payment (marks session consumed) */
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

For x402 client compatibility:

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

## Security Requirements

Implementations MUST:

1. **Generate unique sessionId** for each payment request
2. **Store session→requirements mapping** server-side
3. **Require sessionId in PaymentPayload** from clients
4. **Verify session binding** before accepting payment
5. **Delete session after successful verification** (single-use)

See [Protocol Specification § Security Considerations](../protocol.md#4-security-considerations) for rationale.
