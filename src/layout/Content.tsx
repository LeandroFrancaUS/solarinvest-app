import { type DragEvent, type ReactNode, useCallback } from 'react'

export interface ContentProps {
  title?: string
  subtitle?: string
  breadcrumbs?: ReactNode
  actions?: ReactNode
  children: ReactNode
  onInteractOutsideSidebar?: () => void
  pageIndicator?: string
  onDrop?: (e: DragEvent<HTMLElement>) => void
  onDragOver?: (e: DragEvent<HTMLElement>) => void
  onDragEnter?: (e: DragEvent<HTMLElement>) => void
  onDragLeave?: (e: DragEvent<HTMLElement>) => void
  isDragActive?: boolean
}

export function Content({
  title,
  subtitle,
  breadcrumbs,
  actions,
  pageIndicator,
  children,
  onInteractOutsideSidebar,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  isDragActive,
}: ContentProps) {
  const handlePointerDownCapture = useCallback(() => {
    onInteractOutsideSidebar?.()
  }, [onInteractOutsideSidebar])

  return (
    <main
      className={`content-wrap${isDragActive ? ' content-drop-active' : ''}`}
      onPointerDownCapture={onInteractOutsideSidebar ? handlePointerDownCapture : undefined}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
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
      {isDragActive ? (
        <div className="content-drop-overlay" aria-hidden="true">
          <div className="content-drop-overlay__inner">
            <span className="content-drop-overlay__icon">📥</span>
            <span>Solte o arquivo PDF da proposta aqui para importar</span>
          </div>
        </div>
      ) : null}
    </main>
  )
}
