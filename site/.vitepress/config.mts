import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT_REDIRECT_URL = 'https://csi.ninzin.net/x402.Nano/'

function redirectHtml(url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3; url=${url}">
  <title>x402.NanoSession has moved to x402.Nano</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 480px;
    }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff; }
    p { font-size: 1rem; line-height: 1.6; color: #a1a1aa; margin-bottom: 1.5rem; }
    a { color: #22d3ee; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .url { font-family: monospace; font-size: 0.875rem; word-break: break-all; }
    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #3f3f46;
      border-top-color: #22d3ee;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 0.5rem;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <h1>x402.NanoSession has moved</h1>
    <p>This documentation has been consolidated into <strong>x402.Nano</strong>. You will be redirected automatically in 3 seconds.</p>
    <p><a href="${url}"><span class="spinner"></span>Redirect now</a></p>
    <p class="url">${url}</p>
  </div>
  <script>window.location.replace("${url}")</script>
</body>
</html>`
}

export default withMermaid(defineConfig({
    title: "x402.NanoSession",
    description: "Feeless, instant machine-to-machine payments via HTTP 402 using Nano cryptocurrency",
    base: '/x402.NanoSession/',
    head: [
        ['meta', { name: 'google-site-verification', content: 'VgY_8BRCQtKfSIeArkhfYHFkP8q5YL9vELKICxFOlmQ' }]
    ],
    srcDir: './gen/docs',
    outDir: './gen/dist',
    cacheDir: './gen/.vitepress/cache',
    cleanUrls: true,
    mermaid: {},
    transformHtml: (_id, _pageData, _context) => {
        return redirectHtml(ROOT_REDIRECT_URL)
    },
    buildEnd: ({ outDir }) => {
        const indexPath = join(outDir, 'index.html')
        const body = readFileSync(indexPath, 'utf8')
        if (!body.includes(ROOT_REDIRECT_URL)) {
            writeFileSync(indexPath, redirectHtml(ROOT_REDIRECT_URL))
        }
    },
    themeConfig: {
        nav: [
            { text: 'Intro', link: '/' },
            { text: 'Protocol', link: '/protocol' },
            { text: 'Demo', link: '/protected' }
        ],

        sidebar: [
            {
                text: 'About',
                items: [
                    { text: 'Intro', link: '/' },
                    { text: 'Protected Demo (legacy)', link: '/protected' }
                ]
            },
            {
                text: 'Specification',
                items: [
                    { text: 'Protocol', link: '/protocol' },
                    { text: 'Track A: nanoTxn', link: '/extensions/track-a-nanotxn' },
                    { text: 'Track B: nanoSignature', link: '/extensions/track-b-nanosignature' }
                ]
            },
            {
                text: 'Live Demos (Rev 8)',
                items: [
                    { text: 'Track A Demo', link: '/demo-track-a' },
                    { text: 'Track B Demo', link: '/demo-track-b' }
                ]
            },
            {
                text: 'Links',
                items: [
                    { text: '↗ GitHub', link: 'https://github.com/CasualSecurityInc/x402.NanoSession' },
                    { text: '↗ x402 Spec', link: 'https://docs.x402.org' },
                    { text: '↗ Nano.org', link: 'https://nano.org' }
                ]
            }
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/CasualSecurityInc/x402.NanoSession' }
        ],

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2026 Casual Security Inc.'
        }
    }
}))
