# AGENTS.md

## Project: x402.NanoSession
**Goal**: Create a standard for High-Frequency M2M Nano Payments using HTTP 402.

### 📂 Directory Structure

*   **/docs**: **Source of Truth**. Contains the Markdown specifications for the protocol and its extensions.
    *   `x402_NanoSession_revX_Protocol.md`: The core specification.
    *   `x402_NanoSession_revX_Extension_...md`: Optional extensions.
*   **/site**: **Public Documentation Website**.
    *   Built with VitePress.
    *   Generates a static site from `/docs`.
    *   See `site/AGENTS.md` for build details.

### 🤖 Core Workflows

1.  **Refining the Spec**:
    *   Edit files in `/docs`.
    *   Always respect the `_revX_` naming convention.
    *   Do **NOT** edit files in `/site/docs` directly; they are overwritten by the build script.

2.  **Building the Site**:
    *   `cd site`
    *   `SPEC_REV=rev3 npm run docs:build`
    *   `npm run docs:preview`

### ⚠️ Critical Context
*   **Nano**: A feeless, instant cryptocurrency.
*   **HTTP 402**: The status code used for payment required.
*   **Rev3**: The current active revision.
