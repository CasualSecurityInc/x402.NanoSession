---
title: Intro
---

# x402.NanoSession (Rev 3) — Intro

x402.NanoSession brings HTTP 402 payments to Nano (XNO) with a single-address, high-concurrency design. It focuses on deterministic raw tagging and async verification to enable instant, feeless, per-request payments without smart contracts.

| Feature | Original x402 spec (x402.org whitepaper) | x402.NanoSession Rev 3 |
| --- | --- | --- |
| Transport | HTTP 402 “Payment Required” flow with structured payment details | HTTP 402 flow with explicit X-402 headers and raw-tag semantics |
| Payment rail | Onchain stablecoins (e.g., USDC), chain-agnostic | Nano (XNO), feeless, instant finality |
| Client auth | Signed payment authorization; no API keys/subscriptions | Deterministic raw tagging + block hash proof; no API keys |
| Concurrency model | Per-request payment authorization | Single service address with deterministic raw tag uniqueness |
