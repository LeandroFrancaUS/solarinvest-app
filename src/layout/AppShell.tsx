import { type ReactNode, useEffect } from 'react'
import { Content, type ContentProps } from './Content'
import { Sidebar, type SidebarProps } from './Sidebar'
import { Topbar, type TopbarProps } from './Topbar'

export interface AppShellProps {
  topbar: TopbarProps
  sidebar: SidebarProps
  content: ContentProps
  children: ReactNode
  mobileMenuButton?: {
    onToggle: () => void
    label?: string
    expanded?: boolean
    userInfo?: { name: string; role: string }
  }
}

export function AppShell({ topbar, sidebar, content, children, mobileMenuButton }: AppShellProps) {
  const showBackdrop = sidebar.mobileOpen
  const bodyClasses = ['app-body']
  if (sidebar.collapsed) {
    bodyClasses.push('sidebar-collapsed')
  }

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const className = 'sidebar-mobile-open'
    const { body, documentElement } = document

    if (sidebar.mobileOpen) {
      body.classList.add(className)
      documentElement.classList.add(className)
    } else {
      body.classList.remove(className)
      documentElement.classList.remove(className)
    }

    return () => {
      body.classList.remove(className)
      documentElement.classList.remove(className)
    }
  }, [sidebar.mobileOpen])

  const contentProps: ContentProps = { ...content }
  if (sidebar.mobileOpen && sidebar.onCloseMobile) {
    const originalDismiss = content.onInteractOutsideSidebar
    contentProps.onInteractOutsideSidebar = () => {
      sidebar.onCloseMobile?.()
      originalDismiss?.()
    }
  }

  return (
    <div className="app-shell">
      <Topbar {...topbar} />
      <div className={bodyClasses.join(' ')}>
        {/* Always rendered (not just when sidebar is closed) so the hamburger→X CSS animation plays.
            Visibility when sidebar is open is guaranteed by z-index: 1300, above sidebar and backdrop. */}
        {mobileMenuButton ? (
          <div className="sidebar-mobile-header">
            <button
              type="button"
              className="sidebar-floating-toggle"
              onClick={mobileMenuButton.onToggle}
              aria-label={mobileMenuButton.label ?? 'Abrir menu de navegação'}
              aria-expanded={mobileMenuButton.expanded}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {showBackdrop ? (
          <button
            type="button"
            className="sidebar-backdrop"
            onClick={sidebar.onCloseMobile}
            aria-label="Fechar menu de navegação"
          />
        ) : null}
        <Sidebar {...sidebar} />
        <Content {...contentProps}>{children}</Content>
      </div>
    </div>
  )
}
