Decisions:
- Use GitHub Actions with actions/setup-node and actions/deploy-pages for deployment to site/.vitepress/dist.
- Add base: '/x402.NanoSession/' to site/.vitepress/config.mts to support GitHub Pages subdirectory.
- SPEC_REV defaults to rev3 but can be overridden by workflow environment configuration if needed.
