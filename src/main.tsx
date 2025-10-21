import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Boundary } from './app/Boundary'
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensityMode } from './constants/ui'
import './styles.css'

const storedDensity =
  typeof window !== 'undefined' ? window.localStorage.getItem(DENSITY_STORAGE_KEY) : null

const initialDensity = storedDensity && isDensityMode(storedDensity) ? storedDensity : DEFAULT_DENSITY

if (typeof document !== 'undefined') {
  document.documentElement.dataset.density = initialDensity
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>,
)
