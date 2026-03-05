# x402.NanoSession Protocol Specification (Rev 1)

**Date:** February 6, 2026
**Status:** Draft / Proposal
**Previous Version:** `x402_NanoSession_Protocol.md`

## Abstract

x402.NanoSession (Rev 1) is a streamlined protocol for high-frequency, machine-to-machine (M2M) payments over HTTP using the Nano (XNO) network. It updates the original "Per-Session Account" model to a **Deterministic Sharded Pool** architecture. This revision addresses ledger scalability concerns ("dust" and "state bloat"), introduces **Asynchronous Verification** for zero-latency access, and prioritizes **AI Agent** interoperability. The protocol enables servers to monetize APIs and resources at the millisecond level with zero fees and no immediate server-side Proof-of-Work.

## 1. Motivation

As the "Agent Economy" matures in 2026, autonomous software agents require a standard method to compensate service providers for small units of work (inference, data, bandwidth). Traditional payment rails are too slow or expensive; smart contract networks introduce gas fees that render sub-cent transactions unviable.

While the original x402 proposal suggested unique accounts per session, this approach risks "ledger bloat" at scale—creating millions of ephemeral accounts that burden the network. Rev 1 optimizes for **Network Citizenship** and **Operational Efficiency** by utilizing a fixed pool of server-side addresses combined with "Raw Tagging" for concurrency. This allows a single server to handle millions of concurrent paid sessions with a minimal ledger footprint.

## 2. Terminology

*   **Purse**: The client-side agent (e.g., HTTP middleware, CLI tool) holding a pre-funded Nano balance.
*   **Sharded Pool**: A fixed set of server-controlled Nano accounts (e.g., 50–100) used to receive payments.
*   **Raw Tagging**: Encoding a transaction identifier into the least significant digits of the transaction amount (Raw).
*   **Async Verification**: A server-side process that grants access upon observing a confirmed *send* block on the network, decoupled from the administrative task of *pocketing* (receiving) the funds.
*   **Lazy Settlement**: The background process of sweeping funds from the Sharded Pool to a cold wallet, performed strictly for fund consolidation, not for access control.

## 3. Architecture

### 3.1. The Client: Headless "Purse" Middleware
In this revision, the primary client is not a browser extension but **middleware** for HTTP clients (e.g., an `axios` adapter or Python `requests` wrapper).
*   **Responsibility**: Detects 402 responses, calculates the tagged amount, signs the block locally, and retries the request with the proof.
*   **Security**: Operates within strict "Budget" constraints (e.g., "Max 5 XNO/day", "Max 0.01 XNO/request").

### 3.2. The Server: Sharded Session Pool
Instead of deriving a unique account for every session, the server maintains a **Sharded Pool** of $N$ active addresses derived from a master seed.
*   **Selection**: A session is deterministically mapped to one address in the pool: `Pool_Index = Hash(Session_ID) % Pool_Size`.
*   **Concurrency**: Unique payments within the same pool address are distinguished via **Raw Tagging**.
*   **Benefit**: Keeps the active account set small (preventing ledger bloat) while allowing effectively infinite concurrent transactions.

### 3.3. Async Verification & Lazy Settlement
*   **Zero-Latency Access**: The server listens to a Nano Node websocket/callback. Access is granted the moment the network confirms the client's *send block*. The server does *not* need to generate its own Proof-of-Work or publish a receive block to unlock the resource.
*   **Decoupled Settlement**: A background "Janitor" process periodically scans the pool accounts and sweeps funds to a cold wallet. This can happen once an hour or during low-traffic periods, completely removing PoW latency from the user experience.

## 4. Technical Specification

### 4.1. Address Selection (Sharding)

The server initializes a pool of size `POOL_SIZE` (Recommended: 20–100 for typical loads).

$$
Address_{target} = Derive(Server\_Seed, 	ext{Hash}(Session\_ID) \pmod{POOL\_SIZE})
$$

This ensures that a single client session consistently interacts with the same server address, simplifying caching and history lookups.

### 4.2. Raw Tagging (Normative)

To distinguish payments sent to the same pool address, the protocol uses the least significant digits of the amount.

1.  **Tag Modulus**: A constant `TAG_MODULUS` (Recommended: `100,000`).
2.  **Tag Generation**:
    $$
    Tag = 	ext{Hash}(Request\_ID \parallel Nonce) \pmod{TAG\_MODULUS}
    $$
