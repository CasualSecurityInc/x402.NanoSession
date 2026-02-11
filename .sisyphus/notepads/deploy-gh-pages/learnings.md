Learnings from deploy gh-pages task:
- Created a GitHub Actions workflow to build the VitePress site using SPEC_REV and deploy to GitHub Pages.
- Updated VitePress config to set base URL for GitHub Pages subdirectory.
- Verified required build script exists and uses prepare-rev.js before building.
