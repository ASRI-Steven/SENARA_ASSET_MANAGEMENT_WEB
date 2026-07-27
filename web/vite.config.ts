import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,ico,png,svg,webmanifest}', 'index.html'],
      },
      // Hand-written public/manifest.webmanifest is the source of truth.
      manifest: false,
      // Keep the SW out of the dev server so it doesn't cache while building UI.
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  // Dev proxy forwards /api/* to the Go BFF on :8090 (8090, not 8080, to avoid
  // colliding with the legacy Vue app's webpack-dev-server on 8080).
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.BFF_PROXY_TARGET ?? 'http://localhost:8090',
    },
  },
  preview: {
    proxy: {
      '/api': process.env.BFF_PROXY_TARGET ?? 'http://localhost:8090',
    },
  },
})
