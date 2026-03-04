import { defineConfig } from 'vitepress'

export default defineConfig({
    title: "x402.NanoSession",
    description: "Protocol for High-Frequency M2M Nano Payments",
    base: '/x402.NanoSession/',
    head: [
        ['meta', { name: 'google-site-verification', content: 'VgY_8BRCQtKfSIeArkhfYHFkP8q5YL9vELKICxFOlmQ' }]
    ],
    srcDir: './docs', // Point to the generated docs folder
    cleanUrls: true,
    themeConfig: {
        nav: [
            { text: 'Intro', link: '/' },
            { text: 'Protocol', link: '/protocol' },
            { text: 'Extension A: Pools', link: '/extensions/extension-a-pools' },
            { text: 'Extension B: Stochastic', link: '/extensions/extension-b-stochastic' },
            {
                text: 'Appendix', items: [
                    { text: 'Raw-Dust UX', link: '/appendix/wallet-ux' },
                    { text: 'Glossary', link: '/appendix/glossary' }
                ]
            }
        ],

        sidebar: [
            {
                text: 'About',
                items: [
                    { text: 'Intro', link: '/' },
                    { text: 'Protected Demo', link: '/protected' }
                ]
            },
            {
                text: 'Specification',
                items: [
                    { text: 'Protocol Definition', link: '/protocol' },
                    { text: 'Extension A: Sharded Pools', link: '/extensions/extension-a-pools' },
                    { text: 'Extension B: Stochastic Rotation', link: '/extensions/extension-b-stochastic' }
                ]
            },
            {
                text: 'Appendix',
                items: [
                    { text: 'Notes on Raw-Dust UX', link: '/appendix/wallet-ux' },
                    { text: 'Glossary', link: '/appendix/glossary' }
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
})
