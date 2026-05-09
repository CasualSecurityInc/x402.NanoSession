---
title: Protocol Specification
---

# x402.NanoSession Protocol Specification (Rev 8)

**Status:** Draft  
**Date:** April 2026  
**Breaking Change:** Clean break from Rev 7 and the earlier Rev 8 nanoMacaroon draft

## Abstract

x402.NanoSession Rev 8 defines a Nano-specific `exact` payment mechanism for x402 using **NanoNyms**: reusable payment roots built on top of the Nano (XNO) block lattice.

The resource server advertises a public NanoNym root as `payTo`. The client derives a one-time stealth destination from that root, pays the exact raw-tagged amount on-chain, and retries the request with a settlement proof containing the confirmed send hash plus verifier-usable NanoNym witness material.

This revision focuses only on the **payment-and-retry mechanism**. Post-payment admission artifacts such as reusable access credentials are explicitly out of scope.

## 1. Key Changes from Rev 7 And Earlier Rev 8 Drafts

### 1.1 NanoNym-Backed Settlement

- **Added:** `nnym_...` payment roots as the canonical Rev 8 `payTo` form
- **Added:** client-derived one-time stealth destination per payment
- **Added:** hidden NanoNym witness material in the retry payload
- **Removed:** fixed-destination settlement as the primary Rev 8 story

### 1.2 Exact Raw Tagging Returns

- **Added:** exact raw-tagged invoice amounts as the default anti-borrowing primitive
- **Added:** explicit `resourceAmountRaw` and `tagAmountRaw` transparency fields
- **Removed:** reliance on challenge ID uniqueness alone as an anti-theft claim

### 1.3 No Credential Layer In Base Rev 8

- **Removed:** macaroon issuance from the core Rev 8 mechanism
- **Removed:** credential reuse as a protocol concern for this revision
- **Clarified:** admission and reuse policy remain application-level concerns outside this document

## 2. Threat Model And Assumptions

Rev 8 is designed for the following realistic environment:

- the Nano ledger is public and fully observable
- attackers may obtain their own economically equivalent payment challenges
- attackers may watch public send blocks and derived stealth destinations
- the HTTP dialogue between client and server is assumed to run over authenticated and confidential transport such as HTTPS

Rev 8 does **not** attempt to remain secure if the entire x402 dialogue is exposed to a plaintext-sniffing network attacker. If the request and retry payloads are visible in transit, the deployment is already outside the intended security envelope.

## 3. Core Model

### 3.1 NanoNym Root

A NanoNym root is a reusable payment code with prefix `nnym_`.

For Rev 8 purposes, the root MUST encode enough public information for the client to derive a one-time stealth destination and for the facilitator to verify that a submitted witness corresponds to the advertised root.

The current NanoNym draft exposes at least:

- a public spend key `B_spend`
- a public view key `B_view`
- optional coordination metadata

Rev 8 does not require any specific off-chain notification network. The x402 retry request itself is the coordination channel for settlement redemption.

### 3.2 Exact Raw-Tagged Amount

Every challenge amount MUST be represented in raw and SHOULD be split conceptually into:

- `resourceAmountRaw`: the economic price of the resource
- `tagAmountRaw`: a challenge-unique raw fingerprint

The payable amount is:

`amount = resourceAmountRaw + tagAmountRaw`

The verifier MUST require an exact raw match.

### 3.3 NanoNym Witness

The client MUST retain non-public witness material that lets the facilitator verify that the observed on-chain destination was derived from the advertised NanoNym root.

For the current NanoNym construction, the natural witness is a tweak scalar, denoted here as `t`.

The key property is:

- the ledger reveals the final stealth destination
- the retry payload reveals the witness
- neither public chain data alone nor a different challenge with a different raw tag are enough to redeem the payment out of context

### 3.4 Delegable Funding

Rev 8 allows the actor who funds the payment and the actor who redeems the payment to differ.

Examples:

