import React, { useRef, useState, useLayoutEffect } from 'react'
import { FileText, Save, PlusCircle, ImagePlus } from 'lucide-react'

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
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [isCompact, setIsCompact] = useState(false)

  // Mutable refs avoid stale-closure issues inside the ResizeObserver callback.
  const compactRef = useRef(false)
  const expandedWidthRef = useRef(0)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const check = () => {
      const available = viewport.clientWidth
      // When expanded, capture the natural content width so we can restore it later.
      if (!compactRef.current) {
        expandedWidthRef.current = track.scrollWidth
      }
      // Switch to compact when buttons would overflow the viewport.
      if (!compactRef.current && track.scrollWidth > available) {
        compactRef.current = true
        setIsCompact(true)
      // Switch back to expanded when enough room has been restored (+ small buffer).
      } else if (compactRef.current && available >= expandedWidthRef.current + 8) {
        compactRef.current = false
        setIsCompact(false)
      }
    }

    const ro = new ResizeObserver(check)
    ro.observe(viewport)
    check() // run once synchronously on mount
    return () => ro.disconnect()
  }, [])

  const btnClass = isCompact
    ? 'proposal-action-btn proposal-action-btn--compact'
    : 'proposal-action-btn'

  return (
    <section className="proposal-action-bar" aria-label="Ações da proposta">
      <div className="proposal-action-bar__inner">
        {/* viewport provides overflow containment; track is the actual flex row */}
        <div className="proposal-action-bar__viewport" ref={viewportRef}>
          <div className="proposal-action-bar__track" ref={trackRef}>
            <button
              type="button"
              className={`${btnClass} proposal-action-btn--primary`}
              onClick={onGenerateProposal}
              disabled={isDisabled || isGenerating}
              aria-label="Gerar proposta"
              title="Gerar proposta"
            >
              <FileText size={18} aria-hidden="true" />
              <span className="proposal-action-btn__label">
                {isGenerating ? 'Gerando…' : 'Gerar proposta'}
              </span>
            </button>

            <button
              type="button"
              className={`${btnClass} proposal-action-btn--secondary`}
              onClick={onSaveProposal}
              disabled={isDisabled || isSaving}
              aria-label="Salvar proposta"
              title="Salvar proposta"
            >
              <Save size={18} aria-hidden="true" />
              <span className="proposal-action-btn__label">
                {isSaving ? 'Salvando…' : 'Salvar proposta'}
              </span>
            </button>

            <button
              type="button"
              className={`${btnClass} proposal-action-btn--secondary`}
              onClick={onNewProposal}
              disabled={isDisabled}
              aria-label="Nova proposta"
              title="Nova proposta"
            >
              <PlusCircle size={18} aria-hidden="true" />
              <span className="proposal-action-btn__label">Nova proposta</span>
            </button>

            <button
              type="button"
              className={`${btnClass} proposal-action-btn--secondary`}
              onClick={onIncludeImages}
              disabled={isDisabled}
              aria-label="Incluir imagens"
              title="Incluir imagens"
            >
              <ImagePlus size={18} aria-hidden="true" />
              <span className="proposal-action-btn__label">Incluir imagens</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ActionBar
