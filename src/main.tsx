import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Boundary } from './app/Boundary'
import { Providers } from './app/Providers'
import { ensureServerStorageSync } from './app/services/serverStorage'
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensityMode } from './constants/ui'
import './styles.css'
import './styles/anti-overlay.css'
import './styles/anti-overlay-screen.css'

async function bootstrap() {
  await ensureServerStorageSync()

  const storedDensity =
    typeof window !== 'undefined' ? window.localStorage.getItem(DENSITY_STORAGE_KEY) : null

  const initialDensity = storedDensity && isDensityMode(storedDensity) ? storedDensity : DEFAULT_DENSITY

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.density = initialDensity
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Boundary>
        <Providers>
          <App />
        </Providers>
      </Boundary>
    </React.StrictMode>,
  )
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application', error)
})
