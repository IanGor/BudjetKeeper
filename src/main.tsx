import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './lib/theme'
import './styles.css'

// iOS Safari applies :active (instant press feedback) only when a touch listener exists
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
