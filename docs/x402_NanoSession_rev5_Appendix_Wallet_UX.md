---
title: Notes on Raw-Dust UX
---

# Notes on Raw-Dust UX

The NanoSession protocol encodes session identifiers into the least significant digits of payment amounts ("raw dust"). This requires wallets to send the **exact** amount specified in the `nano:` URI. However, human-facing wallet applications have varying levels of support for exact amounts.

::: tip For Developers Only
The x402 specification is designed for **Machine-to-Machine (M2M)** and **User-Agent-to-Machine** transactions. End users are not expected to deal with raw amounts or dust tags directly — client libraries handle this automatically.

**This note exists solely to help developers during manual testing with consumer wallet apps.**
:::

---

## Wallet Compatibility Matrix

| Wallet | Manual Entry | QR Scan (`amount=`) | Compatible |
|--------|--------------|---------------------|------------|
| **Natrium** | 6 decimals max | Full precision (1 raw) | **Yes** |
| **Nautilus** | 6 decimals max | Full precision (1 raw) | **Yes** |
| **Cake Wallet** | 6 decimals max | Truncates to 6 decimals | **No** |
| **Nault** | ~16 decimals | Ignores `amount=` entirely | **No** |

---

## Detailed Observations

### Natrium (Recommended)

- **Manual entry**: Supports up to 6 decimal places (`0.123456`)
- **QR scanning**: Full precision down to 1 raw
- **UX**: Prepends "~" to displayed amount when non-round, indicating approximation visually
- **Verdict**: Fully compatible for QR-based payments

### Nautilus (Recommended)

- **Manual entry**: Supports up to 6 decimal places (`0.123456`)
- **QR scanning**: Full precision down to 1 raw
- **UX**: Same "~" prefix behavior as Natrium
- **Verdict**: Fully compatible for QR-based payments

### Cake Wallet

- **Manual entry**: Supports 6 decimal places
- **QR scanning**: **Truncates** amount to 6 decimal places
- **Impact**: Dust tag is destroyed during scanning
- **Verdict**: Not compatible — payment will not be recognized

### Nault

- **Manual entry**: Supports approximately 16 decimal places
- **QR scanning**: **Ignores** the `amount=` parameter entirely
- **Impact**: User must manually enter the exact amount (impractical for dust tags)
- **Verdict**: Not compatible for QR-based payments

---

## Recommendations for Human Users

1. **Use Natrium or Nautilus** — Scan the QR code; exact amount is preserved
2. **Avoid Cake Wallet and Nault** — Dust tags will be lost or ignored
3. **For developers** — Integrate x402 client libraries for programmatic payments

---

## Future Considerations: Left-Shift Strategy

A potential mitigation for 6-decimal truncation is to "left-shift" the dust tag — multiplying it by a power of 10 so significant digits appear within the first 6 decimal places.

**Trade-offs:**
- Would improve compatibility with truncating wallets
- Reduces tag modulus (fewer unique session IDs)
- Weakens session binding security

Current Rev5 implementation prioritizes security (larger tag space) over wallet compatibility. Future protocol revisions may reconsider this balance as the ecosystem evolves.
