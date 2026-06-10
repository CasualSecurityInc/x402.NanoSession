> [!CAUTION]
> x402.NanoSession development has ceased in favor of the similarly named **x402.Nano** specification. This documentation is left as-is for historical reference but bears no authority. All further work happens in the new repository under the new name: [x402.Nano](https://github.com/CasualSecurityInc/x402.Nano).

# x402.NanoSession Architecture Diagrams

These diagrams illustrate the core workflows and logic of the x402.NanoSession (Rev 1) protocol, rendered offline using D2.

## 1. Protocol Sequence Flow

This diagram shows the complete lifecycle of a resource request, from the initial 402 challenge to the asynchronous verification and final lazy settlement.

![Protocol Sequence Flow](img/sequence_flow.svg)

## 2. Sharding & Tagging Logic

This flowchart visualizes how the Server deterministically maps a Session and Request to a specific Nano Address and Amount.

![Sharding & Tagging Logic](img/sharding_logic.svg)

## 3. Client (Purse) State Machine

This diagram details the decision-making process within the Client Agent (Purse).

![Client State Machine](img/purse_state.svg)