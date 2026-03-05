---
title: Intro
---

# x402.NanoSession (Rev 6) — Intro

x402.NanoSession defines a per-request HTTP 402 payment scheme for access to web resources and APIs. Payments are settled instantly and feelessly via Nano (XNO), avoiding smart‑contract overhead.

| Feature | Original x402 (x402.org) | x402.NanoSession Rev 6 |
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

## 2. Core Architecture

Unlike many complex Web3 protocols, NanoSession builds exactly on the `HTTP 402` mechanics described by the `x402` spec, leveraging Nano's feeless and near-instant properties.

The architecture comprises three primary actors natively, and logically separates server-side responsibilities into two distinct roles to support massive scale:

1. **Client (User Agent)**: A browser, CLI, or app that attempts to access a protected HTTP resource, receives a 402 requirement, pays the Nano network, and retries the request with proof.
2. **Resource Server**: The entry point that receives public HTTP requests from the Client. It does *not* talk to the blockchain. Its only jobs are determining if a resource costs money, issuing the `402 Payment Required` headers, and serving the content once payment is verified.
3. **Facilitator**: An optional but recommended backend clearinghouse. It holds the network accounts and API keys, listens to the Nano blockchain (via WebSocket or RPC), verifies block hashes, prevents double-spends (via the Spent Set), and cryptographically guarantees session validation.

> [!NOTE]
> **Deployment Patterns**: While the protocol logically separates the *Resource Server* and *Facilitator* into distinct roles, it is entirely acceptable to deploy both roles together in a single **Monolithic Service (Embedded Facilitator)**. This is particularly useful for smaller applications, whereas larger enterprises may elect to use a **Standalone Facilitator** (such as Coinbase's hosted APIs or an independent local service) so the Resource Server never touches blockchain networking.

### Workflow Summary
