# x402.NanoSession Protocol Specification (Rev 5)

**Date:** February 12, 2026
**Status:** Draft / Proposal
**Previous Version:** `x402_NanoSession_rev4_Protocol.md`
**Base Specification:** Single Address Model with Mandatory Session Binding

## Abstract

x402.NanoSession (Rev 5) is a protocol for high-frequency, machine-to-machine (M2M) payments over HTTP using the Nano (XNO) network. It utilizes **Deterministic Raw Tagging** to allow a single Nano address to process thousands of concurrent payments without unique address generation per request.

**Rev 5 introduces mandatory session binding** as a core security requirement, addressing a class of payment-proof interception attacks unique to publicly-observable ledgers.

## 1. Security Model

### 1.1. The Receipt-Stealing Attack

Nano's block-lattice is **publicly observable in real-time**. Any observer can see payments as they occur. This creates a fundamental security challenge:

```
1. Server issues payment requirements to Client A (tag 42)
2. Server issues payment requirements to Client B (tag 77)
3. Client A broadcasts payment (tag 42), block hash = ABC123
4. Attacker observes ABC123 on-chain
5. Attacker submits ABC123 to server claiming it as proof
6. Server validates: block exists ✓ correct destination ✓ not spent ✓
7. Server grants access to Attacker
8. Client A submits ABC123 — rejected as "already spent"
```

**Result:** Client A paid. Attacker received the resource. Client A received nothing.

This attack is analogous to a grocery store where all receipts are printed on a public board. An attacker can grab someone else's receipt and present it to the security guard, who has no way to verify the receipt belongs to the person presenting it.

### 1.2. The Session Binding Invariant

**MANDATORY:** A payment proof MUST be cryptographically bound to the specific client that was issued the payment request.

The server MUST verify **three conditions** before granting access:

1. Block exists on-chain and is confirmed
2. Block hash is not in the Spent Set (anti-replay)
3. **Block corresponds to requirements issued to THIS client** (session binding)

### 1.3. Why Stateless Solutions Fail

Several stateless approaches were analyzed and rejected:

| Approach | Why It Fails |
|----------|--------------|
| **HMAC from client IP** | NAT, proxies, VPNs make IP unreliable; attackers on same network share IP |
| **HMAC from client public key** | Requires pre-authentication — which is itself a session |
| **Signed requirements echoed back** | Attacker can intercept and replay the signed requirements along with the stolen block hash |
| **Bind to sender address** | Requires knowing client's address beforehand — a session |
| **EIP-712 style signing** | Nano blocks have no memo/data field; signature covers block content only, not request context |

**Conclusion:** HTTP is stateless by design. Nano blocks contain no request-binding field. The server MUST maintain state correlating issued requirements to the client that requested them. This state is the **session**.

### 1.4. Why "Exact" x402 Schemes Are Unviable for Nano

The original x402 protocol (x402.org) uses **wallet-signed authorizations** (EIP-712) where the client signs a message binding the payment to a specific request. This works because:

1. EVM transactions can include arbitrary signed data
2. The signature proves the wallet owner authorized *this specific* payment

Nano's architecture prevents this approach:

- **No memo field:** Nano blocks contain only: previous, representative, balance, link (destination), work, signature
- **Signature scope:** The block signature covers block content, not external request context
- **Frontier dependency:** Creating a valid send block requires knowing the account's current frontier (previous block hash), which changes with every transaction — making pre-signed authorizations impractical

The "exact" scheme approach (as explored in projects like x402nano) encounters these **frontier issues**: a pre-signed block becomes invalid if any other transaction occurs on the account before broadcast.

## 2. Communication Flow

### 2.1. Overview

```
┌────────┐         ┌────────┐         ┌──────────┐
│ Client │         │ Server │         │   Nano   │
└───┬────┘         └───┬────┘         └────┬─────┘
    │  GET /resource   │                   │
    │─────────────────>│                   │
    │  402 + Headers   │                   │
    │  (incl sessionId)│                   │
    │<─────────────────│                   │
    │           Send Block                 │
    │─────────────────────────────────────>│
    │  GET /resource   │                   │
    │  + Block Hash    │                   │
    │  + Session ID    │                   │
    │─────────────────>│                   │
    │                  │  Verify Block     │
    │                  │  + Session Match  │
    │                  │──────────────────>│
    │  200 OK          │                   │
    │<─────────────────│                   │
```

### 2.2. Payment Flow (Normative)

1. Client requests protected resource
2. Server generates unique `sessionId` and payment requirements (including `tag`)
3. Server stores mapping: `sessionId → { payTo, baseAmount, tag, expiresAt }`
4. Server returns HTTP 402 with requirements including `sessionId`
5. Client calculates tagged amount: `baseAmount + tag`
6. Client signs and broadcasts Nano send block
7. Client retries request with:
   - `X-PAYMENT-BLOCK`: block hash
   - `X-PAYMENT-SESSION`: sessionId
8. Server retrieves stored requirements using `sessionId`
9. Server verifies:
   - Block is confirmed on-chain
   - Block destination matches stored `payTo`
   - Block amount matches stored `baseAmount + tag`
   - Block hash not in Spent Set
10. Server adds block hash to Spent Set
11. Server deletes session (single-use)
12. Server grants access

