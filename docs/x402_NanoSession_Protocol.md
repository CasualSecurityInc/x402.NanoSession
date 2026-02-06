# x402.NanoSession Protocol Specification

## Abstract

x402.NanoSession is a protocol that operationalizes HTTP 402 “Payment Required” for machine-to-machine (M2M) and AI agent commerce using the Nano (XNO) network. It enables instant, feeless, pre-authorized micropayments without manual user interaction or complex smart contracts.

The protocol is built around a Pre-Authorized Client Agent (“The Purse”) and a deterministic, per-session Server Account (“The Session”). The purse is funded and configured once by the user, then automatically pays small, bounded amounts when a server responds with HTTP 402. The server derives a unique Nano address for each session from a dedicated x402 seed, and encodes a short payment tag into the least significant Raw units of the payment amount. This combination enables zero-click, high-concurrency, and easily auditable payments while keeping implementation complexity low.

## 1. High-Level Overview

The core idea of x402.NanoSession is to make HTTP 402 "Payment Required" a viable mechanism for automated, high-volume micropayments, leveraging Nano's unique properties: feeless transactions, near-instant finality, and a simple account model. This protocol specifically targets M2M communication and AI agent interactions where traditional payment methods (credit cards, smart contracts with gas fees) are unsuitable due to cost, latency, or complexity.

The system comprises two main components:

*   **The Purse (Client-side)**: A client-side agent (e.g., a browser extension, an API client library, an AI agent module) that holds a pre-funded Nano account and is authorized by the user to make small, automated payments within defined limits.
*   **The Session (Server-side)**: A server-side mechanism that deterministically derives a unique Nano account for each client session. This account acts as a temporary destination for micropayments, allowing the server to track individual payments and consume resources efficiently.

## 2. Terminology

*   **XNO**: The native cryptocurrency of the Nano network.
*   **Raw**: The smallest possible unit of Nano. 1 Nano = 10^30 raw.
*   **Purse**: The client-side agent responsible for originating x402.NanoSession payments.
*   **Session Account**: A Nano account deterministically derived by the server for a specific client session.
*   **Raw Tagging**: The method of encoding additional data (a unique tag) into the least significant raw digits of a Nano transaction amount.
*   **Frontier**: The latest block in an account's chain. Managing the frontier correctly is crucial for Nano transaction ordering.
*   **PoW**: Proof-of-Work, required for each new block on the Nano network.

## 3. Architecture

### 3.1. Client: The Purse

The Purse is a pre-authorized client agent. It manages a dedicated Nano account (or accounts) from which automated payments are made. The Purse is configured with user-defined limits (e.g., per-origin spending caps, global daily budgets) to prevent uncontrolled spending.

### 3.2. Server: The Session

The server maintains a master x402 seed. For each incoming client request that requires payment, it derives a unique Session Account address. This account is ephemeral and acts as a temporary holding place for payments. The server monitors these session accounts for incoming payments, verifies them, and grants access to the requested resources. Periodically, funds from session accounts are swept to a more secure cold/hot wallet.

## 4. Technical Specification

### 4.1. Key Derivation

Nano commonly uses a `seed + index` model for account derivation (`account = f(seed, index)`). While BIP-44-like paths (`m / 402' / 165' / session_hash'`) can be used as a *logical path convention* for index namespaces, it is crucial to clarify that for Nano implementations, `session_hash` is typically used directly as the account index.

**Recommendation:**
Implementations SHOULD use a dedicated seed for x402.NanoSession accounts, distinct from any user-facing wallet seed. Wallet software MUST NOT automatically sweep or display x402-derived accounts under normal user account lists unless explicitly enabled.

### 4.2. Session Index Derivation and Collision Avoidance

