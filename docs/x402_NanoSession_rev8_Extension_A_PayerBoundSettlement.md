---
title: Payer-Bound Settlement
---

# Extension A: Payer-Bound Settlement

**Status:** Draft  
**Date:** April 2026  
**Type:** Optional Opt-in Extension  
**Base Specification:** `x402_NanoSession_rev8_Protocol.md`

## 1. Abstract

This extension adds an optional stronger requirement on top of base Rev 8 NanoNym settlement: the redeemer must also prove control of the wallet account that funded the on-chain send.

Base Rev 8 is intentionally compatible with delegated and human-in-the-loop funding. This extension is for deployments that want a stricter **same-wallet** proof model and are willing to trade away some delegated-funding flexibility.

The off-chain payer signature defined by this extension MUST use **Nano Off-chain Message Signing (NOMS)** as defined in [ORIS-001](https://github.com/OpenRai/Standards/blob/main/rfcs/ORIS-001.md).

## 2. Relationship To Base Rev 8

Under the base Rev 8 mechanism, settlement redemption succeeds when the verifier confirms:

- the exact raw-tagged amount for the challenge
- the exact derived stealth destination for the advertised NanoNym root
- the normal challenge expiry and replay conditions

That base model is sufficient for many deployments, including delegated funding flows.

This extension adds one more requirement:

- the retry payload must include a valid NOMS signature from the actual sending account over a canonical redemption message

So the full proof becomes:

- base Rev 8 NanoNym witness settlement, plus
- sender-account NOMS signature over the redemption context

## 3. Intended Use

This extension is best suited to:

- integrated wallets
- agent-controlled wallets
- custodial wallets that can expose deterministic signing for the final payer account

It is a worse fit for:

- delegated funding where a third party pays directly to the stealth address
- human external wallets that can send funds but cannot produce the required off-chain signature for the x402 retry

## 4. Security Goal

This extension is intended to provide the following additional property:

- observing the public settlement facts and even knowing the NanoNym witness is not sufficient unless the attacker also controls the funding wallet key

More specifically, a redeemer who does not control the private key of the actual sending account MUST NOT be able to complete redemption when this extension is required.

## 5. Extension Overview

The extension adds a payer signature over a canonical redemption message.

The signed message MUST bind at least:

- extension identifier and version
- challenge ID
- resource URL or equivalent redemption context
- challenge amount
- derived stealth destination
- send hash
- payer account

The verifier checks:

1. base Rev 8 settlement proof succeeds
2. the on-chain sender for `sendHash` is determined
3. the submitted `payerAccount` equals that chain-observed sender
4. the signature verifies as a NOMS signature under the sender account key
5. the signed message exactly matches the verifier-side redemption context

## 6. Data Model

### 6.1 PaymentRequirements Extension Advertisement

When this extension is required, the server SHOULD advertise that requirement in `PaymentRequirements.extensions`.

Example shape:

```typescript
interface PayerBoundSettlementRequirement {
  id: 'payer-bound-settlement';
  version: 1;
  required: true;
  signatureScheme: 'noms';
  messageToSign: string;
}
```

The `messageToSign` value is the exact UTF-8 message the payer must sign using NOMS.

### 6.2 PaymentPayload Extension Material

When this extension is used, the client includes extension material in the retry payload.

Example shape:

```typescript
interface PayerBoundSettlementProof {
  id: 'payer-bound-settlement';
  version: 1;
  algorithm: 'noms';
  payerAccount: string;
  signature: string;
}
```

Suggested placement:

```typescript
interface PaymentPayload {
  x402Version: 2;
  accepted: PaymentRequirements;
  payload: SettlementProof;
  extensions?: {
    payerBoundSettlement?: PayerBoundSettlementProof;
  };
}
```

## 7. Canonical Message

The verifier and payer MUST sign and verify the same canonical message.

This extension does **not** define a raw Ed25519 signing scheme of its own. Instead, it defines the exact UTF-8 message string and then requires that string to be signed using NOMS.

Recommended canonical fields:

```typescript
interface PayerBoundSettlementMessageV1 {
  extension: 'payer-bound-settlement';
  version: 1;
  challengeId: string;
  resourceUrl: string;
  amount: string;
  destination: string;
  sendHash: string;
  payerAccount: string;
}
```

Requirements:

- `challengeId` MUST equal the redeemed challenge
- `resourceUrl` MUST equal the verifier's stable resource binding for that redemption
- `amount` MUST equal the challenge amount
- `destination` MUST equal the NanoNym-derived stealth destination accepted by base Rev 8 verification
- `sendHash` MUST equal the base settlement proof's send hash
- `payerAccount` MUST equal the chain-observed sender account for `sendHash`

### 7.1 Exact Message Template

The canonical message string for version `1` MUST be the following UTF-8 text, with fields in exactly this order and a single line-feed (`\n`) between lines:

```text
x402.NanoSession Payer-Bound Settlement
version: 1
challenge_id: <challengeId>
resource_url: <resourceUrl>
amount_raw: <amount>
destination: <destination>
send_hash: <sendHash>
payer_account: <payerAccount>
```

Requirements:

- field labels are lowercase exactly as shown above
- separators are `": "` exactly
- line endings are LF (`0x0a`) only
- there MUST NOT be a trailing blank line
- field values are inserted verbatim from verifier-side facts
- implementations MUST NOT trim, normalize, pretty-print, or reorder fields before signing or verifying

For avoidance of doubt:

- the payer signs the exact UTF-8 message above using NOMS
- the verifier reconstructs the exact same UTF-8 message and verifies it using NOMS
- NOMS supplies the signing-domain separation; this extension supplies the redemption-specific field binding

### 7.2 Example Message

```text
x402.NanoSession Payer-Bound Settlement
version: 1
challenge_id: ch_01JXYZABCDEF
resource_url: https://api.example.com/v1/report/42
amount_raw: 1000000000000000000000000000123
destination: nano_3stealthdestexample111111111111111111111111111111111111111111
send_hash: ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789
payer_account: nano_3payerexample11111111111111111111111111111111111111111111111
```

### 7.3 Verification Algorithm

When this extension is used, the verifier MUST:

1. reconstruct the exact canonical UTF-8 message from verifier-side facts
2. construct the NOMS payload for that message
3. compute the NOMS digest as specified by [ORIS-001](https://github.com/OpenRai/Standards/blob/main/rfcs/ORIS-001.md)
4. verify the submitted signature against that digest using the chain-observed payer account key

The message serialization MUST be deterministic.

## 8. Verification Rules

When this extension is marked required, the server MUST reject redemption unless all of the following succeed:

1. Base Rev 8 settlement verification succeeds.
2. Extension proof material is present.
3. The canonical message is reconstructed exactly from verifier-side facts.
4. The submitted `payerAccount` equals the chain-observed sender account.
5. The signature verifies as a NOMS signature under the payer account's key.
6. The signed message fields exactly match the challenge and redemption context being redeemed.

The verifier MUST reject if:

- the signature is missing
- the signature is invalid
- the signed `challengeId` differs from the redeemed challenge
- the signed `resourceUrl` differs from the verifier's resource binding
- the signed `sendHash` differs from the submitted settlement proof
- the signed `destination` differs from the accepted derived stealth destination
- the signed `payerAccount` differs from the chain-observed sender account
- the NOMS message bytes differ from the canonical template defined in this document

## 9. Expected Security Effect

This extension changes the stricter attack case from:

- "knowledge of the base settlement material may be enough to redeem"

to:

- "base settlement material is not enough; sender-key control is also required"

That means a redeemer who does not control the actual funding wallet cannot complete redemption when this extension is required.

## 10. Tradeoff Summary

Benefits:

- stronger proof that the redeemer and funder are the same principal
- stronger protection for deployments that do not want delegated payment flows

Costs:

- incompatible with many human external wallet flows
- unsuitable when a helper funds the payment directly to the stealth destination
- worse UX for wallets that can send but not sign NOMS messages

## 11. Backlink To Base Spec

See `x402_NanoSession_rev8_Protocol.md`, especially:

- `5. Track Guidance`
- `8. Verification Rules`
- `9. Security Model`

## 12. Standards Reference

- [ORIS-001: Nano Off-chain Message Signing (NOMS)](https://github.com/OpenRai/Standards/blob/main/rfcs/ORIS-001.md)
