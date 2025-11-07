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
    const shouldLockScroll = Boolean(sidebar.mobileOpen)
    let scrollPosition = 0
    const previousPosition = body.style.position
    const previousTop = body.style.top
    const previousWidth = body.style.width

    if (shouldLockScroll) {
      scrollPosition = typeof window !== 'undefined' ? window.scrollY : 0
      body.style.position = 'fixed'
      body.style.top = `-${scrollPosition}px`
      body.style.width = '100%'
    }

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

      if (shouldLockScroll) {
        body.style.position = previousPosition
        body.style.top = previousTop
        body.style.width = previousWidth
        if (typeof window !== 'undefined') {
          window.scrollTo(0, scrollPosition)
        }
      }
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
