# x402.NanoSession Extension B: Stochastic Rotation (Moving Window)

**Date:** February 12, 2026
**Status:** Draft / Proposal
**Extension For:** `x402_NanoSession_rev5_Protocol.md`

## 1. Abstract

This extension defines the **Stochastic Rotation** mechanism for privacy-focused services. Unlike the static/periodic pools in Extension A, this model uses a dynamic "Moving Window" of addresses that retire based on usage, preventing passive traffic analysis and revenue enumeration.

## 2. Motivation: Privacy via Obfuscation

While **Extension A** solves the *throughput* problem via sharding, it leaves the service's total revenue transparent to any observer who can enumerate the 20-100 active pool addresses.

*   **The Problem:** An observer can map the static pool and monitor the service's total income, customer growth, and peak hours.
*   **The Solution:** By constantly rotating addresses based on usage (stochastic), the "map" becomes stale faster than an attacker can update it.
*   **Inherited Benefit:** Since this model also utilizes multiple active addresses (Active Window $M$), the extension inherits the high-throughput concurrency benefits of Extension A.

## 3. Core Concept: Usage-Based Rotation

In standard pools, addresses rotate on a fixed schedule (e.g., weekly). An attacker can map these addresses once per week. In this extension, addresses rotate **stochastically** based on transaction volume.

## 3. Architecture

### 3.1. Dynamic Sharding
The server maintains an **Active Window** of slots ($M$) that move independently through the HD derivation path.

*   **Derivation:** `m/44'/165'/0'/index'` (Monotonic increasing index).
*   **Slot Lifecycle:** Each of the $M$ active slots is assigned a unique `index` and a secret `Usage_Limit` ($N$).
*   **Randomization:** $N$ is a random variable (e.g., $N \,sim\, \text{Uniform}(3, 50)$).
*   **Retirement:** Once a slot has received $N$ confirmed payments, it is **retired**. A new address from the next available `index` is derived to fill the slot.

### 3.2. Privacy Advantages (Moving Target Defense)

*   **Breaking the Watchlist:** An attacker's "map" of the pool becomes stale at a rate proportional to the server's traffic. High-traffic APIs rotate addresses faster, making them harder to monitor.
*   **Sampling rate vs. Accuracy:** To maintain an accurate view of the pool, an attacker must probe the API faster than the "fastest" slot turnover ($N_{min}$).

### 3.3. Implementation Guidelines (The Janitor)

**Decoupled Consolidation:** Since there are no multi-input transactions in Nano, the "Janitor" (sweep service) should process these "Burner" accounts one-by-one.

**Randomized Settlement:** The order, timing, and destination wallets for sweeping funds MUST be randomized to prevent "Consolidation Fingerprinting" on the ledger. Funds from retired addresses should be swept to a Mix or Exchange deposit address with random delays.

## 4. Session Binding in Stochastic Mode

Session binding (per Rev 5 security requirements) applies regardless of address rotation:

1. Server selects active slot based on internal load balancing
2. Server generates `sessionId` and stores: `sessionId → { payTo: slot.address, baseAmount, tag, expiresAt }`
3. Even if the slot rotates before client pays, the stored `payTo` remains valid for verification
4. Client returns `sessionId` with block hash
5. Server verifies against stored requirements (not current active pool)

**Important:** Session storage decouples payment verification from pool rotation. A session created for slot `A` remains valid even after `A` retires, provided the session hasn't expired.
