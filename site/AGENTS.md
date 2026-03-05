# AGENTS.md for `site/`

## 🌐 Documentation Website

This directory contains the VitePress project for the x402.NanoSession documentation.

---

## 🚀 Deployment Architecture

**Two separate deployment targets:**

| Component | Platform | URL | Workflow |
|-----------|----------|-----|----------|
| **Static Docs** | GitHub Pages | `https://csi.ninzin.net/x402.NanoSession/` | `.github/workflows/deploy.yml` |
| **Demo Server(s)** | fly.io | Separate subdomain(s) | Manual / `pnpm deploy:fly:*` |

**Important:** The Protected Resource demo server(s) deploy to an **external hosting platform (fly.io)** and must be treated separately from the docs site. The static docs are served from GitHub Pages (CasualSecurityInc org) behind a CloudFlare proxy.

---

### 🏗️ Build System (`scripts/prepare-rev.js`)

We do **not** edit markdown files in `site/docs/` directly. Instead, we generate them from `../docs/` at build time.

**The Script Logic:**
1.  Reads `SPEC_REV` env var (default: `rev3`).
2.  **Cleans**: Deletes `site/docs/`.
3.  **Copies & Renames**:
    *   `../docs/..._Protocol.md` -> `site/docs/index.md`
    *   `../docs/..._Extension_Name.md` -> `site/docs/extensions/name.md`
4.  **Injects Navigation**:
    *   Adds "Tree View" to Protocol.
    *   Adds "See Also" links to Protocol.
    *   Adds "Back to Protocol" link to Extensions.

### 🎨 Theme & Config

*   **Config**: `.vitepress/config.mts`
    *   Defines the Sidebar and Nav menu.
    *   **CRITICAL**: The paths in `config.mts` MUST match the generated paths from `prepare-rev.js`.
*   **Theme**: `.vitepress/theme/`
    *   Custom CSS (`custom.css`) for "Modern, Serious, Responsive" look.
    *   **Paywall Components**: Contains `NanoPaywall.vue` and composables (`usePaymentStatus.ts`, `useXnapSnap.ts`) for the live 402 demo.

### 🚀 Demo Server (Protected Resource Facilitator)

**Location**: `site/protected-resource-demo-server/`

The demo server is a live backend Node.js server that acts as an x402 Facilitator. It runs concurrently with VitePress in dev mode via `pnpm run dev:demo`.

**Deployment**: Fly.io (separate from docs site)
- Mainnet: `pnpm deploy:fly:mainnet`
- Testnet: `pnpm deploy:fly:testnet`

**Core Mechanics:**
1. **Requirements Generation**: `routes/protected.ts` receives client requests, generates a cryptographically secure `sessionId` + `tag` via `@nanosession/facilitator`, and returns the `HTTP 402 Payment Required` payload.
2. **WebSocket Bridge**: `services/nano-websocket.ts` listens to the public Nano network (`wss://ws.nano.to`) for incoming SEND or RECEIVE blocks hitting the `NANO_SERVER_ADDRESS`, extracting the dust tag.
3. **Server-Sent Events (SSE)**: `routes/status.ts` pipes verified block hashes back to the Vue `<NanoPaywall>` client in real-time, instantly unlocking the UI.

**Configuration (`.env`):**

To run the server, `site/.env` MUST be configured (see `site/.env.example`):
- `NANO_RPC_URL` (for REST verification)
- `NANO_SERVER_ADDRESS` (The address the Facilitator watches for dust payments)

### 🖥️ Local Development with tmux

**Always use tmux to run the demo servers** for persistent, detachable sessions.

```bash
# Create a new tmux session named "demo" and start servers
tmux new -s demo
cd /Users/conny/Developer/CasualSecurityInc/x402.NanoSession/site
pnpm dev:demo

# Detach: Ctrl+B then D
# Reattach: tmux attach -t demo
# Kill session: tmux kill-session -t demo
```

**Commands:**
| Command | Purpose |
|---------|---------|
| `pnpm dev:demo` | All: site watcher + VitePress (5173) + demo servers (3001/3002) |
| `pnpm site:dev` | Site only: source watcher + VitePress (5173) |
| `pnpm site:build` | Build static site (set `SPEC_REV=rev5`) |
| `pnpm demo:mainnet` | Demo server only: mainnet (3001) |
| `pnpm demo:testnet` | Demo server only: testnet (3002) |

**Note:** `site:dev` watches `../docs/*.md` and `protected.md` for changes and rebuilds automatically.

**Restarting servers in tmux:**
```bash
tmux send-keys -t demo C-c          # Stop current process
tmux send-keys -t demo 'pnpm dev:demo' Enter  # Start servers
```

### 🐛 Known Issues / Debugging

*   **404 Errors**: If the site returns 404s, it usually means `prepare-rev.js` failed to generate files OR the `config.mts` paths don't match the generated filenames.
*   **Dead Links**: VitePress build will FAIL if there are broken internal links.
    *   *Fix*: Ensure `prepare-rev.js` correctly rewrites links from the source Markdown to the new web paths.
*   **EADDRINUSE (Port 3001)**: If `pnpm run dev:demo` fails saying port 3001 is in use, an old `tsx demo-server/index.ts` process is still running. Use `killall -9 node tsx` to free the port.
*   **Wallet Precision Truncation Bug (Nault)**: The Nault consumer wallet currently has a bug where it truncates outgoing fractions to 6 decimal places, destroying the required NanoSession dust tag and causing payments to be ignored by the WebSocket. Test using Natrium, the Xnap plugin, or `scripts/test-payment.ts`.
