---
title: Protected Content Demo
---

# x402.NanoSession (Rev 6) — Protected Content Demo

This page demonstrates how a resource server can protect exclusive or premium content seamlessly using the **Rev 6** protocol flow. The server has generated a unique Session ID for you, attached a deterministic tag to the required amount, and is now listening to the active Nano network for your payment in real-time.

::: warning Warning: Exact Payment Required
The protocol routes sessions via exact "dust" amounts (trailing decimals). You **must send the exact requested amount**. (see [Notes on Raw-Dust UX](./appendix/wallet-ux)).

*Demo quirk: To ensure compatibility with current 6-decimal constrained UI wallets, this demo shifts the session tag offset to the 3rd to 6th decimal place (e.g., 0.014321 XNO instead of 0.010000000000000000000000654321 XNO). This is not an issue when using a normal x402-aware client library.*
:::

<NanoPaywall>

*Premium video content (requires payment to unlock)*

</NanoPaywall>
