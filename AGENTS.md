# AGENTS.md

## Project: x402.NanoSession
**Goal**: Create a standard for High-Frequency M2M Nano Payments using HTTP 402.

### 📦 Package Manager: pnpm

This monorepo uses **pnpm** with workspace protocol for local package linking.

**Common Commands:**
```bash
pnpm install          # Install all dependencies
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm build            # Build all packages
pnpm clean            # Remove dist folders
```

**Package-specific commands:**
```bash
pnpm --filter @nanosession/core test    # Run tests for core only
pnpm --filter "./packages/*" build      # Build all library packages
```

**Adding dependencies:**
```bash
pnpm add zod --filter @nanosession/core        # Add to specific package
pnpm add -D vitest -w                           # Add to root workspace
```

**Workspace protocol**: Internal dependencies use `workspace:*` in package.json to link locally.

### 📂 Directory Structure

*   **/packages**: Library packages (`@nanosession/core`, `rpc`, `server`, `client`)
*   **/examples**: Example applications (`server`, `client`)
*   **/docs**: **Source of Truth**. Contains the Markdown specifications for the protocol and its extensions.
    *   `x402_NanoSession_revX_Protocol.md`: The core specification.
    *   `x402_NanoSession_revX_Extension_...md`: Optional extensions.
*   **/site**: **Public Documentation Website**.
    *   Built with VitePress.
    *   Generates a static site from `/docs`.
    *   See `site/AGENTS.md` for build details.

### 🤖 Core Workflows

1.  **Developing Packages**:
    *   Run `pnpm test` from root for watch mode.
    *   Use `pnpm --filter <package> <command>` for package-specific work.
    *   Internal deps use `workspace:*` protocol.

2.  **Refining the Spec**:
    *   Edit files in `/docs`.
    *   Always respect the `_revX_` naming convention.
    *   Do **NOT** edit files in `/site/docs` directly; they are overwritten by the build script.

3.  **Building the Site**:
    *   `cd site`
    *   `SPEC_REV=rev3 pnpm docs:build`
    *   `pnpm docs:preview`

4.  **Deploying the Site**:
    *   Automatic via GitHub Actions on push to `main`.
    *   Workflow: `.github/workflows/deploy.yml`
    *   **Live URL**: https://csi.ninzin.net/x402.NanoSession/
    *   Note: The CasualSecurityInc org has a custom domain (`csi.ninzin.net`), so `cbrunnkvist.github.io` URLs redirect there.

### ⚠️ Critical Context
*   **Nano**: A feeless, instant cryptocurrency.
*   **HTTP 402**: The status code used for payment required.
*   **Rev3**: The current active revision.
*   **pnpm**: Required package manager (enforced via `packageManager` field).
