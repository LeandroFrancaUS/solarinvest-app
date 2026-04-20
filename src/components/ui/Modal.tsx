/**
 * Modal — Componente de modal padronizado do Design System SolarInvest
 */

import React, { useEffect, useRef } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnBackdrop?: boolean
  className?: string
}

const sizeStyles: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className = '',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdrop) return
    // Close only when the click lands on the dialog backdrop (not on its content)
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={[
        'w-full rounded-xl border border-ds-border bg-ds-surface shadow-lg',
        'p-0 text-ds-text-primary backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        'open:flex open:flex-col',
        sizeStyles[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-modal="true"
    >
      {/* Header */}
      {title ? (
        <div className="flex items-center justify-between border-b border-ds-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-ds-text-primary">{title}</h2>
            {description ? (
              <p className="text-xs text-ds-text-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ds-text-muted transition-colors hover:bg-white/10 hover:text-ds-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">{children}</div>

      {/* Footer */}
      {footer ? (
        <div className="flex items-center justify-end gap-3 border-t border-ds-border px-5 py-4">
          {footer}
        </div>
      ) : null}
    </dialog>
  )
}
