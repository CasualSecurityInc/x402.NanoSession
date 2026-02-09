
[← Back to Protocol](/)

# x402 NanoSession Protocol - Rev 3 Planning (Stochastic Dynamics)

This document explores advanced privacy and obfuscation strategies for a future Rev 3, building upon the sharded pool model of Rev 2.

## Core Concept: Stochastic Pool Rotation (Moving Window)

In Rev 2, the pool is a static set of addresses that rotates on a fixed time schedule (Generational). In Rev 3, we propose a **Usage-Based Stochastic Rotation** to break passive traffic analysis.

### 1. The Probing Vulnerability (Context)
As identified in Rev 2 discussions, a fixed pool of $N$ addresses can be trivially enumerated by an attacker rotating Session IDs. Once the pool is mapped, the attacker can passively monitor those $O(N)$ addresses to capture 100% of the server's transaction volume.

### 2. Proposed Mechanism: Dynamic Sharding
Instead of a fixed generational set, the server maintains an **Active Window** of slots ($M$) that move independently through the HD derivation path.

*   **Derivation:** `m/44'/165'/0'/index'` (Monotonic increasing index).
*   **Slot Lifecycle:** Each of the $M$ active slots is assigned a unique `index` and a secret `Usage_Limit` ($N$).
*   **Randomization:** $N$ is a random variable (e.g., $N \sim 	ext{Uniform}(3, 50)$).
*   **Retirement:** Once a slot has received $N$ confirmed payments, it is retired. A new address from the next available `index` is derived to fill the slot.

### 3. Privacy Advantages (Moving Target Defense)
*   **Breaking the Watchlist:** An attacker's "map" of the pool becomes stale at a rate proportional to the server's traffic. High-traffic APIs rotate addresses faster, making them *harder* to monitor.
*   **Sampling rate vs. Accuracy:** To maintain an accurate view of the pool, an attacker must probe the API faster than the "fastest" slot turnover ($N_{min}$). If a slot retires after 3 payments during a burst, a slow prober misses it entirely.
*   **Traffic Shaping:** The server can dynamically adjust $M$ (Pool Size) and the distribution of $N$ (Usage) based on current load or detected probing attempts.

### 4. Implementation Guidelines (The Janitor)
*   **Decoupled Consolidation:** Since there are no multi-input transactions in Nano, the "Janitor" (sweep service) should process these "Burner" accounts one-by-one.
*   **Randomized Settlement:** The order, timing, and destination wallets for sweeping funds should be randomized to prevent "Consolidation Fingerprinting" on the ledger.
*   **Lazy Opening:** Server accounts do not need to be "opened" (published `receive` block) to verify payments. They can remain in a "pending" state indefinitely until the Janitor settles them.

### 5. Trade-offs: Privacy vs. Ledger Hygiene
*   **State Bloat:** This model creates many "dust" accounts with low block counts.
*   **Pruning:** Reliance on Nano's pruning capabilities is higher here.
*   **Utility:** The cost of additional ledger entries is weighed against the fundamental right to financial privacy in an M2M economy.

## Summary of Rev 3 Goals
*   Transition from **Time-Based** to **Usage-Based** (Stochastic) rotation.
*   Increase default active pool sizes ($M$) to $500-1000+$ for high-traffic services.
*   Formalize the **Janitor's** role in randomized fund consolidation.
