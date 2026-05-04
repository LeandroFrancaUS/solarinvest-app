import React, { useId } from 'react'
import { formatWhatsappPhoneNumber } from '../../utils/phoneUtils'

export type PropostaEnvioMetodo = 'whatsapp' | 'whatsapp-business' | 'airdrop' | 'quick-share'

export type PropostaEnvioContato = {
  id: string
  nome: string
  telefone: string
  email?: string | undefined
  origem: 'cliente-atual' | 'cliente-salvo' | 'crm'
}

const PROPOSTA_ENVIO_ORIGEM_LABEL: Record<PropostaEnvioContato['origem'], string> = {
  'cliente-atual': 'Proposta em edição',
  'cliente-salvo': 'Clientes salvos',
  crm: 'CRM',
}

type EnviarPropostaModalProps = {
  contatos: PropostaEnvioContato[]
  selectedContatoId: string | null
  onSelectContato: (id: string) => void
  onEnviar: (metodo: PropostaEnvioMetodo) => void
  onClose: () => void
}

export function EnviarPropostaModal({
  contatos,
  selectedContatoId,
  onSelectContato,
  onEnviar,
  onClose,
}: EnviarPropostaModalProps) {
  const modalTitleId = useId()
  const contactsLegendId = useId()
  const contatoSelecionado = React.useMemo(() => {
    return contatos.find((contato) => contato.id === selectedContatoId) ?? null
  }, [contatos, selectedContatoId])
  const temContatos = contatos.length > 0
  const telefoneValido = React.useMemo(() => {
    if (!contatoSelecionado?.telefone) {
      return false
    }
    return Boolean(formatWhatsappPhoneNumber(contatoSelecionado.telefone))
  }, [contatoSelecionado?.telefone])

  const disabledMessage = telefoneValido
    ? undefined
    : 'Informe um telefone com DDD para enviar via WhatsApp.'

  return (
    <div className="modal enviar-proposta-modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
      <button
        type="button"
        className="modal-backdrop modal-backdrop--opaque"
        onClick={onClose}
        aria-label="Fechar envio de proposta"
      />
      <div className="modal-content enviar-proposta-modal__content">
        <div className="modal-header">
          <h3 id={modalTitleId}>Enviar proposta</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar envio de proposta">
            ✕
          </button>
        </div>
        <div className="modal-body enviar-proposta-modal__body">
          <p className="muted">
            Escolha um contato da lista e selecione como deseja compartilhar a proposta.
          </p>
          <fieldset className="share-contact-selector" aria-labelledby={contactsLegendId}>
            <legend id={contactsLegendId}>Contatos disponíveis</legend>
            {temContatos ? (
              <ul className="share-contact-list">
                {contatos.map((contato) => {
                  const origemLabel = PROPOSTA_ENVIO_ORIGEM_LABEL[contato.origem]
                  const isSelected = contato.id === selectedContatoId
                  return (
                    <li key={contato.id} className={`share-contact-item${isSelected ? ' is-selected' : ''}`}>
                      <label>
                        <input
                          type="radio"
                          name="share-contact"
                          value={contato.id}
                          checked={isSelected}
                          onChange={() => onSelectContato(contato.id)}
                        />
                        <span className="share-contact-details">
                          <span className="share-contact-name">{contato.nome || 'Contato sem nome'}</span>
                          <span className="share-contact-meta">
                            {contato.telefone ? contato.telefone : 'Telefone não informado'}
                          </span>
                          <span className="share-contact-origin">{origemLabel}</span>
                          {contato.email ? (
                            <span className="share-contact-meta">{contato.email}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted">
                Cadastre um cliente ou lead com telefone ou e-mail para disponibilizar o envio da proposta.
              </p>
            )}
          </fieldset>
          <div className="share-channel-grid" role="group" aria-label="Canais de envio disponíveis">
            <button
              type="button"
              className="share-channel-button whatsapp"
              onClick={() => onEnviar('whatsapp')}
              disabled={!temContatos || !contatoSelecionado || !telefoneValido}
              title={disabledMessage}
            >
              <span aria-hidden="true">💬</span>
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              className="share-channel-button whatsapp-business"
              onClick={() => onEnviar('whatsapp-business')}
              disabled={!temContatos || !contatoSelecionado || !telefoneValido}
              title={disabledMessage}
            >
              <span aria-hidden="true">🏢</span>
              <span>WhatsApp Business</span>
            </button>
            <button
              type="button"
              className="share-channel-button airdrop"
              onClick={() => onEnviar('airdrop')}
              disabled={!temContatos || !contatoSelecionado}
            >
              <span aria-hidden="true">📡</span>
              <span>AirDrop</span>
            </button>
            <button
              type="button"
              className="share-channel-button quick-share"
              onClick={() => onEnviar('quick-share')}
              disabled={!temContatos || !contatoSelecionado}
            >
              <span aria-hidden="true">⚡</span>
              <span>Quick Share</span>
            </button>
          </div>
        </div>
        <div className="modal-actions enviar-proposta-modal__actions">
          <button type="button" className="ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
