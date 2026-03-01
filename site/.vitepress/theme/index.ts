import DefaultTheme from 'vitepress/theme'
import NanoPaywall from './components/NanoPaywall.vue'
import './custom.css'

export default {
    ...DefaultTheme,
    enhanceApp({ app }) {
        app.component('NanoPaywall', NanoPaywall)
    }
}
