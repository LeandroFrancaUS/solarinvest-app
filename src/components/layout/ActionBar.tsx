import React from 'react'
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
  return (
    <section className="proposal-action-bar" aria-label="Ações da proposta">
      <div className="proposal-action-bar__inner">
        <button
          type="button"
          className="proposal-action-btn proposal-action-btn--primary"
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
          className="proposal-action-btn proposal-action-btn--secondary"
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
          className="proposal-action-btn proposal-action-btn--secondary"
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
          className="proposal-action-btn proposal-action-btn--secondary"
          onClick={onIncludeImages}
          disabled={isDisabled}
          aria-label="Incluir imagens"
          title="Incluir imagens"
        >
          <ImagePlus size={18} aria-hidden="true" />
          <span className="proposal-action-btn__label">Incluir imagens</span>
        </button>
      </div>
    </section>
  )
}

export default ActionBar
