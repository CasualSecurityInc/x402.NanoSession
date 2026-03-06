# Protected Content Demo

This page demonstrates how a resource server can protect exclusive or premium content seamlessly using the **Rev 5** protocol flow. The server has generated a unique Session ID for you, attached a deterministic tag to the required amount, and is now listening to the active Nano network for your payment in real-time.

::: warning Warning: Exact Payment Required
The protocol routes sessions via exact "dust" amounts (trailing decimals). You **must send the exact requested amount**. We recommend using **Natrium** or **Nautilus** for this demo. (see [Notes on Raw-Dust UX](./appendix/wallet-ux)).

*To ensure compatibility with mobile 6-decimal wallets, the base price of 0.01 XNO is automatically adjusted up to 6 decimal places for tagging (e.g. 0.011234 XNO).*
:::

<NanoPaywall>

*Premium video content (requires payment to unlock)*

</NanoPaywall>