The `Session_Index` (used to derive the server's Session Account for a client) must be robust against guessing and collisions. CRC32 is unsuitable due to its predictability and collision probability.

**Specification for `Session_Index`:**

The `Session_Index` MUST be derived using a cryptographic hash function, incorporating a server-side secret, the client's session identifier, and potentially the specific resource ID.

$$
Session\_Index = 	ext{uint32\_from\_HMAC\_SHA256}(	ext{server\_secret}, 	ext{session\_id} \parallel 	ext{resource\_id})
$$

Example implementation:
```text
session_material = session_cookie || ":" || resource_path
digest = HMAC_SHA256(server_secret, session_material)
Session_Index = first_31_bits(digest) // To ensure a non-negative 31-bit integer
```
This approach provides near-zero collision probability for realistic scales and ensures unpredictability of session addresses without compromising security, as the private key remains locked to the server.

### 4.3. Raw Tagging

Raw Tagging is the mechanism to encode a unique request ID or a nonce into the least significant raw digits of the transaction amount. This allows the server to distinguish between concurrent payments to the same Session Account.

**Key Design Choices:**

1.  **Tag Modulus (`TAG_MODULUS`)**: A fixed modulus defining the range of possible tags. A `TAG_MODULUS` of 100,000 allows for 0-99,999 unique tags.
2.  **Aligned Price**: The server MUST quote `Price_Raw` values that are a multiple of `TAG_MODULUS`.
3.  **Client Calculation**: The client (Purse) calculates the `Amount_Raw` to send by adding its unique `Tag` to the `Price_Raw`.

**Normative Rules:**

*   The server MUST quote `Price_Raw` such that:
    $$
    Price\_Raw \bmod TAG\_MODULUS = 0
    $$
*   The client MUST compute `Amount_Raw` as:
    $$
    Amount\_Raw = Price\_Raw + Tag
    $$
    with `0 <= Tag < TAG_MODULUS`.
*   **Concurrency Guarantees**: With `TAG_MODULUS = 100,000`, up to 100,000 outstanding payments to the same session address can be uniquely distinguished.
*   **Big Integer Arithmetic**: Implementations MUST use arbitrary-precision integer arithmetic (e.g., BigInt in JavaScript, `big.Int` in Go) for all Raw Tagging math to prevent precision errors.

### 4.4. Verification Flow and Replay Protection

The verification process ensures that a legitimate payment has been made and prevents replay attacks.

1.  **Client Request**: The client attempts to access a protected resource.
2.  **Server HTTP 402 Response**: If payment is required, the server responds with HTTP 402, including payment details.
3.  **Client Payment (Purse)**: The Purse constructs and broadcasts a Nano send block to the specified Session Account address, incorporating Raw Tagging.
4.  **Client Re-request**: The client re-requests the resource, including the `Block_Hash` of the payment in an HTTP header.
5.  **Server Verification**: The server performs the following checks:
    *   **Block Confirmation**: The `Block_Hash` refers to a confirmed block on the Nano network. A minimum confirmation depth (e.g., 1) can be defined.
    *   **Destination Address**: The block's destination MUST be the derived Session Account address for the current session.
    *   **Amount Check**:
        *   The block's `amount_raw` MUST be greater than or equal to the `Price_Raw` for the requested resource.
        *   The `(amount_raw - Price_Raw)` MUST equal the `Tag` derived by the server (i.e., `amount_raw % TAG_MODULUS == Tag`, assuming `Price_Raw` is a multiple of `TAG_MODULUS`).
    *   **Replay Protection**: The server MUST track consumed `Block_Hash` values. A `Block_Hash` MUST NOT be accepted for more than one logically independent purchase within a session unless specific prepaid balance semantics are implemented. This prevents "pay once, access forever" scenarios.
    *   **Under/Over-payments**:
        *   Underpayments (`block_amount_raw < Price_Raw`) MUST be rejected.
        *   Overpayments MAY be treated as a tip, added to a session balance, or refunded.

### 4.5. HTTP 402 Semantics and Headers

To facilitate interoperability, concrete HTTP headers and response body structures are defined.

**HTTP 402 Response Body (JSON):**
```json
{
  "payment_required": "x402.NanoSession",
  "address": "nano_3session...",
  "price_xno": "0.01",
  "price_raw": "10000000000000000000000000000",
  "tag": 492,
  "session_id": "abc123",
  "nonce": "short-server-nonce-optional"
}
```

**HTTP Response Headers for 402:**
*   `X-402-Address: nano_3session...`
*   `X-402-Price-Raw: 10000000000000000000000000000`
*   `X-402-Tag: 492`
*   `X-402-Session: abc123`

**Client Proof Headers (on subsequent request):**
*   `X-402-Payment-Block: <Block_Hash>`
*   `X-402-Session: <Session_Cookie or ID>`

x402.NanoSession-compliant servers MUST include the `payment_required` field in the JSON response body and SHOULD also include the `X-402-*` headers for easier integration with HTTP clients and proxies.

### 4.6. Frontier Management and Proof-of-Work (PoW)

*   **Server Session Account PoW**: For each new Session Account that receives its first payment (an "open" block), the server must publish an open block, which requires PoW. Servers SHOULD pre-generate PoW for expected incoming receive/open blocks or utilize specialized PoW services/hardware accelerators to ensure instant experience under high concurrency.
*   **Client Purse Frontier**: The Purse SHOULD serialize outgoing send-block construction per account to avoid conflicting frontiers and ensure transaction consistency.

## 5. Security and Privacy Considerations

### 5.1. Server Seed Security

The server's x402 master seed, from which Session Accounts are derived, should be treated as a **low-value, hot wallet**.

**Recommendations:**

*   Implement tight withdrawal limits and frequent sweeping of funds from Session Accounts to a more secure cold storage.
*   Run on hardened infrastructure; optionally sign from a Hardware Security Module (HSM) or an isolated signing service.
*   Production deployments SHOULD derive a separate "session bank" seed from a master cold seed and only fund that hot seed with enough XNO for current sessions and settlement operations.

### 5.2. Purse Drain Protection

To mitigate risks like a malicious site draining a Purse, robust client-side controls are essential.

**Recommendations for Wallets (Purse Implementations):**

*   Wallets SHOULD expose configuration for:
    *   Per-origin daily/weekly/monthly spending limits.
    *   A global maximum auto-spend amount.
    *   User prompts when limits are approached or exceeded for transactions above a certain threshold.
*   Employ "Rolling Purse" strategies (e.g., one purse per domain/origin, or time-bounded purses rotated daily/weekly) to enhance user privacy and limit exposure.

### 5.3. Session Index Unpredictability

Using HMAC-based `Session_Index` derivation reduces correlation between sessions from external observers, enhancing privacy by making address patterns less predictable.

## 6. Marketability and Messaging

### 6.1. Elevator Pitch

x402.NanoSession: A way to make HTTP 402 actually work — instant, feeless, one-round-trip payments for APIs and AI agents using Nano (XNO).

### 6.2. Comparison Framing

Compared to:
*   **Stripe / Credit Cards**: x402.NanoSession offers true sub-cent micropayments without minimum fee thresholds or chargebacks.
*   **Web Monetization (ILP)**: Simpler infrastructure, direct payments without intermediaries.
*   **Other Blockchains**: No gas fees, near-instant finality, simple account model without smart contract complexity.

Nano's advantages make x402.NanoSession uniquely positioned for:
*   **No Fees**: Enables true sub-cent micropayments.
*   **Near-Instant Finality**: Allows for one extra HTTP roundtrip for payment confirmation.
*   **Simple Account Model**: Facilitates easy deterministic session accounting.

### 6.3. Use Cases

*   Pay-per-request API access at fractions of a cent.
*   Agent-to-agent payments for data, prompts, or tools.
*   On-demand content (articles, images) without subscriptions.
*   IoT devices paying for bandwidth or sensor data.

### 6.4. Terminology Polish

*   **Pre-Authorized Client Agent ("The Purse")**: Client-side component.
*   **Deterministic, Per-Session Accounting ("The Session")**: Server-side component, emphasizing reduced server-side complexity.

## 7. Implementation Notes and Next Steps

### 7.1. Client-Side Library

A client-side JavaScript library (e.g., `@x402/nano-client`) would:

*   Parse HTTP 402 responses and automatically construct x402 payment requests.
*   Handle Raw Tagging encoding and BigInt Raw math.
*   Manage Nano Frontier for outgoing payments.
*   Integrate with a Nano wallet or signing service for transaction signing and broadcasting.

### 7.2. Server-Side Middleware

A server-side middleware (for Node.js, Python, Go, etc.) would:

*   Wrap Session Index derivation (HMAC-based).
*   Handle Address derivation from `x402_seed + Session_Index`.
*   Construct HTTP 402 responses (headers + JSON body).
*   Verify incoming `X-402-Payment-Block` headers.
*   Optionally: Cache confirmed block hashes and their consumption status in a database, and perform periodic sweeping from session addresses to a central cold/hot wallet.
