import { type ReactNode, useCallback } from 'react'

export interface ContentProps {
  title?: string
  subtitle?: string
  breadcrumbs?: ReactNode
  actions?: ReactNode
  children: ReactNode
  onInteractOutsideSidebar?: () => void
  pageIndicator?: string
  className?: string
}

export function Content({
  title,
  subtitle,
  breadcrumbs,
  actions,
  pageIndicator,
  children,
  onInteractOutsideSidebar,
  className,
}: ContentProps) {
  const handlePointerDownCapture = useCallback(() => {
    onInteractOutsideSidebar?.()
  }, [onInteractOutsideSidebar])

  return (
    <main
      className={`content-wrap${className ? ` ${className}` : ""}`}
      onPointerDownCapture={onInteractOutsideSidebar ? handlePointerDownCapture : undefined}
    >
      {pageIndicator ? (
        <div className="page-indicator" role="status" aria-live="polite">
          <span>{pageIndicator}</span>
        </div>
      ) : null}
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
