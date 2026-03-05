---
title: Intro
---

# x402.NanoSession (Rev 3) — Intro

x402.NanoSession defines a straightforward per-request HTTP 402 scheme for access to web resources and APIs. Payments are settled instantly and feelessly via Nano (XNO), avoiding smart‑contract overhead.

| Feature | Original x402 (x402.org) | x402.NanoSession Rev 3 |
| --- | --- | --- |
| Transport | HTTP 402 with JSON payment details | HTTP 402 with X-402 headers |
| Payment rail | Onchain stablecoins (e.g., USDC on Base) | Nano (XNO): feeless, sub-second finality |
| Client proof | Wallet-signed authorization (EIP-712) | Amount-encoded request ID + block hash |
| Concurrency | Per-request wallet signature | Multiplexed via unique request IDs per address |