- an autonomous client funds and redeems directly
- a human or external wallet funds a client-controlled lane account first, and the client performs the final exact tagged payment
- a human helper pays the final stealth address directly while the client later redeems with the send hash and NanoNym witness

The base Rev 8 mechanism therefore does not require payer-key control as part of ordinary redemption.

## 4. Protocol Flow

```
┌────────┐          ┌─────────────────┐       ┌─────────────┐        ┌──────────┐
│ Client │          │ Resource Server │       │ Facilitator │        │   Nano   │
└───┬────┘          └────────┬────────┘       └──────┬──────┘        └────┬─────┘
    │  GET /resource         │                       │                    │
    │───────────────────────>│                       │                    │
    │                        │   Create Challenge    │                    │
    │                        │──────────────────────>│                    │
    │                        │ {challenge}           │                    │
    │                        │<──────────────────────│                    │
    │ 402 + PAYMENT-REQUIRED │                       │                    │
    │<───────────────────────│                       │                    │
    │ Derive stealth destination from nnym          │                    │
    │                    Send Block (Broadcast)                           │
    │────────────────────────────────────────────────────────────────────>│
    │  GET /resource         │                       │                    │
    │  + PAYMENT-SIGNATURE   │                       │                    │
    │───────────────────────>│                       │                    │
    │                        │ Verify Settlement     │                    │
    │                        │──────────────────────>│                    │
    │                        │                       │   Fetch Block      │
    │                        │                       │───────────────────>│
    │                        │                       │   Confirmed?       │
    │                        │                       │<───────────────────│
    │                        │  Settlement Accepted  │                    │
    │                        │<──────────────────────│                    │
    │        200 OK          │                       │                    │
    │<───────────────────────│                       │                    │
```

In a normal client, the client derives the stealth destination locally, publishes the Nano send, and retries as soon as it knows the send hash.

If a human or external wallet performs the payment, the client MAY wait for the expected stealth destination to show a matching incoming send before retrying.

## 5. Track Guidance

### 5.1 Track A: Application-Known Uniqueness

Use this when the application already has meaningful checkout uniqueness beyond the payment mechanism.

Examples:

- a unique resource URL or path
- a URL parameter that identifies one checkout
- an application token or authenticated session

In this track, base Rev 8 settlement is typically sufficient:

- NanoNym witness binds the payment to the advertised root
- exact raw tagging binds the payment to the specific challenge amount
- replay tracking prevents duplicate redemption

### 5.2 Track B: Public Resource Proxy

Use this when multiple requesters can obtain economically equivalent challenges for the same public resource.

Examples:

- a shared `/item/1` URL for all clients
- a proxy in front of a fixed public asset
- a public API route with identical pricing semantics for all requesters

In this track, Rev 8 relies primarily on:

- unique exact raw-tagged amounts per challenge
- non-public NanoNym witness material in the retry payload
- normal challenge expiry and replay state

This combination is intended to stop cross-challenge borrowing from public chain observations alone.

Deployments that additionally want the **same wallet that funded the payment** to prove control of the sending account MAY require **Extension A: Payer-Bound Settlement**. That extension adds an optional NOMS-based payer signature and is not part of the base Rev 8 anti-theft story.

## 6. Data Types

### 6.1 PaymentRequired (HTTP 402 Response)

```typescript
interface PaymentRequired {
  x402Version: 2;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
}
```

### 6.2 Challenge

```typescript
interface Challenge {
  version: 'ns8';
  mechanism: 'nano-nym-exact';
  challengeId: string;
  resourceUrl?: string;
  settlementPolicy: 'send_confirmed' | 'receive_confirmed';
  resourceAmountRaw: string;
  tagAmountRaw: string;
  amount: string;
  payToKind: 'nanonym';
  payTo: string;                // nnym_...
  expiresAt: string;            // ISO-8601 timestamp
}
```

Requirements:

