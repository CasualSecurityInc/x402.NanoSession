
### 📂 Specification Structure
- **Protocol**: [rev3 Protocol Definition](/)
- **Extensions**:
  - [x402 NanoSession Protocol - Rev 3 Planning (Stochastic Dynamics)](/extensions/rev3-planning)
  - [x402.NanoSession Extension A: Generational Sharded Pools](/extensions/extension-a-pools)
  - [x402.NanoSession Extension B: Stochastic Rotation (Moving Window)](/extensions/extension-b-stochastic)

---

# x402.NanoSession Protocol Specification (Rev 3)

**Date:** February 9, 2026
**Status:** Draft / Proposal
**Previous Version:** `x402_NanoSession_Protocol_rev2.md`
**Base Specification:** Single Address Model

## Abstract

x402.NanoSession (Rev 3) is a protocol for high-frequency, machine-to-machine (M2M) payments over HTTP using the Nano (XNO) network. It utilizes a **Deterministic Raw Tagging** mechanism to allow a single Nano address to process thousands of concurrent payments without requiring unique address generation per request. This base specification defines the core payment flow, async verification, and tagging logic using a single, static server address. 

Advanced address management strategies (Sharded Pools, Stochastic Rotation) are defined in separate Extension documents.

## 1. Motivation

The "Agent Economy" requires a frictionless way for software to compensate services for micro-units of work. This protocol leverages Nano's unique block-lattice properties to allow for payment verification in under 500ms with no fees. The Base Specification focuses on the simplest implementation: a single server address receiving tagged payments from multiple clients.

## 2. Terminology

*   **Session**: A logical grouping of requests from a single client agent, identified by a `Session_ID`.
*   **Raw Tagging**: Encoding a unique integer identifier into the least significant digits of the Nano Raw amount.
*   **Async Verification**: A server-side process that grants access upon observing a confirmed *send* block on the network. The server **MUST NOT** wait for its own *receive* block before granting access.
*   **Spent Set**: A durable record of all processed Nano block hashes used to prevent double-spending or replay attacks.

## 3. Architecture (Base Model)

### 3.1. The Client: Headless "Purse" Middleware
The primary client is middleware for HTTP clients.
*   **Responsibility**: Detects 402 responses, calculates the tagged amount, signs the block locally, and retries the request with the proof.
*   **Safety**: Operates within a user-defined "Daily Budget".

### 3.2. The Server: Single Address
In this Base Specification, the server operates a single Nano account (Standard or HD Derived) to receive all payments.
*   **Concurrency**: Achieved via **Raw Tagging**. The server does not need to pocket (receive) funds immediately to verify them.
*   **Scalability**: A single address can passively observe infinite send blocks targeting it. The limitation is only on the "Janitor" process that must eventually pocket them.

## 4. Technical Specification

### 4.1. Raw Tagging & Uniqueness (Normative)

To distinguish payments sent to the same address, the protocol uses the least significant 7 digits of the amount.

1.  **Tag Modulus**: `TAG_MODULUS = 10,000,000`.
2.  **Tag Generation**: `Tag = Hash(Request_ID || Nonce) % TAG_MODULUS`.
3.  **Uniqueness Enforcement**: The server **MUST** maintain a set of "Pending Tags" per session or globally. If a generated Tag is already pending, retry with a new Nonce.
4.  **Amount Calculation**: `Amount_Final = Price_Raw + Tag` (where `Price_Raw % TAG_MODULUS == 0`).

### 4.2. Verification Flow (Normative)

1.  **Client Request**: Sends `GET /api/resource`.
2.  **Server Response (402)**: Returns headers:
    *   `X-402-Session`: The session identifier.
    *   `X-402-Address`: The **Single Service Address**.
    *   `X-402-Price-Raw`: The base price (multiple of 10M).
    *   `X-402-Tag`: The unique tag.
    *   `X-402-Expires`: Tag reservation deadline.
3.  **Client Payment**: Publishes a Send Block to the network.
4.  **Client Retry**: Sends request with `X-402-Payment-Block: <Block_Hash>`.
5.  **Server Check**:
    *   **Link Binding**: Verifies `Block.link` matches the Service Address.
    *   **Tag Match**: Verifies `Block.Amount % TAG_MODULUS == Tag`.
    *   **Confirmation**: Verifies `Block.Confirmed == True`.
    *   **Spent Check**: Verifies `Block_Hash` is not in the **Spent Set**.
6.  **Access Granted**.

## 5. Extensions

For high-volume services or privacy-sensitive implementations, see the following extensions:

*   **[Extension A: Generational Sharded Pools](x402_NanoSession_Extension_A_Pools.md)**: Defines how to scale to 20-100 addresses to mitigate ledger contention during pocketing.
*   **[Extension B: Stochastic Rotation](x402_NanoSession_Extension_B_Stochastic.md)**: Defines usage-based address rotation for privacy and traffic analysis resistance.


## 📚 Related Extensions
- [x402 NanoSession Protocol - Rev 3 Planning (Stochastic Dynamics)](/extensions/rev3-planning)
- [x402.NanoSession Extension A: Generational Sharded Pools](/extensions/extension-a-pools)
- [x402.NanoSession Extension B: Stochastic Rotation (Moving Window)](/extensions/extension-b-stochastic)
