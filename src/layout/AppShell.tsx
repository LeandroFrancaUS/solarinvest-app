import type { ReactNode } from 'react'
import { Content, type ContentProps } from './Content'
import { Sidebar, type SidebarProps } from './Sidebar'
import { Topbar, type TopbarProps } from './Topbar'

export interface AppShellProps {
  topbar: TopbarProps
  sidebar: SidebarProps
  content: ContentProps
  children: ReactNode
}

export function AppShell({ topbar, sidebar, content, children }: AppShellProps) {
  const showBackdrop = sidebar.mobileOpen

  return (
    <div className="app-shell">
      <Topbar {...topbar} />
      <div className="app-body">
        {showBackdrop ? (
          <button
            type="button"
            className="sidebar-backdrop"
            onClick={sidebar.onCloseMobile}
            aria-label="Fechar menu de navegação"
          />
        ) : null}
        <Sidebar {...sidebar} />
        <Content {...content}>{children}</Content>
      </div>
    </div>
  )
}
