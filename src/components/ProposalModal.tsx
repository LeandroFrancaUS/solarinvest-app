import React, { useId } from 'react'

type ProposalModalProps = {
  onClose: () => void
  children: React.ReactNode
}

const ProposalModal: React.FC<ProposalModalProps> = ({ onClose, children }) => {
  const titleId = useId()

  return (
    <div className="modal proposal-preview-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-backdrop modal-backdrop--opaque" onClick={onClose} />
      <div className="modal-content proposal-preview-modal__content">
        <div className="modal-header proposal-preview-modal__header">
          <h3 id={titleId}>Proposta SolarInvest</h3>
          <button type="button" className="ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="modal-body proposal-preview-modal__body">{children}</div>
      </div>
    </div>
  )
}

export default ProposalModal
