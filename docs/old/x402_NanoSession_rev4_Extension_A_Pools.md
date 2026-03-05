# x402.NanoSession Extension A: Generational Sharded Pools

**Date:** February 12, 2026
**Status:** Draft / Proposal
**Extension For:** `x402_NanoSession_Protocol_rev4.md`

## 1. Abstract

This extension defines the **Sharded Pool** architecture for high-volume services. While the Base Specification uses a single address, services processing >1 TPS may encounter ledger contention when the "Janitor" attempts to pocket funds. Sharded Pools distribute this load across 20-100 addresses using deterministic mapping based on Session ID.

## 2. Motivation: Single-Chain Concurrency

The primary motivation for this extension is **Throughput**, not privacy.

*   **Head-of-Line Blocking:** In Nano's Block Lattice, each account has its own blockchain. Blocks must be appended sequentially. To "pocket" a pending payment, the server must generate a Receive Block that references the previous block on that account.
*   **The Bottleneck:** If a single address receives 1,000 payments/sec, the server must sign and publish 1,000 receive blocks *in order*. Network propagation and PoW generation (even with acceleration) create a hard physical limit on the confirmation rate of a single chain.
*   **The Solution:** By distributing sessions across $N$ addresses (shards), the server can process $N$ receive chains in parallel, effectively multiplying the maximum settlement throughput by $N$.

## 3. Architecture

### 2.1. The Server: Generational Sharded Pool
The server maintains a pool of $N$ addresses. To ensure operational hygiene and mitigate long-term fingerprinting, the pool rotates periodically using Hierarchical Deterministic (HD) derivation.

**Address Derivation (Normative):**
The server derives addresses using the following path:
`m / 44' / 165' / <Generation>' / <Pool_Index>'`

*   `Generation = floor(UnixTimestamp / Rotation_Period)` (Default `Rotation_Period`: 1 Week).
*   `Pool_Index = Hash(Session_ID) % Pool_Size` (Recommended Pool_Size: 20-100).

### 2.2. Session Mapping
When a client requests a resource, the server uses their `Session_ID` (from `X-402-Session` header) to determine the correct `Pool_Index`.

**Server Response (402)**:
*   `X-402-Address`: The specific pool address derived from `Pool_Index`.

### 2.3. The Janitor
To ensure the server's pool accounts are always ready to move funds, the "Janitor" process SHOULD pre-compute PoW for the next expected `receive` block for **every address in the pool**. This parallelism allows the server to settle funds 20-100x faster than a single address.

## 3. Rotation & Grace Period

Servers MUST monitor addresses for both the **Current** and ** Previous** Generations. This ensures that clients who started a session right before a generation flip can still complete their payment.

## 4. Privacy Considerations

The Sharded Pool model provides limited privacy against an active observer. An attacker can enumerate the server's entire active pool by making repeated requests with different `X-402-Session` IDs. This extension primarily addresses **throughput**, not privacy. For privacy, see **Extension B**.
