---
title: Protected Content Demo
---

# x402.NanoSession Rev 8 — Protected Content Demo

This page demonstrates the active **Rev 8** `nanoMacaroon` flow.

The important sequence is:

1. your first request for the protected resource returns `402 Payment Required`
2. the browser shows the machine-readable `PAYMENT-REQUIRED` challenge
3. the demo server now allocates a per-challenge destination from a bounded server-side address pool when `NANO_TEST_SEED` is configured
3. after you pay, the browser uses the demo-only `/api/poll-for-demo` helper to poll for a matching confirmed send from the payer account you provide
4. the browser retries the same protected resource request with `PAYMENT-SIGNATURE`
5. the server verifies the settlement through its facilitator logic and returns `200 OK` with `PAYMENT-RESPONSE`

::: warning Warning: Exact Payment Required
The `/api/poll-for-demo` helper is intentionally manufactured for clarity. It is **not** part of the normal x402 roundtrip.

In a real x402 client, the client itself is responsible for publishing the send block, so once `process(sendBlock)` succeeds it already has the send hash and can immediately retry the protected resource request with `PAYMENT-SIGNATURE`.

Also note that settlement policy and access policy are separate concerns: a deployment can redeem one payment into a reusable credential, or can choose a narrower pay-per-access policy by issuing credentials with much tighter caveats.

There is also an important security distinction: some deployments already have application-specific uniqueness for each checkout, while others are merely proxying a shared public URL. This demo now improves the checkout story by allocating a unique server destination per challenge when the demo server has a `NANO_TEST_SEED`, but it still does **not** implement the formal Track B payer-bound settlement extension.
:::

<NanoPaywall>

*Premium video content (requires payment to unlock)*

</NanoPaywall>
