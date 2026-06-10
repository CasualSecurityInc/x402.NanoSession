> [!CAUTION]
> x402.NanoSession development has ceased in favor of the similarly named **x402.Nano** specification. This documentation is left as-is for historical reference but bears no authority. All further work happens in the new repository under the new name: [x402.Nano](https://github.com/CasualSecurityInc/x402.Nano).

# @nanosession/core

Shared types, constants, builders, and utilities for the NanoSession x402 protocol.

## Installation

```bash
pnpm add @nanosession/core
```

## Usage

```typescript
import { SCHEME, NETWORK, createPaymentRequirements } from '@nanosession/core';
import type { PaymentRequirements, PaymentPayload } from '@nanosession/core';

const requirements = createPaymentRequirements({
  payTo: 'nano_1abc...',
  amountRaw: '1000000000000000000000000000',
  description: 'Access to protected resource',
});
```

## What's Included

- **Constants**: `SCHEME`, `NETWORK`, `ASSET`, `VERSION`, `TAG_MODULUS`, `TAG_MULTIPLIER`
- **Types**: `PaymentRequirements`, `PaymentPayload`, `NanoSessionExtra`, `NanoSignatureExtra`
- **Builders**: `createPaymentRequirements()`, `createPaymentPayload()`, `createPaymentRequired()`
- **Utilities**: `calculateTaggedAmount()`, `deriveAddressFromSeed()`, `assertValidRawAmount()`
- **Extensions**: `payment-identifier` helpers (see x402 Extensions below)

### x402 Extensions

The `payment-identifier` extension allows servers to attach a stable payment ID to a payment requirements object, enabling idempotent payment tracking across requests.

```typescript
import { declarePaymentIdentifierExtension } from '@nanosession/core';

const ext = declarePaymentIdentifierExtension({ required: true });
```

## Documentation

[Full protocol specification and guides](https://csi.ninzin.net/x402.NanoSession/)

## License

MIT
