# AGENTS.md for `site/`

## 🌐 Documentation Website

This directory contains the VitePress project for the x402.NanoSession documentation.

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

### 🐛 Known Issues / Debugging

*   **404 Errors**: If the site returns 404s, it usually means `prepare-rev.js` failed to generate files OR the `config.mts` paths don't match the generated filenames.
*   **Dead Links**: VitePress build will FAIL if there are broken internal links.
    *   *Fix*: Ensure `prepare-rev.js` correctly rewrites links from the source Markdown to the new web paths.
