import type { ReactNode } from 'react'
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
  }
}

export function AppShell({ topbar, sidebar, content, children, mobileMenuButton }: AppShellProps) {
  const showBackdrop = sidebar.mobileOpen
  const bodyClasses = ['app-body']
  if (sidebar.collapsed) {
    bodyClasses.push('sidebar-collapsed')
  }

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
        {mobileMenuButton && !sidebar.mobileOpen ? (
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
