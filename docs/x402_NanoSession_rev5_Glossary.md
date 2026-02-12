---
title: Glossary
---

# Glossary

This glossary defines terms specific to the x402.NanoSession protocol. For general Nano terminology, see the [Nano documentation](https://docs.nano.org/).

---

## Session (Security Primitive)

A server-side binding between a payment request and the client that received it.

**Why it exists:** Nano's block-lattice is publicly observable. A block hash alone proves *a payment happened*, not *who requested it*. Without session binding, an attacker could observe a payment on-chain and claim it as proof for their own request (the **Receipt-Stealing Attack**).

**How it works:**

1. Server generates unique `sessionId` when returning 402
2. Server stores: `sessionId → { payTo, baseAmount, tag, expiresAt }`
3. Client must return `sessionId` alongside the block hash
4. Server verifies block matches requirements for *that specific session*
5. Session is single-use: deleted after successful verification

**Properties:**
- **Mandatory:** Sessions are not optional; they are a security requirement
- **Opaque:** Format is implementation-defined (UUID, random hex, etc.)
- **Short-lived:** Should expire within minutes (default: 300 seconds)
- **Single-use:** Consumed on successful payment verification

---

## Receipt-Stealing Attack

A vulnerability in payment protocols with publicly-observable ledgers where an attacker claims another client's payment proof.

**Scenario:**
1. Client A requests resource, receives payment requirements
2. Client A pays, block hash `ABC123` appears on-chain
3. Attacker observes `ABC123` on public ledger
4. Attacker submits `ABC123` to server as their own proof
5. Server validates: exists ✓, correct destination ✓, not spent ✓
6. Attacker receives access; Client A's subsequent claim rejected as "spent"

**Prevention:** Mandatory session binding. The attacker lacks the `sessionId` issued to Client A.

---

## Raw Tagging

A technique for encoding a unique identifier into the least significant digits of a Nano payment amount.

Because Nano amounts are expressed in "raw" (the smallest indivisible unit, 10⁻³⁰ XNO), small variations can carry metadata without materially affecting the payment value.

**How it works:**

1. Server specifies base price aligned to **Tag Modulus** (e.g., `10,000,000`)
2. Server generates unique **Tag** (0 to 9,999,999) per session
3. Client sends: `Tagged Amount = Base Price + Tag`
4. Server extracts tag via `Amount % TAG_MODULUS`

**Example:** Price of `1.000000` XNO with tag `42` becomes `1.0000042` XNO.

---

## Nano Dust

Extremely small amounts of Nano (XNO) used to encode metadata in a payment. In Raw Tagging, dust represents the tag portion—the digits below the price alignment boundary.

Unlike "dust" on fee-based blockchains (which can become unspendable), Nano dust remains fully spendable because Nano has no transaction fees.

---

## TAG_MODULUS

A protocol constant defining the range of possible tags.

- **Value:** `10,000,000` (Rev 5)
- **Effect:** Allows up to 10 million unique tags per receiving address
- **Constraint:** Server-quoted prices must be multiples of `TAG_MODULUS`

---

## Spent Set

A durable, server-side record of all Nano block hashes accepted as payment.

**Purpose:** Prevents double-spending and replay attacks. Once a block hash is in the Spent Set, subsequent claims using that hash are rejected.

**Requirements:**
- MUST be persistent (survive restarts)
- MUST be synchronized in distributed deployments
- MAY prune entries after reasonable TTL (e.g., 30 days)

---

## Async Verification

A verification strategy where the server grants access upon observing a confirmed **send** block, without waiting for its own **receive** block.

**Benefits:**
- Reduces latency from ~1s to ~200-500ms
- Server verifies by observing the network, not by receiving funds
- Funds are "pocketed" later by the **Janitor Process**

---

## Janitor Process

A background server process responsible for:

1. **Pocketing:** Creating receive blocks for incoming payments
2. **Sweeping:** Consolidating funds from multiple addresses (pooled configs)
3. **Cleanup:** Expiring stale sessions and tag reservations

The Janitor operates asynchronously and does not block payment verification.

---

## Frontier

The hash of the most recent block in a Nano account's chain.

**Why it matters:** Creating a valid send block requires the current frontier. If another transaction occurs first, the frontier changes and previously-prepared blocks become invalid. This **frontier dependency** prevents pre-signed authorization schemes (like EIP-712) from working with Nano.

---

## Purse (Client Middleware)

The client-side component handling x402 payment flows. A "headless purse":

1. Detects HTTP 402 responses
2. Extracts session ID and payment requirements
3. Calculates tagged amount
4. Signs and broadcasts Nano send block
5. Retries original request with block hash and session ID

Purses typically operate within a **Daily Budget** to prevent runaway spending.
