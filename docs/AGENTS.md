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
