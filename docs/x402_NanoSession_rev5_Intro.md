---
title: Intro
---

# x402.NanoSession (Rev 5) — Intro

x402.NanoSession defines a per-request HTTP 402 payment scheme for access to web resources and APIs. Payments are settled instantly and feelessly via Nano (XNO), avoiding smart‑contract overhead.

| Feature | Original x402 (x402.org) | x402.NanoSession Rev 5 |
| --- | --- | --- |
| Transport | HTTP 402 with payment headers | HTTP 402 with X-PAYMENT headers |
| Payment rail | Onchain stablecoins (e.g., USDC on Base) | Nano (XNO): feeless, sub-second finality |
| Client proof | Transfer authorization (EIP-3009) | Session-bound block hash |
| Request binding | Payment parameters signed via EIP-712 | Mandatory session ID |
| Concurrency | Per-request wallet signature | Multiplexed via unique session + tag per address |

## Why "NanoSession"?

The name reflects a core architectural truth: **the session is the security primitive**.

Nano's block-lattice is publicly observable in real-time. Anyone can see payments as they occur. A block hash alone proves only that *a payment happened* — not *who requested it*. Without binding payments to specific requests, an attacker could intercept a payment proof and claim it as their own.

The **session** provides this binding:

1. Server issues unique `sessionId` with each payment request
2. Client returns `sessionId` alongside the block hash
3. Server verifies the block matches requirements for *that specific session*

## Protocol Flow

Four steps. No intermediaries. Zero fees.

```
Client                          Server                      Nano
  │                               │                           │
  │  GET /resource                │                           │
  │──────────────────────────────>│                           │
  │                               │                           │
  │  402 + X-Payment-Required     │                           │
  │  (sessionId, amount, payTo)   │                           │
  │<──────────────────────────────│                           │
  │                               │                           │
  │  send_block(amount + tag)     │                           │
  │───────────────────────────────────────────────────────────>
  │                               │                           │
  │  GET /resource                │                           │
  │  + X-Payment (blockHash,      │                           │
  │    sessionId)                 │  verify block + session   │
  │──────────────────────────────>│───────────────────────────>
  │                               │                           │
  │  200 OK                       │                           │
  │<──────────────────────────────│                           │
```

The **session binding** (tag embedded in payment amount) prevents receipt theft — each payment is tied to a specific session and verified server-side. See the [Protocol Specification](./protocol.md) for security model details.

## Why Not Stateless?

We analyzed multiple stateless approaches (HMAC from IP, signed requirements, sender binding). All fail because:

- HTTP provides no standard client identity primitive
- Nano blocks have no memo/data field for request context
- Any "binding" requires prior coordination — which is itself a session

See [Protocol Specification § Security Model](./protocol.md#1-security-model) for detailed analysis.

## Why Not "Exact" x402?

The original x402 "exact" scheme uses EIP-3009 `transferWithAuthorization` with EIP-712 typed signatures to bind payments to requests. Permit2 offers a similar mechanism via Uniswap's universal approval contract. Both work on EVM chains because token contracts can verify off-chain signatures and execute conditional transfers atomically.

Nano's architecture prevents this approach:

- **No memo field** in blocks — there is no place to embed request context
- **Frontier dependency** — valid blocks require the current account frontier, which changes with every transaction, invalidating any pre-signed authorization

These architectural tradeoffs make "exact" x402-style pre-authorization unviable for Nano. NanoSession's session-based approach is the practical alternative.

## The Agent Economy

Machine-to-machine payments require a frictionless way for software to compensate services for micro-units of work. This protocol leverages Nano's unique properties:

- **Feeless**: No transaction costs eating into micropayments
- **Instant**: Sub-second finality enables synchronous request/response
- **Scalable**: Raw tagging allows thousands of concurrent payments per address

The Base Specification focuses on the simplest secure implementation: a single server address receiving session-bound, tagged payments from multiple clients.

