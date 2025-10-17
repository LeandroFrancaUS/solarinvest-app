import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensityMode } from './constants/ui'
import './styles.css'

const storedDensity =
  typeof window !== 'undefined' ? window.localStorage.getItem(DENSITY_STORAGE_KEY) : null

const initialDensity = storedDensity && isDensityMode(storedDensity) ? storedDensity : DEFAULT_DENSITY

if (typeof document !== 'undefined') {
  document.documentElement.dataset.density = initialDensity
}
type BoundaryProps = {
  children: React.ReactNode
}

type BoundaryState = {
  error: Error | null
}

class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (typeof console !== 'undefined') {
      console.error('Boundary captured error', error, info)
    }
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (error) {
      return <pre style={{ padding: 12 }}>{String(error)}</pre>
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>,
)
