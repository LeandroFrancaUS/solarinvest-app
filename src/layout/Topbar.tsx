import type { ReactNode } from 'react'

export interface TopbarProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const hasHeading = Boolean(title || subtitle)
  const hasActions = actions != null

  if (!hasHeading && !hasActions) {
    return <header className="topbar app-topbar" aria-hidden="true" />
  }

  return (
    <header className="topbar app-topbar">
      <div className="container topbar-inner">
        <div className="topbar-heading">
          {title ? <h1>{title}</h1> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {hasActions ? <div className="top-actions">{actions}</div> : null}
      </div>
    </header>
  )
}
