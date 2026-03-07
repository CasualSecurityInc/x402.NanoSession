---
title: Glossary
---

# Glossary

This glossary defines technical terms, concepts, and architectural patterns specific to the x402.NanoSession protocol. For general Nano network terminology, core node mechanics, or consensus details, please refer to the official [Nano documentation](https://docs.nano.org/).

---

### Resource Server

The primary HTTP server that clients interact with. It receives requests for protected resources, replies with `HTTP 402 Payment Required` requirements (fetched from the Facilitator), and ultimately fulfills the content once the Facilitator confirms payment validity. It does not interface with the Nano blockchain directly.

### Facilitator

The secure backend service responsible for blockchain interactions. The Facilitator holds the destination Nano account addresses, connects to the Nano network (via RPC or WebSockets), handles cryptographic session issuance (`id`), maintains the **Spent Set** to prevent double-spends, and verifies submitted `block_hash` payloads. It can be embedded within the Resource Server or deployed standalone.

### Janitor

An optional service or scheduled job (often operating adjacent to or within the Facilitator) responsible for asynchronously sweeping accumulated "dust" from session tags and returning it to the original senders. See Extension D for details on standardized dust return policies.

---

## Session (Security Primitive)

A server-side binding between a payment request and the client that received it.

**Why it exists:** Nano's block-lattice is publicly observable. A block hash alone proves *a payment happened*, not *who requested it*. Without session binding, an attacker could observe a payment on-chain and claim it as proof for their own request (the **Receipt-Stealing Attack**).

**How it works:**

1. Server generates unique session `id` when returning 402
2. Server stores: `id → { payTo, amount, resourceAmountRaw, tagAmountRaw, tag, expiresAt }`
3. Client must return `id` (nested in `nanoSession`) alongside the block hash
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

**Prevention:** Mandatory session binding. The attacker lacks the session `id` issued to Client A.

---

## Raw Tagging

A technique for binding a unique identifier to a Nano payment amount.

Because Nano amounts are expressed in "raw" (the smallest indivisible unit, 10⁻³⁰ XNO), the Facilitator can reserve a session-specific tag amount while still exposing the real resource price transparently.

**How it works:**

1. Facilitator chooses `tag` and computes a `tagAmountRaw` using its internal policy.
2. Facilitator sets `amount = resourceAmountRaw + tagAmountRaw`.
3. Client sends `amount` exactly (normative).
4. Server verifies the chain amount equals the stored session `amount`.
5. `resourceAmountRaw`, `tagAmountRaw`, and `tag` remain visible for UI/debug.

---

## Nano Dust

Extremely small amounts of Nano (XNO) used to encode metadata in a payment. In Raw Tagging, dust represents the tag portion—the digits below the price alignment boundary.

Unlike "dust" on fee-based blockchains (which can become unspendable), Nano dust remains fully spendable because Nano has no transaction fees.

---

## Tag Strategy

The protocol does not mandate how the Facilitator derives `tagAmountRaw` from `tag` (random or deterministic policies are both valid).

Normative requirement:
- Active sessions for the same destination address must not share the same `amount`.

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

## Frontier

The hash of the most recent block in a Nano account's chain.

**Why it matters:** Creating a valid send block requires the current frontier. If another transaction occurs first, the frontier changes and previously-prepared blocks become invalid. This **frontier dependency** prevents pre-signed authorization schemes (like EIP-3009) from working with Nano.

---

## Purse (Client Middleware)

The client-side component handling x402 payment flows. A "headless purse":

1. Detects HTTP 402 responses
2. Extracts session `id` and payment requirements
3. Uses `amount` directly as the send amount
4. Signs and broadcasts Nano send block
5. Retries original request with block hash and session `id`

Purses typically operate within a **Daily Budget** to prevent runaway spending.
