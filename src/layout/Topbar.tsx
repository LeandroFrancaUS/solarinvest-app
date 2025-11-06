import type { ReactNode } from 'react'

export interface TopbarProps {
  onMenuToggle?: () => void
  title?: string
  subtitle?: string
  actions?: ReactNode
  menuButtonLabel?: string
  menuButtonExpanded?: boolean
}

export function Topbar({
  onMenuToggle,
  title = 'SolarInvest App',
  subtitle,
  actions,
  menuButtonLabel,
  menuButtonExpanded,
}: TopbarProps) {
  const hasActions = actions != null

  return (
    <header className="topbar app-topbar">
      <div className="container topbar-inner">
        <div className="topbar-left">
          {onMenuToggle ? (
            <button
              type="button"
              className="menu-toggle"
              onClick={onMenuToggle}
              aria-label={menuButtonLabel ?? 'Alternar menu de navegação'}
              aria-expanded={typeof menuButtonExpanded === 'boolean' ? menuButtonExpanded : undefined}
            >
              <span className="menu-toggle-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          ) : null}
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
