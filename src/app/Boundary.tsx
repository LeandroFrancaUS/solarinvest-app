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
        <section role="alert" style={{ padding: 12 }}>
          <strong>Falhou ao renderizar.</strong>
          <p>Tente recarregar a página ou entrar em contato com o suporte.</p>
        </section>
      )
    }
    return this.props.children
  }
}
