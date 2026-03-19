import React from 'react'

type BoundaryProps = {
  children: React.ReactNode
}

type BoundaryState = {
  error: Error | null
}

/** Context snapshot captured at error time for diagnostics. */
interface ErrorContext {
  pathname: string
  isOAuthCallback: boolean
  timestamp: string
}

function captureErrorContext(): ErrorContext {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : 'unknown'
  const isOAuthCallback = pathname.includes('/handler/oauth-callback')
  return {
    pathname,
    isOAuthCallback,
    timestamp: new Date().toISOString(),
  }
}

export class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }
  private errorContext: ErrorContext | null = null

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.errorContext = captureErrorContext()

    // Structured diagnostic log with namespace prefix so it's easy to filter
    // from external noise (Google, Vercel feedback, etc.)
    console.error('[boundary] captured error', {
      message: error.message,
      name: error.name,
      pathname: this.errorContext.pathname,
      isOAuthCallback: this.errorContext.isOAuthCallback,
      timestamp: this.errorContext.timestamp,
      componentStack: info.componentStack,
    })
  }

  private handleReset = () => {
    this.setState({ error: null })
    this.errorContext = null
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (error) {
      const ctx = this.errorContext
      const isCallback = ctx?.isOAuthCallback ?? false

      return (
        <section role="alert" style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480, margin: '40px auto' }}>
          <strong style={{ fontSize: 16 }}>Falhou ao renderizar.</strong>
          <p style={{ marginTop: 8, color: '#555' }}>
            {isCallback
              ? 'Ocorreu um erro durante a autenticação. Por favor, tente fazer login novamente.'
              : 'Tente recarregar a página ou entrar em contato com o suporte.'}
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { window.location.reload() }}
              style={{ padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
            >
              Recarregar página
            </button>
            {!isCallback && (
              <button
                type="button"
                onClick={this.handleReset}
                style={{ padding: '8px 16px', background: 'transparent', color: '#555', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
              >
                Tentar recuperar
              </button>
            )}
          </div>
          {import.meta.env.DEV && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: '#888' }}>Detalhes técnicos</summary>
              <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 8, color: '#c00', background: '#fef2f2', padding: 12, borderRadius: 4 }}>
                {error.message}
                {'\n\n'}
                {error.stack}
              </pre>
            </details>
          )}
        </section>
      )
    }
    return this.props.children
  }
}
