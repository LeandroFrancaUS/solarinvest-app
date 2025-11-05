import type { ReactNode } from 'react'

export interface ContentProps {
  title?: string
  subtitle?: string
  breadcrumbs?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function Content({ title, subtitle, breadcrumbs, actions, children }: ContentProps) {
  return (
    <main className="content-wrap">
      {breadcrumbs ? <div className="breadcrumbs">{breadcrumbs}</div> : null}
      {title || subtitle || actions ? (
        <header className="content-header">
          <div className="content-heading">
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="content-body">{children}</div>
    </main>
  )
}
