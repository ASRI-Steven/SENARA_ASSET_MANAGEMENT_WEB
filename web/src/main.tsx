import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App.tsx'

// Register the service worker (no-op in dev; devOptions disabled in vite.config).
registerSW({ immediate: true })

// Self-heal after a redeploy: when a lazily-imported chunk 404s because the
// build hash changed under an open tab (Vite emits `vite:preloadError`), reload
// once to fetch the fresh index + chunks instead of surfacing a scary
// "Failed to fetch dynamically imported module" error. Guard against loops.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('reloadedForChunk')) {
    sessionStorage.setItem('reloadedForChunk', '1')
    window.location.reload()
  }
})
// Clear the guard once a navigation succeeds so a later real redeploy can heal again.
window.addEventListener('load', () => sessionStorage.removeItem('reloadedForChunk'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
