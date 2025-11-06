import type { ReactNode } from 'react'

export interface TopbarProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const hasHeading = Boolean(title || subtitle)
  const hasActions = actions != null

  return (
    <header className="topbar app-topbar">
      <div className="container topbar-inner">
        <div className="topbar-brand">
          <img src="/logo.svg" alt="SolarInvest App" />
          <div className="topbar-brand-text">
            <span className="topbar-brand-title">SolarInvest App</span>
            <span className="topbar-brand-subtitle">Proposta financeira interativa</span>
          </div>
        </div>
        {hasHeading ? (
          <div className="topbar-heading">
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        ) : null}
        {hasActions ? <div className="top-actions">{actions}</div> : null}
      </div>
    </header>
  )
}
