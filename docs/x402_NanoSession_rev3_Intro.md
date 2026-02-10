---
title: Intro
---

# x402.NanoSession (Rev 3) — Intro

x402.NanoSession defines a straightforward per-request HTTP 402 scheme for access to web resources and APIs. Payments are settled instantly and feelessly via Nano (XNO), avoiding smart‑contract overhead.

| Feature | Original x402 spec (x402.org whitepaper) | x402.NanoSession Rev 3 |
| --- | --- | --- |
| Transport | HTTP 402 “Payment Required” flow with structured payment details | HTTP 402 flow with explicit X-402 headers and raw-tag semantics |
| Payment rail | Onchain stablecoins (e.g., USDC), chain-agnostic | Nano (XNO), feeless, instant finality |
| Client auth | Signed payment authorization; no API keys/subscriptions | Deterministic raw tagging + block hash proof; no API keys |
| Concurrency model | Per-request payment authorization | Single service address with deterministic raw tag uniqueness |
