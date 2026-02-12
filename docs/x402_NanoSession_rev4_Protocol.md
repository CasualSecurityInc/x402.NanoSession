# x402.NanoSession Protocol Specification (Rev 4)

**Date:** February 12, 2026
**Status:** Draft / Proposal
**Previous Version:** `x402_NanoSession_Protocol_rev3.md`
**Base Specification:** Single Address Model

## Abstract

x402.NanoSession (Rev 4) is a protocol for high-frequency, machine-to-machine (M2M) payments over HTTP using the Nano (XNO) network. It utilizes a **Deterministic Raw Tagging** mechanism to allow a single Nano address to process thousands of concurrent payments without requiring unique address generation per request. This base specification defines the core payment flow, async verification, and tagging logic using a single, static server address.

Advanced address management strategies (Sharded Pools, Stochastic Rotation) are defined in separate Extension documents.

## 1. Communication Flow

### 1.1. Overview

```
┌────────┐         ┌────────┐         ┌──────────┐
│ Client │         │ Server │         │   Nano   │
└───┬────┘         └───┬────┘         └────┬─────┘
    │  GET /resource   │                   │
    │─────────────────>│                   │
    │  402 + Headers   │                   │
    │<─────────────────│                   │
    │           Send Block                 │
    │─────────────────────────────────────>│
    │  GET /resource + Block Hash          │
    │─────────────────>│                   │
    │                  │  Verify Block     │
    │                  │──────────────────>│
    │  200 OK          │                   │
    │<─────────────────│                   │
```

### 1.2. Typical Payment Flow

1.  Client requests protected resource
2.  Server returns HTTP 402 with payment requirements (headers)
3.  Client calculates tagged amount using provided tag
4.  Client signs Nano send block and broadcasts to network
5.  Client retries request with `X-402-Payment-Block` header containing block hash
6.  Server verifies block is confirmed, tag matches, destination correct, not in Spent Set
7.  Server adds block hash to Spent Set and grants access

### 1.3. Sequence Diagram

```
Client -> Server: GET /resource
Server --> Client: 402 + Headers
Client --> Nano: Send Block
Client -> Server: GET /resource + Block Hash
Server -> Nano: Verify Block
Server --> Client: 200 OK
```

## 2. Architecture (Base Model)

### 2.1. The Client: Headless "Purse" Middleware
The primary client is middleware for HTTP clients.
*   **Responsibility**: Detects 402 responses, calculates the tagged amount, signs the block locally, and retries the request with the proof.
*   **Safety**: Operates within a user-defined "Daily Budget".

### 2.2. The Server: Single Address
In this Base Specification, the server operates a single Nano account (Standard or HD Derived) to receive all payments.
*   **Concurrency**: Achieved via **Raw Tagging**. The server does not need to pocket (receive) funds immediately to verify them.
*   **Scalability**: A single address can passively observe infinite send blocks targeting it. The limitation is only on the "Janitor" process that must eventually pocket them.

## 3. Technical Specification

### 3.1. Raw Tagging & Uniqueness (Normative)

To distinguish payments sent to the same address, the protocol uses the least significant 7 digits of the amount.

1.  **Tag Modulus**: `TAG_MODULUS = 10,000,000`.
2.  **Tag Generation**: `Tag = Hash(Request_ID || Nonce) % TAG_MODULUS`.
3.  **Uniqueness Enforcement**: The server **MUST** maintain a set of "Pending Tags" per session or globally. If a generated Tag is already pending, retry with a new Nonce.
4.  **Amount Calculation**: `Amount_Final = Price_Raw + Tag` (where `Price_Raw % TAG_MODULUS == 0`).

## 4. Extensions

For high-volume services or privacy-sensitive implementations, see the following extensions:

*   **[Extension A: Generational Sharded Pools](x402_NanoSession_Extension_A_Pools.md)**: Defines how to scale to 20-100 addresses to mitigate ledger contention during pocketing.
*   **[Extension B: Stochastic Rotation](x402_NanoSession_Extension_B_Stochastic.md)**: Defines usage-based address rotation for privacy and traffic analysis resistance.

## See Also

For more information on x402 and Nano, see the following resources:

*   [x402 Standard](https://github.com/coinbase/x402)
*   [Nano Documentation](https://docs.nano.org/)
*   [Nano Foundation](https://nano.org/)
