import type { ReactNode } from 'react'

export interface TopbarProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export function Topbar({
  title = 'SolarInvest App',
  subtitle,
  actions,
}: TopbarProps) {
  const hasActions = actions != null

  return (
    <header className="topbar app-topbar">
      <div className="container topbar-inner">
        <div className="topbar-left">
          <div className="brand">
            <img src="/logo.svg" alt="SolarInvest" />
            <div className="brand-text">
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
        </div>
        {hasActions ? <div className="top-actions">{actions}</div> : null}
      </div>
    </header>
  )
}
