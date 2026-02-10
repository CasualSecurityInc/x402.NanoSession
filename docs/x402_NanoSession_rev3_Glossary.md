---
title: Glossary
---

# Glossary

This glossary defines terms specific to the x402.NanoSession protocol. For general Nano terminology, see the [Nano documentation](https://docs.nano.org/).

---

## Raw Tagging

A technique for encoding a unique identifier into the least significant digits of a Nano payment amount.

Because Nano amounts are expressed in "raw" (the smallest indivisible unit, 10⁻³⁰ XNO), small variations in the amount can carry metadata without materially affecting the payment value. These small amounts are sometimes referred to as **Nano dust**.

**How it works:**

1. The server specifies a base price aligned to a **Tag Modulus** (e.g., `TAG_MODULUS = 10,000,000`)
2. The client adds a unique **Tag** (0 to 9,999,999) to the payment amount
3. The server extracts the tag via `Amount % TAG_MODULUS` to identify which request the payment satisfies

**Example:** A price of `1.000000` XNO with tag `42` becomes `1.0000042` XNO. The "dust" (`0.0000042` XNO) is worth less than $0.00001 USD but uniquely identifies the request.

---

## Nano Dust

Extremely small amounts of Nano (XNO) used to encode metadata in a payment. In Raw Tagging, dust represents the tag portion of the amount—the digits below the price alignment boundary.

Unlike "dust" on fee-based blockchains (which can become unspendable due to fees exceeding value), Nano dust remains fully spendable because Nano has no transaction fees.

---

## TAG_MODULUS

A protocol constant defining the range of possible tags. 

- **Value:** `10,000,000` (Rev 3)
- **Effect:** Allows up to 10 million unique request IDs to be multiplexed onto a single receiving address
- **Constraint:** Server-quoted prices must be multiples of `TAG_MODULUS`

---

## Spent Set

A durable, server-side record of all Nano block hashes that have been accepted as payment. 

**Purpose:** Prevents double-spending and replay attacks. Once a block hash is in the Spent Set, any subsequent request presenting that same hash is rejected.

---

## Async Verification

A verification strategy where the server grants access immediately upon observing a confirmed **send** block on the Nano network, without waiting for its own **receive** block.

**Why it matters:** 
- Reduces latency from ~1 second (send + receive) to ~200-500ms (send only)
- The server can verify payment by observing the network, not by receiving funds
- Funds are "pocketed" later by a background **Janitor** process

---

## Janitor Process

A background server process responsible for:

1. **Pocketing:** Creating receive blocks for incoming payments
2. **Sweeping:** Consolidating funds from multiple addresses (in pooled configurations)
3. **Cleanup:** Expiring stale tag reservations

The Janitor operates asynchronously and does not block the payment verification flow.

---

## Session

A logical grouping of requests from a single client, identified by a `Session_ID`. 

Sessions allow the server to:
- Track client state across multiple requests
- Enforce per-session rate limits or budgets
- Maintain tag uniqueness within a session scope

---

## Purse (Client Middleware)

The client-side component that handles x402 payment flows automatically. A "headless purse" is middleware that:

1. Detects HTTP 402 responses
2. Calculates the tagged payment amount
3. Signs and publishes the Nano send block
4. Retries the original request with the block hash as proof

Purses typically operate within a user-defined **Daily Budget** to prevent runaway spending.
