# x402.NanoSession Protocol Specification (Rev 2)

**Date:** February 8, 2026
**Status:** Draft / Proposal
**Previous Version:** `x402_NanoSession_Protocol_rev1.md`

## Abstract

x402.NanoSession (Rev 2) is a protocol for high-frequency, machine-to-machine (M2M) payments over HTTP using the Nano (XNO) network. It utilizes a **Deterministic Sharded Pool** architecture with **Generational HD Rotation** to balance ledger efficiency with operational robustness. This revision mandates **Asynchronous Verification**, restores the **Session ID** mechanism for sharding, and introduces strict **Tag Uniqueness** and **Link Binding** to prevent payment hijacking and cross-server replays.

## 1. Motivation

The "Agent Economy" requires a frictionless way for software to compensate services for micro-units of work. Rev 2 refines the sharded pool model to ensure it is robust against race conditions and trivial replay attacks while remaining "zero-setup" for new service providers. By utilizing Nano's unique block-lattice properties, x402 allows for payment verification in under 500ms with no fees and no server-side Proof-of-Work required during the critical request path.

## 2. Terminology

*   **Session**: A logical grouping of requests from a single client agent, identified by a `Session_ID`. It persists across multiple HTTP requests and is used to route payments to a consistent Sharded Pool address.
*   **Sharded Pool**: A fixed set of server-controlled Nano accounts (Recommended: 20–100) used to receive payments.
*   **Generation**: A time-bounded version of the Sharded Pool (e.g., weekly) derived via HD paths to allow for automatic rotation.
*   **Raw Tagging**: Encoding a unique integer identifier into the least significant digits of the Nano Raw amount.
*   **Async Verification**: A server-side process that grants access upon observing a confirmed *send* block on the network. The server **MUST NOT** wait for its own *receive* block before granting access.
*   **Spent Set**: A durable record of all processed Nano block hashes used to prevent double-spending or replay attacks.

## 3. Architecture

### 3.1. The Client: Headless "Purse" Middleware
The primary client is middleware for HTTP clients.
*   **Responsibility**: Detects 402 responses, calculates the tagged amount, signs the block locally, and retries the request with the proof.
*   **Safety**: Operates within a user-defined "Daily Budget" to prevent runaway costs from bugs or malicious servers.

### 3.2. The Server: Generational Sharded Pool
The server maintains a pool of $N$ addresses. To ensure operational hygiene and mitigate long-term fingerprinting, the pool rotates periodically using Hierarchical Deterministic (HD) derivation.

**Address Derivation (Normative):**
The server derives addresses using the following path:
`m / 44' / 165' / <Generation>' / <Pool_Index>'`

*   `Generation = floor(UnixTimestamp / Rotation_Period)` (Default `Rotation_Period`: 1 Week).
*   `Pool_Index = Hash(Session_ID) % Pool_Size`.

### 3.3. Async Verification
Access is granted the moment the network confirms the client's *send block*. This removes server-side PoW latency from the user experience. The server's background "Janitor" process handles the administrative task of pocketing (receiving) the funds later.

## 4. Technical Specification

### 4.1. Raw Tagging & Uniqueness (Normative)

To distinguish payments sent to the same pool address, the protocol uses the least significant 7 digits of the amount.

1.  **Tag Modulus**: `TAG_MODULUS = 10,000,000`.
2.  **Tag Generation**: `Tag = Hash(Request_ID || Nonce) % TAG_MODULUS`.
3.  **Uniqueness Enforcement**: The server **MUST** maintain a set of "Pending Tags" per pool address. If a generated Tag is already in the pending set, the server MUST increment the nonce and re-hash until a unique Tag is found.
4.  **Amount Calculation**: `Amount_Final = Price_Raw + Tag` (where `Price_Raw % TAG_MODULUS == 0`).

### 4.2. Verification Flow (Normative)

1.  **Client Request**: Sends `GET /api/resource`. SHOULD include `X-402-Accept: x402.NanoSession-v1`.
2.  **Server Response (402)**: Returns headers:
    *   `X-402-Session`: The session identifier.
    *   `X-402-Address`: The specific pool address for this session.
    *   `X-402-Price-Raw`: The base price (multiple of 10M).
    *   `X-402-Tag`: The unique tag.
    *   `X-402-Expires`: Unix timestamp (Tag reservation deadline).
3.  **Client Payment**: Publishes a Send Block to the network.
4.  **Client Retry**: Sends request with `X-402-Payment-Block: <Block_Hash>` and the `X-402-Session`.
5.  **Server Check**:
    *   **Link Binding**: Verifies `Block.link` (destination) matches the assigned `Address`.
    *   **Tag Match**: Verifies `Block.Amount % TAG_MODULUS == Tag`.
    *   **Confirmation**: Verifies `Block.Confirmed == True` (ORV Quorum).
    *   **Spent Check**: Verifies `Block_Hash` is not in the durable **Spent Set**.
    *   **TTL Check**: Verifies the payment was observed or published *before* `X-402-Expires`.
6.  **Access Granted**.

### 4.3. HTTP Interface

**402 Response Headers:**
```http
HTTP/1.1 402 Payment Required
X-402-Mechanism: x402.NanoSession-v1
X-402-Session: 550e8400-e29b-41d4-a716-446655440000
X-402-Address: nano_1pool...
X-402-Price-Raw: 10000000000000000000000000000
X-402-Tag: 4291007
X-402-Expires: 1739012400
```

**Proof Request Headers:**
```http
GET /api/resource HTTP/1.1
X-402-Session: 550e8400-e29b-41d4-a716-446655440000
X-402-Payment-Block: 991CF190094C00F0B68E2E5F75F6BEE95A2E0BD1244A02A243DE1696D0D541C6
```

## 5. Operational Guidelines

### 5.1. Spent Set Persistence
The Spent Set MUST be persisted durably (e.g., SQLite, PostgreSQL, or LevelDB). Servers MAY prune entries older than 30 days, provided they also reject any payment blocks with an on-chain timestamp older than 30 days.

### 5.2. Rotation & Grace Period
Servers MUST monitor addresses for both the **Current** and **Previous** Generations. This ensures that clients who started a session right before a generation flip can still complete their payment.

### 5.3. Pre-computed PoW (The Janitor)
To ensure the server's pool accounts are always ready to move funds, the "Janitor" process SHOULD pre-compute PoW for the next expected `receive` block for every address in the pool.

## 6. Security and Privacy Considerations

### 6.1. Privacy and Pool Enumeration
The Sharded Pool model provides limited privacy against an active observer. An attacker can enumerate the server's entire active pool by making repeated requests with different `X-402-Session` IDs. Generational rotation does not prevent this but ensures that the server's ledger footprint is not static, providing a measure of forward-secrecy for the network.

### 6.2. Double-Spend / Replay
The combination of the **Spent Set** (per-server) and the **Link Field Binding** (on-chain) prevents both local replays and cross-server replays of payment blocks.

---

## Appendix: Changes from Rev 1

*   **Tagging**: Increased `TAG_MODULUS` to 10,000,000 and mandated server-side uniqueness enforcement.
*   **Headers**: Restored `X-402-Session`; added `X-402-Expires` (Unix) and `X-402-Accept`.
*   **Rotation**: Mandated HD Derivation path (`m/44'/165'/<Gen>'/<Pool>'`) for automatic pool rotation.
*   **Security**: Added mandatory **Link Binding** check and durable **Spent Set** requirement.
*   **Performance**: Explicitly forbade waiting for `receive` blocks during the verification flow.
*   **Clarity**: Replaced LaTeX math with plain-text formulas and added the "Session" terminology.
