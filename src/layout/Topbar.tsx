import type { ReactNode } from 'react'

export interface TopbarUserInfo {
  name: string
  role: string
}

export interface TopbarProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  mobileSubtitle?: string
  userInfo?: TopbarUserInfo
}

export function Topbar({ title, subtitle, actions, mobileSubtitle, userInfo }: TopbarProps) {
  const hasHeading = Boolean(title || subtitle)
  const hasActions = actions != null

  return (
    <header className="topbar app-topbar">
      <div className="topbar-inner">
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
        {userInfo ? (
          <div className="topbar-user-info" aria-label={`Usuário: ${userInfo.name}, ${userInfo.role}`}>
            <span className="topbar-user-name">{userInfo.name}</span>
            <span className="topbar-user-sep" aria-hidden="true">—</span>
            <span className="topbar-user-role">{userInfo.role}</span>
          </div>
        ) : null}
        {hasActions ? <div className="top-actions">{actions}</div> : null}
        {mobileSubtitle ? (
          <div className="topbar-mobile-subtitle" aria-live="polite">
            {mobileSubtitle}
          </div>
        ) : null}
      </div>
    </header>
  )
}