### 2.3. Required Headers

#### 402 Response (Server → Client)

| Header | Required | Description |
|--------|----------|-------------|
| `X-PAYMENT-ADDRESS` | ✓ | Nano destination address |
| `X-PAYMENT-AMOUNT` | ✓ | Base amount in raw |
| `X-PAYMENT-TAG` | ✓ | Tag value (0 to TAG_MODULUS-1) |
| `X-PAYMENT-SESSION` | ✓ | Unique session identifier |
| `X-PAYMENT-EXPIRES` | ✓ | ISO 8601 expiration timestamp |
| `X-PAYMENT-TAG-MODULUS` | | Tag modulus (default: 10000000) |

#### Retry Request (Client → Server)

| Header | Required | Description |
|--------|----------|-------------|
| `X-PAYMENT-BLOCK` | ✓ | 64-character hex block hash |
| `X-PAYMENT-SESSION` | ✓ | Session ID from 402 response |

## 3. Technical Specification

### 3.1. Session ID Requirements

- **Format:** Opaque string, recommended UUID v4 or 128-bit random hex
- **Uniqueness:** MUST be unique per payment request
- **Lifetime:** Valid until expiration or successful settlement
- **Single-use:** MUST be invalidated after successful payment verification
- **Storage:** Server MUST store session→requirements mapping

### 3.2. Raw Tagging (Normative)

To distinguish payments sent to the same address:

1. **Tag Modulus:** `TAG_MODULUS = 10,000,000`
2. **Tag Range:** 0 to 9,999,999
3. **Tag Generation:** Random or `Hash(sessionId || nonce) % TAG_MODULUS`
4. **Tagged Amount:** `Amount_Final = Price_Raw + Tag`
5. **Price Constraint:** `Price_Raw % TAG_MODULUS == 0`
6. **Collision Handling:** If generated tag is already pending, regenerate

### 3.3. Spent Set (Normative)

- **Purpose:** Prevent double-spending and replay attacks
- **Key:** Block hash (64-character hex)
- **Persistence:** MUST survive server restarts
- **TTL:** Entries MAY be pruned after reasonable period (e.g., 30 days)

### 3.4. Session Storage (Normative)

Servers MUST maintain a mapping of active sessions:

```
sessions[sessionId] = {
  payTo: string,        // Destination address
  baseAmount: string,   // Price before tag (raw)
  tag: number,          // Generated tag
  tagModulus: number,   // Modulus used
  expiresAt: string,    // ISO 8601 expiration
  createdAt: string     // For debugging/metrics
}
```

Session entries MUST be:
- Created atomically with tag generation
- Deleted after successful verification OR expiration
- Indexed for O(1) lookup by sessionId

## 4. Security Considerations

### 4.1. Receipt-Stealing Prevention

The mandatory session binding prevents the receipt-stealing attack by ensuring:
- Only the client that received a specific sessionId can claim the corresponding payment
- The attacker cannot forge or guess a valid sessionId
- Even if the attacker observes the payment on-chain, they lack the sessionId to claim it

### 4.2. Session ID Confidentiality

- Session IDs SHOULD be transmitted over HTTPS only
- Session IDs SHOULD NOT be logged in plaintext on client systems
- Session IDs SHOULD have sufficient entropy (128+ bits)

### 4.3. Timing Considerations

- Sessions SHOULD expire within a reasonable window (default: 300 seconds)
- Expired sessions MUST be rejected even if the payment is valid
- Clock skew between client and server should be accounted for

### 4.4. Spent Set Persistence

- The Spent Set MUST be durable (survive crashes/restarts)
- Loss of Spent Set data enables replay attacks
- Distributed deployments MUST synchronize Spent Set state

## 5. Extensions

For high-volume services or privacy-sensitive implementations:

- **[Extension A: Generational Sharded Pools](x402_NanoSession_rev5_Extension_A_Pools.md)**: Scale to 20-100 addresses
- **[Extension B: Stochastic Rotation](x402_NanoSession_rev5_Extension_B_Stochastic.md)**: Privacy via address rotation

## 6. Implementation Notes

### 6.1. Minimum Viable Server

```
on_request(req):
  if req.has_payment_proof():
    session = sessions.get(req.header['X-PAYMENT-SESSION'])
    if not session:
      return 400 "Unknown session"
    if session.expired():
      sessions.delete(session.id)
      return 402 "Session expired"
    
    block = nano_rpc.get_block(req.header['X-PAYMENT-BLOCK'])
    expected_amount = session.baseAmount + session.tag
    
    if block.destination != session.payTo:
      return 402 "Destination mismatch"
    if block.amount != expected_amount:
      return 402 "Amount mismatch"
    if spent_set.contains(block.hash):
      return 402 "Already spent"
    if not block.confirmed:
      return 402 "Not confirmed"
    
    spent_set.add(block.hash)
    sessions.delete(session.id)
    return 200 "Access granted"
  
  else:
    session = create_session(price, server_address)
    sessions.store(session)
    return 402 with session headers
```

## See Also

- [x402 Standard](https://github.com/coinbase/x402)
- [Nano Documentation](https://docs.nano.org/)
- [Nano Foundation](https://nano.org/)
