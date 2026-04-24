import type { ReactNode } from 'react'
import type { AppTheme } from '../hooks/useTheme'

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
  theme?: AppTheme
  onCycleTheme?: () => void
  onOpenPreferences?: () => void
}

const THEME_ICON: Record<AppTheme, string> = {
  dark: '🌙',
  old: '🏛️',
}

const THEME_NEXT_LABEL: Record<AppTheme, string> = {
  dark: 'Alternar para modo legado',
  old: 'Alternar para modo escuro',
}

export function Topbar({ title, subtitle, actions, mobileSubtitle, userInfo, theme, onCycleTheme, onOpenPreferences }: TopbarProps) {
  const hasHeading = Boolean(title || subtitle)
  const hasActions = actions != null
  const currentTheme = theme ?? 'dark'

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
        <div className="topbar-end-cluster">
          {hasActions ? <div className="top-actions">{actions}</div> : null}
          {onOpenPreferences ? (
            <button
              type="button"
              className="theme-toggle-btn topbar-prefs-btn"
              onClick={onOpenPreferences}
              aria-label="Abrir Preferências"
              title="Preferências"
            >
              ⚙️
            </button>
          ) : null}
          {onCycleTheme ? (
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={onCycleTheme}
              aria-label={THEME_NEXT_LABEL[currentTheme]}
              title={THEME_NEXT_LABEL[currentTheme]}
            >
              {THEME_ICON[currentTheme]}
            </button>
          ) : null}
        </div>
        {mobileSubtitle ? (
          <div className="topbar-mobile-subtitle" aria-live="polite">
            {mobileSubtitle}
          </div>
        ) : null}
      </div>
    </header>
  )
}