3.  **Price Alignment**: The server MUST quote prices such that `Price_Raw % TAG_MODULUS == 0`.
4.  **Amount Calculation**:
    $$
    Amount_{Final} = Price_{Raw} + Tag
    $$

This guarantees that `Amount_{Final} >= Price_{Raw}` and that the unique `Tag` can be extracted by `Amount_{Final} % TAG_MODULUS`.

### 4.3. Verification Flow

1.  **Client Request**: `GET /api/resource`
2.  **Server Response (402)**:
    *   Generates `Tag`.
    *   Selects `Address` from Pool.
    *   Returns headers: `X-402-Address`, `X-402-Price`, `X-402-Tag`.
3.  **Client Payment**:
    *   Computes `Amount`.
    *   Publishes Send Block.
    *   **Stores `Block_Hash`**.
4.  **Client Retry**: `GET /api/resource` with header `X-402-Payment-Block: <Block_Hash>`.
5.  **Server Check**:
    *   Queries node (or local cache) for `Block_Hash`.
    *   **Verifies**:
        *   `Block.Destination == Address`
        *   `Block.Amount >= Price`
        *   `Block.Amount % TAG_MODULUS == Tag`
        *   `Block.Confirmed == True`
    *   **Idempotency Check**: Checks if `Block_Hash` is already marked "Consumed".
6.  **Access Granted**.

### 4.4. Recoverability & Idempotency (The "Receipt")

Unlike "fire-and-forget" crypto payments, x402.NanoSession treats the **Block Hash as a permanent Receipt**.

*   **Recovery**: If the client pays but the network/server fails, the client retains the `Block_Hash`. It can present this hash later to claim the resource.
*   **Refunds**: While protocol-level refunds are complex, the server MAY implement a `GET /x402/balance` endpoint where unused, verified block hashes are credited as a distinct balance for future requests.

### 4.5. HTTP 402 Interface

**Response Headers:**
```http
HTTP/1.1 402 Payment Required
X-402-Mechanism: x402.NanoSession-v1
X-402-Address: nano_1pool...
X-402-Price-Raw: 10000000000000000000000000000
X-402-Tag: 4291
X-402-Pool-Index: 5  ; Optional debugging aid
```

**Request Headers (Proof):**
```http
GET /api/resource HTTP/1.1
X-402-Payment-Block: 991CF190094C00F0B68E2E5F75F6BEE95A2E0BD1244A02A243DE1696D0D541C6
```

## 5. Security and Privacy Considerations

### 5.1. Ledger Efficiency (Anti-Dust)
The Sharded Pool model is vastly superior to the ephemeral account model for network health.
*   **Pruning**: Old transactions in pool accounts can be aggressively pruned by nodes since the accounts remain open.
*   **Dust**: Since the server accumulates many small payments into one account before moving them, it avoids creating "dust" outputs that cost more to sweep than they are worth.

### 5.2. Privacy Trade-offs
*   **User Privacy**: Using a Sharded Pool provides a "crowd anonymity" set. An observer sees the pool receiving thousands of payments but cannot easily distinguish which payment belongs to which session without knowing the specific Tag mapping (which is private to the client/server session).
*   **Server Privacy**: The server's total transaction volume is visible on-chain. Mitigation involves rotating the Sharded Pool seeds periodically (e.g., daily or weekly).

### 5.3. Double-Spend / Replay
The server MUST maintain a "Spent Set" of Block Hashes for a duration exceeding the maximum session length. Reusing a `Block_Hash` for a new resource request MUST be rejected with `409 Conflict`.

## 6. Implementation Guidelines

### 6.1. For Service Providers (Middleware)
Do not build custom wallet logic. Use a middleware pattern:
*   **Input**: Master Seed, Price Config.
*   **Process**:
    *   Derives Pool Addresses on startup.
    *   Connects to Node Websocket `confirmation` topic filtering by Pool Addresses.
    *   Maintains an in-memory/Redis set of `(Tag, BlockHash)` for instant verification.
    *   Runs a background cron job to `receive` pending blocks and send to cold storage.

### 6.2. For Agent Developers
Focus on **Budgeting** and **idempotency**.
*   The Purse should not ask for confirmation for every micro-transaction (too intrusive).
*   Instead, configured with a "Daily Allowance."
*   If a request fails, **save the receipt**. Do not double-pay. Retry with the existing `Block_Hash`.
