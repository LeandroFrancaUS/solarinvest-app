import React from 'react'
import { saveFormDraft } from '../lib/persist/formDraft'

type BoundaryProps = {
  children: React.ReactNode
  /** Optional callback to get a snapshot of the current state before crashing. */
  getSnapshot?: () => unknown
}

type BoundaryState = {
  error: Error | null
  snapshotSaved: boolean
}

export class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, snapshotSaved: false }
  private _mounted = true

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (typeof console !== 'undefined') {
      console.error('Boundary captured error', error, info)
    }

    // Attempt to save a snapshot before the crash renders the error screen.
    // This preserves form state even when a rendering error occurs.
    if (this.props.getSnapshot) {
      try {
        const snapshot = this.props.getSnapshot()
        if (snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0) {
          void saveFormDraft(snapshot).then(() => {
            if (this._mounted) {
              this.setState({ snapshotSaved: true })
            }
            console.info('[Boundary] Emergency snapshot saved to IndexedDB')
          }).catch((e) => {
            console.warn('[Boundary] Failed to save emergency snapshot:', e)
          })
        }
      } catch {
        // Best effort — don't make the crash worse
      }
    }
  }

  componentWillUnmount(): void {
    this._mounted = false
  }

  render(): React.ReactNode {
    const { error, snapshotSaved } = this.state
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
          {snapshotSaved && (
            <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 8 }}>
              ✓ Seu progresso foi salvo automaticamente e será restaurado ao recarregar.
            </p>
          )}
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
