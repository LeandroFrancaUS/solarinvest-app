import React, { useLayoutEffect, useRef, useState } from 'react'
import { FileText, Save, RefreshCw, ImagePlus } from 'lucide-react'

type ActionBarProps = {
  onGenerateProposal: () => void
  onSaveProposal: () => void
  onNewProposal: () => void
  onIncludeImages: () => void
  isGenerating?: boolean
  isSaving?: boolean
  isDisabled?: boolean
}

export function ActionBar({
  onGenerateProposal,
  onSaveProposal,
  onNewProposal,
  onIncludeImages,
  isGenerating = false,
  isSaving = false,
  isDisabled = false,
}: ActionBarProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const [isCompact, setIsCompact] = useState(false)

  useLayoutEffect(() => {
    const viewportEl = viewportRef.current
    const measureEl = measureRef.current
    if (!viewportEl || !measureEl) return

    const recalc = () => {
      const available = viewportEl.clientWidth
      const required = measureEl.scrollWidth + 8
      setIsCompact(required > available)
    }

    recalc()
    const observer = new ResizeObserver(() => recalc())
    observer.observe(viewportEl)
    observer.observe(measureEl)
    window.addEventListener('resize', recalc)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recalc)
    }
  }, [])

  const modeClass = isCompact ? 'is-compact' : 'is-expanded'

  return (
    <section className="proposal-action-bar" aria-label="Ações da proposta">
      <div className="proposal-action-bar__inner">
        <div className={`actions-shell ${modeClass}`}>
          <div ref={viewportRef} className="actions-viewport">
            <div className="actions-track">
              <button
                type="button"
                className={`proposal-action-btn action-button proposal-action-btn--primary ${modeClass}`}
                onClick={onGenerateProposal}
                disabled={isDisabled || isGenerating}
                aria-label="Gerar proposta"
                title="Gerar proposta"
              >
                <span className="action-button__content">
                  <FileText className="action-button__icon" />
                  <span className="proposal-action-btn__label action-button__label">Gerar proposta</span>
                </span>
              </button>

              <button
                type="button"
                className={`proposal-action-btn action-button proposal-action-btn--secondary ${modeClass}`}
                onClick={onSaveProposal}
                disabled={isDisabled || isSaving}
                aria-label="Salvar proposta"
                title="Salvar proposta"
              >
                <span className="action-button__content">
                  <Save className="action-button__icon" />
                  <span className="proposal-action-btn__label action-button__label">Salvar proposta</span>
                </span>
              </button>

              <button
                type="button"
                className={`proposal-action-btn action-button proposal-action-btn--secondary ${modeClass}`}
                onClick={onNewProposal}
                disabled={isDisabled}
                aria-label="Nova proposta"
                title="Nova proposta"
              >
                <span className="action-button__content">
                  <RefreshCw className="action-button__icon" />
                  <span className="proposal-action-btn__label action-button__label">Nova proposta</span>
                </span>
              </button>

              <button
                type="button"
                className={`proposal-action-btn action-button proposal-action-btn--secondary ${modeClass}`}
                onClick={onIncludeImages}
                disabled={isDisabled}
                aria-label="Incluir imagens"
                title="Incluir imagens"
              >
                <span className="action-button__content">
                  <ImagePlus className="action-button__icon" />
                  <span className="proposal-action-btn__label action-button__label">Incluir imagens</span>
                </span>
              </button>
            </div>

            <div ref={measureRef} className="actions-track actions-track--measure" aria-hidden="true">
              <span className="proposal-action-btn action-button proposal-action-btn--primary is-expanded">Gerar proposta</span>
              <span className="proposal-action-btn action-button proposal-action-btn--secondary is-expanded">Salvar proposta</span>
              <span className="proposal-action-btn action-button proposal-action-btn--secondary is-expanded">Nova proposta</span>
              <span className="proposal-action-btn action-button proposal-action-btn--secondary is-expanded">Incluir imagens</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ActionBar