- `amount` MUST equal `resourceAmountRaw + tagAmountRaw`
- `tagAmountRaw` SHOULD be unique across active challenges issued by the deployment
- `payTo` MUST be a valid NanoNym root when `payToKind` is `nanonym`

### 6.3 PaymentRequirements

```typescript
interface PaymentRequirements {
  scheme: 'exact';
  network: 'nano:mainnet';
  asset: 'XNO';
  amount: string;               // Exact raw amount
  payTo: string;                // nnym_...
  maxTimeoutSeconds: number;
  extra: {
    challenge: Challenge;
  };
}
```

### 6.4 Settlement Proof

```typescript
interface NanoNymWitnessV1 {
  type: 'nanonym-tweak-v1';
  tweak: string;                // Hex-encoded scalar t
}

interface SettlementProof {
  version: 'ns8';
  mechanism: 'nano-nym-exact';
  mode: 'settle';
  challengeId: string;
  sendHash: string;
  witness: NanoNymWitnessV1;
  payerAccount?: string;        // Optional hint only
}
```

`payerAccount` is optional in the base profile. If present, the facilitator MUST treat it only as a hint and MUST verify any payer-account assertions from chain data, not from the client payload alone.

### 6.5 PaymentPayload (Retry Request)

```typescript
interface PaymentPayload {
  x402Version: 2;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepted: PaymentRequirements;
  payload: SettlementProof;
  extensions?: Record<string, unknown>;
}
```

### 6.6 PaymentResponse (Success Response)

```typescript
interface PaymentResponse {
  x402Version: 2;
  result: {
    version: 'ns8';
    mechanism: 'nano-nym-exact';
    mode: 'settled';
    challengeId: string;
    sendHash: string;
    destination: string;        // Derived stealth nano_ address
    amount: string;
    payerAccount?: string;      // Chain-observed sender if available
    settledAt: string;          // ISO-8601 timestamp
  };
  success?: boolean;
  error?: string;
}
```

Rev 8 does not define any reusable admission token or credential inside `PaymentResponse`.

## 7. HTTP Headers

### 7.1 Server -> Client (402 Response)

**Header:** `PAYMENT-REQUIRED`

Base64-encoded `PaymentRequired` JSON.

### 7.2 Client -> Server (Retry)

**Header:** `PAYMENT-SIGNATURE`

Base64-encoded `PaymentPayload` JSON.

### 7.3 Server -> Client (Success)

**Header:** `PAYMENT-RESPONSE`

Base64-encoded `PaymentResponse` JSON.

## 8. Verification Rules

### 8.1 Required Checks

The facilitator MUST reject settlement unless all of the following succeed:

1. the challenge exists and is not expired
2. the replay key for this challenge and send hash has not already been spent
3. the accepted `PaymentRequirements` exactly match the issued challenge semantics
4. the NanoNym witness is well-formed and matches the advertised `nnym_...` root
5. the expected stealth destination derived from `payTo` plus witness is computed successfully
6. the on-chain send block identified by `sendHash` exists
7. the send block is confirmed if `settlementPolicy` is `send_confirmed`
8. the send block amount exactly equals the challenge amount
9. the send block destination exactly equals the derived stealth destination
10. any stricter deployment-specific checks also pass

### 8.2 Settlement Policy

`send_confirmed` SHOULD be the default policy.

Reason:

- the resource server is paying for proof of a send event, not treasury bookkeeping
- it avoids coupling authorization latency to payee receive publication
- it works for both direct client funding and delegated funding

`receive_confirmed` MAY be offered by deployments that explicitly want access to wait for payee receive publication.

### 8.3 Derived Destination Verification

For the current NanoNym draft, the facilitator verifies the destination using public NanoNym material and the submitted tweak witness.

At a high level:

1. decode `nnym_...` to recover `B_spend` and other public fields
2. parse the submitted tweak scalar `t`
3. compute `P_stealth = B_spend + tG`
4. convert `P_stealth` to the expected `nano_...` destination
5. compare that destination to the chain-observed send destination

