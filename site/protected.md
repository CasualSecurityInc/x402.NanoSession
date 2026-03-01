# Protected Content Demo

Welcome to the x402.NanoSession interactive demo!

This page demonstrates how a resource server can protect exclusive or premium content seamlessly using the **Rev 5** protocol flow. The server has generated a unique Session ID for you, attached a deterministic tag to the required amount, and is now listening to the active Nano network for your payment in real-time.

<div class="warning custom-block">
  <p class="custom-block-title">Warning: Exact Payment Required</p>
  <p>The protocol routes sessions via exact "dust" amounts (trailing decimals). You <b>must send the exact requested amount</b>.</p>
  <p>The <b>Nault</b> wallet truncates outgoing amounts to 6 decimals, destroying this "dust tag". Using Nault via QR code will prevent the Server from recognizing the payment! We recommend using <b>Natrium</b>, the <b>Pay with Wallet</b> button, or a developer CLI.</p>
</div>

<NanoPaywall>

🎉 **Payment successful!**

You've just experienced NanoSession Rev5 - feeless, instant, cross-client payments via HTTP 402.

Because the server securely binds the `sessionId` to the dust tag (`X-Payment-Amount`), the architecture is completely immune to the "Frontier Dilemma" while remaining fundamentally stateless at the edge. 

*This content was protected by a real Nano payment. No accounts, no sign-ups, no tracking. Just pay and access.*

</NanoPaywall>
