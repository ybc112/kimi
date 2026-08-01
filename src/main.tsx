import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Recover automatically when a static host briefly serves an older HTML/chunk pair.
// Hashed assets are immutable, so one cache-busting reload is safe and prevents a blank SPA.
const chunkReloadKey = 'kimi-chunk-reload'
const reloadForStaleChunk = (message: string) => {
  if (!/dynamically imported module|Failed to fetch module|Importing a module script failed/i.test(message)) return
  const lastReload = Number(sessionStorage.getItem(chunkReloadKey) || 0)
  if (Date.now() - lastReload < 60_000) return
  sessionStorage.setItem(chunkReloadKey, String(Date.now()))
  const url = new URL(window.location.href)
  url.searchParams.set('_v', String(Date.now()))
  window.location.replace(url.toString())
}
window.addEventListener('error', (event) => reloadForStaleChunk(event.message || ''))
window.addEventListener('unhandledrejection', (event) => reloadForStaleChunk(String(event.reason?.message || event.reason || '')))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
