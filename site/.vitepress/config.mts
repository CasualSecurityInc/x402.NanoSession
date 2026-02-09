import { defineConfig } from 'vitepress'

export default defineConfig({
    title: "x402.NanoSession",
    description: "Protocol for High-Frequency M2M Nano Payments",
    srcDir: './docs', // Point to the generated docs folder
    cleanUrls: true,
    themeConfig: {
        nav: [
            { text: 'Protocol', link: '/' },
            { text: 'Extension A: Pools', link: '/extensions/extension-a-pools' },
            { text: 'Extension B: Stochastic', link: '/extensions/extension-b-stochastic' }
        ],

        sidebar: [
            {
                text: 'Specification',
                items: [
                    { text: 'Protocol Definition', link: '/' },
                    { text: 'Extension A: Sharded Pools', link: '/extensions/extension-a-pools' },
                    { text: 'Extension B: Stochastic Rotation', link: '/extensions/extension-b-stochastic' }
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
})
