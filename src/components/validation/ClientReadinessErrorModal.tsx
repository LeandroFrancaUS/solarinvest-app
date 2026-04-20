import { useEffect, useId } from 'react'
import type { ValidationIssue } from '../../lib/validation/clientReadiness'

type ClientReadinessErrorModalProps = {
  /** Title shown in the modal header */
  title: string
  /** Introductory paragraph shown above the issue list */
  intro: string
  /** List of validation issues to display */
  issues: ValidationIssue[]
  onClose: () => void
}

/**
 * Modal that displays a list of client-readiness validation errors.
 *
 * Used as the gate before:
 *   • "Negócio Fechado" (portfolio export)
 *   • "Gerar contratos"
 */
export function ClientReadinessErrorModal({
  title,
  intro,
  issues,
  onClose,
}: ClientReadinessErrorModalProps) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="modal save-changes-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="modal-backdrop modal-backdrop--opaque" onClick={onClose} />
      <div className="modal-content save-changes-modal__content">
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="modal-body" id={descId}>
          <p>{intro}</p>
          <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
            {issues.map((issue) => (
              <li key={issue.field} style={{ marginBottom: '0.25rem' }}>
                <strong>{issue.label}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
