import React from 'react'

type BoundaryProps = {
  children: React.ReactNode
}

type BoundaryState = {
  error: Error | null
}

export class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (typeof console !== 'undefined') {
      console.error('Boundary captured error', error, info)
    }
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (error) {
      return (
        <section
          role="alert"
          style={{
            padding: '48px 24px',
            maxWidth: 480,
            margin: '0 auto',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <strong style={{ fontSize: 18, display: 'block', marginBottom: 8 }}>
            Falhou ao renderizar.
          </strong>
          <p style={{ color: '#555', marginBottom: 8 }}>
            Tente recarregar a página ou entrar em contato com o suporte.
          </p>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
            Se você tem extensões de carteira cripto instaladas (ex: Yoroi, MetaMask, Nami), tente
            desativá-las ou usar uma janela anônima e recarregar.
          </p>
          {typeof window !== 'undefined' && (
            <button
              type="button"
              onClick={() => { window.location.reload() }}
              style={{
                padding: '10px 28px',
                background: '#f59e0b',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recarregar
            </button>
          )}
          {import.meta.env.DEV && (
            <pre
              style={{
                marginTop: 24,
                padding: 12,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 6,
                fontSize: 11,
                textAlign: 'left',
                overflow: 'auto',
                color: '#b91c1c',
              }}
            >
              {error.message}
              {'\n'}
              {error.stack ?? '(no stack)'}
            </pre>
          )}
        </section>
      )
    }
    return this.props.children
  }
}
