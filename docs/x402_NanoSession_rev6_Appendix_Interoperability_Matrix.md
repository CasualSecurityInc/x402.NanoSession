# Appendix: Interoperability Matrix (CAIP & x402 v2)

While the x402 v2 specification and CAIP standards claim to be chain-agnostic, plentiful EVM-centric assumptions—such as stateless, off-chain signatures—inherently conflict with NanoSession’s fundamental DAG-based block-lattice architecture, requiring specific adaptations for full interoperability.

## Compatibility Matrix

| Interoperability Area | Current NanoSession | Required Standard Alignment |
| :--- | :--- | :--- |
| **[Signatures vs. State](#signatures-vs-state)** | Stateful session IDs to handle Nano's frontier. | Generic x402 agents must support stateful verification protocols. |
| **[CAIP-2: Chain ID](#caip-2-chain-identification)** | `network: "nano:mainnet"` | `network: "nano:1"` |
| **[CAIP-10: Account ID](#caip-10-account-identification)** | `payTo: "nano_39qdd..."` | `payTo: "nano:1:nano_39qdd..."` |
| **[CAIP-19: Asset ID](#caip-19-asset-identification)** | `asset: "XNO"` | `asset: "slip44:165"` |
| **[CAIP-122: SIWx](#caip-122-sign-in-with-x-siwx)** | Per-request payments only. | Requires a formal "Sign-In with Nano" (SIW-N) specification. |

To achieve full interoperability, the following adaptations are required:

## Addressing the Gaps

### Signatures vs. State
Nano’s frontier-based blocks invalidate pre-signed authorization if any other transaction occurs, making EVM-style offline signatures impossible.
- **Change** generic x402v2 client SDKs **to** support stateful schemes (like `scheme: "nano-session"`) instead of exclusively mandating stateless `exact` signatures.

### CAIP-2: Chain Identification
While `nano:mainnet` fits the CAIP syntax, it is not a universally registered namespace identifier.
- **Change** the network identifier from `"nano:mainnet"` **to** a standardized `"nano:1"`.
- **Add** an official namespace registration for Nano to the CAIP-2 registries.

### CAIP-10: Account Identification
Generic x402 clients using strict CAIP-10 regex will fail to parse raw Nano addresses.
- **Change** the destination address from `"nano_abc..."` **to** the CAIP-10 prefixed format `"nano:1:nano_abc..."`.

### CAIP-19: Asset Identification
`"XNO"` is an ISO ticker, whereas CAIP-19 requires assets to be defined relative to their Chain ID.
- **Change** the asset definition from `"XNO"` **to** the Nano native CAIP-19 asset convention `"slip44:165"`.

### CAIP-122: Sign-In With X (SIWx)
x402 v2 heavily utilizes long-lived identity sessions via message signing, which Nano wallets currently cannot natively support.
- **Change** the Nano ecosystem **to** adopt a universal RPC standard for "Sign Arbitrary Message".
- **Add** a formal "Sign-In with Nano" specification to enable recurring session identities.
