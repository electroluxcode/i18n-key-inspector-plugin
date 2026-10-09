import { defineConfig } from 'vite'
import { i18nKeyInspector } from 'i18n-key-inspector'

export default defineConfig({
  plugins: [i18nKeyInspector({ bundler: 'vite' })]
})
