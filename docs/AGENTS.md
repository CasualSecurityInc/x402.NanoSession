# AGENTS.md for `docs/`

## 📖 Specifications

This directory contains the **Canonical Source of Truth** for the x402.NanoSession protocol. All changes to the protocol must happen here.

### 📝 Naming Convention

Files follow a strict pattern to support multiple revisions and automated site generation:

`x402_NanoSession_rev<X>_<Role>.md`

*   **revX**: Revision number (e.g., `rev3`). Allows historical versions to coexist.
*   **Role**:
    *   `Protocol`: The core specification. There is only ONE per revision.
    *   `Extension_<Name>`: Optional extension documents.

### 🔗 Relationships

*   **Protocol**: Defines the base layer (Single Address, HTTP headers).
*   **Extensions**: Modify or extend the base layer (e.g., Sharded Pools, Privacy).
    *   Extensions MUST backlink to the Protocol.
    *   Extensions inherit the base layer unless explicitly overridden.

### 🛠️ Workflow

1.  **Drafting**: Start a new file with `Status: Draft`.
2.  **Review**: Once reviewed, update to `Status: Proposed` or `Accepted`.
3.  **Site Gen**: The build script in `../site/scripts/prepare-rev.js` automatically picks up files matching the `SPEC_REV` environment variable.

### 🔐 Security Review Requirements

**All protocol changes MUST undergo security review.**

The Rev5 specification introduced a formal Security Model after discovering the **Receipt-Stealing Attack** — a vulnerability where attackers could steal payment proofs from the public blockchain.

#### Mandatory Review Checklist

Before finalizing any protocol change:

1. **Read §1 Security Model** in `x402_NanoSession_rev5_Protocol.md`
2. **Review the Session Binding Invariant** — sessions are security primitives
3. **Check attack vectors**:
   - Receipt theft (hash from different session)
   - Replay attacks (same hash reused)
   - Session spoofing (forged/guessed sessionId)
   - Timing attacks (race conditions)
4. **Verify attack test coverage** exists in `test/integration/`

#### Why This Matters

NanoSession handles real financial transactions. A security flaw means:
- Users lose money
- Attackers get free access
- Protocol trust is destroyed

**When in doubt, add more session binding, not less.**
