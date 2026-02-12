---
title: Intro
---

# x402.NanoSession (Rev 5) — Intro

x402.NanoSession defines a per-request HTTP 402 payment scheme for access to web resources and APIs. Payments are settled instantly and feelessly via Nano (XNO), avoiding smart‑contract overhead.

| Feature | Original x402 (x402.org) | x402.NanoSession Rev 5 |
| --- | --- | --- |
| Transport | HTTP 402 with JSON payment details | HTTP 402 with X-PAYMENT headers |
| Payment rail | Onchain stablecoins (e.g., USDC on Base) | Nano (XNO): feeless, sub-second finality |
| Client proof | Wallet-signed authorization (EIP-712) | Session-bound block hash |
| Request binding | Signature over request context | Mandatory session ID |
| Concurrency | Per-request wallet signature | Multiplexed via unique session + tag per address |

## Why "NanoSession"?

The name reflects a core architectural truth: **the session is the security primitive**.

Nano's block-lattice is publicly observable in real-time. Anyone can see payments as they occur. A block hash alone proves only that *a payment happened* — not *who requested it*. Without binding payments to specific requests, an attacker could intercept a payment proof and claim it as their own.

The **session** provides this binding:

1. Server issues unique `sessionId` with each payment request
2. Client returns `sessionId` alongside the block hash
3. Server verifies the block matches requirements for *that specific session*

This prevents the **receipt-stealing attack** where an observer claims another client's payment.

## Why Not Stateless?

We analyzed multiple stateless approaches (HMAC from IP, signed requirements, sender binding). All fail because:

- HTTP provides no standard client identity primitive
- Nano blocks have no memo/data field for request context
- Any "binding" requires prior coordination — which is itself a session

See [Protocol Specification § Security Model](./protocol.md#1-security-model) for detailed analysis.

## Why Not "Exact" x402?

The original x402 scheme uses EIP-712 wallet signatures to bind payments to requests. This works on EVM chains because transactions can include arbitrary signed data.

Nano's architecture prevents this:

- **No memo field** in blocks
- **Frontier dependency**: valid blocks require the current account state, which changes with every transaction
- Pre-signed authorizations become invalid if any other transaction occurs first

These **frontier issues** make "exact" x402-style pre-authorization unviable for Nano. NanoSession's session-based approach is the practical alternative.

## The Agent Economy

Machine-to-machine payments require a frictionless way for software to compensate services for micro-units of work. This protocol leverages Nano's unique properties:

- **Feeless**: No transaction costs eating into micropayments
- **Instant**: Sub-second finality enables synchronous request/response
- **Scalable**: Raw tagging allows thousands of concurrent payments per address

The Base Specification focuses on the simplest secure implementation: a single server address receiving session-bound, tagged payments from multiple clients.