The facilitator does not need the merchant seed, spend private key, or view private key to perform this verification.

## 9. Security Model

### 9.1 Cross-Challenge Borrowing Resistance

Rev 8 is intended to stop the following attack under the stated threat model:

- attacker observes a real public send block for someone else's payment
- attacker obtains their own economically equivalent challenge for the same public resource
- attacker attempts to redeem the observed send against the attacker's own challenge

The base Rev 8 answer is:

- the challenge amount includes a unique raw tag
- the retry payload includes non-public NanoNym witness material
- the facilitator requires both the exact amount and the exact NanoNym-derived destination match

Under these conditions, public chain observations alone are not intended to be enough to borrow someone else's payment for a different challenge.

### 9.2 Transport Assumption

Rev 8 assumes the request/response dialogue is not publicly readable in transit.

This specification does not claim to protect against:

- a plaintext-sniffing network attacker who can read the entire x402 dialogue
- a compromised client endpoint that leaks the retry payload before redemption
- an application that intentionally shares one challenge across multiple independent redeemers

### 9.3 Delegable Funding

Because the witness-bearing redeemer and the on-chain funder may be different actors, base Rev 8 does not use payer-key control as its primary proof primitive.

That means:

- a helper can fund a payment
- a client can redeem it later using the hidden witness material
- seeing only the chain event does not automatically confer redemption rights

### 9.4 Optional Stronger Hardening

Deployments that want the same wallet that funded the payment to also prove sender-key control MAY require **Extension A: Payer-Bound Settlement**.

This is optional and changes the trust model:

- it is better suited to integrated wallets
- it is a worse fit for delegated or human-in-the-loop funding
- it relies on a NOMS-signed payer-binding message defined by the extension

## 10. Attack Matrix

Assume:

- `C_A1` = challenge for ClientA requesting `/item/1`
- `C_B1` = challenge for ClientB requesting `/item/1`
- `S_A1` = real send block matching `C_A1`
- `W_A1` = real NanoNym witness for `C_A1`
- `W_bad` = random or mismatched witness
- `S_rand` = unrelated public send block

| Presented | Challenge | Presenter | Resource | Expected |
| --- | --- | --- | --- | --- |
| `S_A1 + W_A1` | `C_A1` | ClientA | `/item/1` | ALLOW |
| `S_A1 + W_A1` | `C_B1` | ClientB | `/item/1` | DENY if amount tag differs |
| `S_A1 + W_bad` | `C_A1` | ClientA | `/item/1` | DENY |
| `S_rand + W_A1` | `C_A1` | ClientA | `/item/1` | DENY |
| exact duplicate redemption of `S_A1` for `C_A1` | `C_A1` | ClientA | `/item/1` | DENY |

## 11. Non-Normative Operational Guidance

### 11.1 Consumer Wallet Precision Limits

Some human-operated wallets expose only 6 decimal places of XNO and cannot emit exact raw-tagged amounts directly.

In that case, a client MAY use a two-step operational flow:

1. request a rounded-up top-up from a human or external wallet into a client-controlled purse or lane account
2. wait for the top-up to arrive
3. emit the exact raw-tagged NanoNym payment from the client-controlled account

Only the final exact tagged payment is protocol-relevant for Rev 8 settlement verification.

### 11.2 Outgoing Lanes

Clients MAY maintain multiple outgoing subaccounts or lanes for treasury isolation, top-up handling, or concurrency. Rev 8 does not standardize lane management.

## 12. Scope Boundary

This document defines only:

- challenge issuance
- exact NanoNym-backed settlement
- retry-time settlement verification

This document does not define:

- reusable access credentials
- application admission semantics after payment
- NanoNym wallet recovery procedures
- off-chain messaging networks such as Nostr

## See Also

- [Extension A: Payer-Bound Settlement](./x402_NanoSession_rev8_Extension_A_PayerBoundSettlement.md)
- [x402 Standard](https://github.com/coinbase/x402)
