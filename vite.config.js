import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: ['codemirror', '@codemirror/lang-html', '@codemirror/lang-css', '@codemirror/lang-xml', '@codemirror/state', '@codemirror/view', '@codemirror/commands']
        }
      }
    }
  },
  server: {
    port: 5183,
    watch: {
      ignored: ['**/tmp/**', '**/old/**']
    }
  }
})
