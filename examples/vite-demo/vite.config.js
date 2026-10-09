import { defineConfig } from 'vite'
import { i18nKeyInspector } from 'i18n-key-inspector-plugin'

export default defineConfig({
  plugins: [i18nKeyInspector({ bundler: 'vite' })]
})
