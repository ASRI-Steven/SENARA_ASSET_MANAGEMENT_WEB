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
      // autoUpdate (not 'prompt'): the app calls registerSW({immediate:true})
      // but has NO update-prompt UI to post SKIP_WAITING, so a 'prompt' SW would
      // install and hang in "waiting" forever — the browser keeps serving the old
      // precached bundle (this was the recurring "stale content / failed to fetch
      // dynamically imported module" problem). autoUpdate + skipWaiting/clientsClaim
      // in sw.ts makes a new build take over on the next reload.
      registerType: 'autoUpdate',
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
      // Foto asset upload/preview microservice — di-proxy biar browser call
      // same-origin + header `apiclient` di-inject server-side (nggak ke-bundle).
      '/upload-svc': {
        target: process.env.UPLOAD_TARGET ?? 'http://10.10.1.3:1323',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/upload-svc/, ''),
        headers: { apiclient: process.env.UPLOAD_APICLIENT ?? 'RUrqnUUiRhReyqr1fJj795VAtIlDOEQH' },
      },
    },
  },
  preview: {
    proxy: {
      '/api': process.env.BFF_PROXY_TARGET ?? 'http://localhost:8090',
      '/upload-svc': {
        target: process.env.UPLOAD_TARGET ?? 'http://10.10.1.3:1323',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/upload-svc/, ''),
        headers: { apiclient: process.env.UPLOAD_APICLIENT ?? 'RUrqnUUiRhReyqr1fJj795VAtIlDOEQH' },
      },
    },
  },
})
