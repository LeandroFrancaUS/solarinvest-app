import React, { useId, useEffect } from 'react'

export type SaveDecisionChoice = 'save' | 'discard'

export type SaveDecisionPromptRequest = {
  title: string
  description: string
  confirmLabel?: string
  discardLabel?: string
}

export type SaveDecisionPromptState = SaveDecisionPromptRequest & {
  resolve: (choice: SaveDecisionChoice) => void
}

type SaveChangesDialogProps = {
  title: string
  description: string
  confirmLabel: string
  discardLabel: string
  onConfirm: () => void
  onDiscard: () => void
}

export function SaveChangesDialog({
  title,
  description,
  confirmLabel,
  discardLabel,
  onConfirm,
  onDiscard,
}: SaveChangesDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDiscard()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDiscard])

  return (
    <div
      className="modal save-changes-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="modal-backdrop modal-backdrop--opaque" onClick={onDiscard} />
      <div className="modal-content save-changes-modal__content">
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="modal-body" id={descriptionId}>
          <p>{description}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onDiscard}>
            {discardLabel}
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
