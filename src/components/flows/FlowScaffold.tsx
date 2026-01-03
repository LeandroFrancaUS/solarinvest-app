import type { ReactNode } from 'react'
import './flows.css'

interface FlowScaffoldProps {
  title: string
  subtitle?: string
  breadcrumbs?: string[]
  actions?: ReactNode
  sidebar?: ReactNode
  children: ReactNode
}

export function FlowScaffold({ title, subtitle, breadcrumbs, actions, sidebar, children }: FlowScaffoldProps) {
  return (
    <div className="flow-scaffold">
      <header className="flow-header">
        <div className="flow-titles">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <div className="flow-breadcrumbs">{breadcrumbs.join(' / ')}</div>
          ) : null}
          <div className="flow-heading">
            <h1>{title}</h1>
            {subtitle ? <p className="flow-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flow-actions">{actions}</div> : null}
      </header>

      <div className="flow-grid">
        <main className="flow-main">{children}</main>
        <aside className="flow-sidebar">{sidebar}</aside>
      </div>
    </div>
  )
}
