/**
 * Proposal Preview Modal
 * Shows monochromatic preview before final PDF generation
 * Accept/Reject workflow
 */

import React from 'react'
import type { ClienteDados } from '../../types/printableProposal'

export interface ProposalPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept: () => void | Promise<void>
  onReject: () => void
  // Data to preview
  cliente: ClienteDados
  sistema: {
    tipoInstalacao: string
    tipoSistema: string
    potenciaKwp?: number | null
  }
  financeiro: {
    valorTotal?: number | null
    mensalidade?: number | null
    prazo?: number | null
  }
  isLeasing: boolean
}

export function ProposalPreviewModal({
  isOpen,
  onClose,
  onAccept,
  onReject,
  cliente,
  sistema,
  financeiro,
  isLeasing,
}: ProposalPreviewModalProps): JSX.Element | null {
  if (!isOpen) return null

  const formatCurrency = (value?: number | null): string => {
    if (!value) return '—'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatNumber = (value?: number | null, suffix = ''): string => {
    if (!value) return '—'
    return `${value.toFixed(2)}${suffix}`
  }

  return (
    <div className="v8-modal-overlay" onClick={onClose}>
      <div className="v8-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="v8-modal-header">
          <h2>Revisão da Proposta</h2>
          <button className="v8-modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="v8-modal-body">
          {/* Client Section */}
          <section className="v8-preview-section">
            <h3>Dados do Cliente</h3>
            <div className="v8-preview-grid">
              <div className="v8-preview-item">
                <span className="v8-preview-label">Nome/Razão Social:</span>
                <span className="v8-preview-value">{cliente.nome || '—'}</span>
              </div>
              <div className="v8-preview-item">
                <span className="v8-preview-label">E-mail:</span>
                <span className="v8-preview-value">{cliente.email || '—'}</span>
              </div>
              {cliente.telefone && (
                <div className="v8-preview-item">
                  <span className="v8-preview-label">Telefone:</span>
                  <span className="v8-preview-value">{cliente.telefone}</span>
                </div>
              )}
              {cliente.endereco && (
                <div className="v8-preview-item">
                  <span className="v8-preview-label">Endereço:</span>
                  <span className="v8-preview-value">
                    {cliente.endereco}
                    {cliente.cidade && `, ${cliente.cidade}`}
                    {cliente.uf && ` - ${cliente.uf}`}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* System Section */}
          <section className="v8-preview-section">
            <h3>Sistema Fotovoltaico</h3>
            <div className="v8-preview-grid">
              <div className="v8-preview-item">
                <span className="v8-preview-label">Tipo de Instalação:</span>
                <span className="v8-preview-value">{sistema.tipoInstalacao || '—'}</span>
              </div>
              <div className="v8-preview-item">
                <span className="v8-preview-label">Tipo de Sistema:</span>
                <span className="v8-preview-value">{sistema.tipoSistema || '—'}</span>
              </div>
              {sistema.potenciaKwp && (
                <div className="v8-preview-item">
                  <span className="v8-preview-label">Potência:</span>
                  <span className="v8-preview-value">{formatNumber(sistema.potenciaKwp, ' kWp')}</span>
                </div>
              )}
            </div>
          </section>

          {/* Financial Section */}
          <section className="v8-preview-section">
            <h3>Resumo Financeiro</h3>
            <div className="v8-preview-grid">
              {isLeasing ? (
                <>
                  {financeiro.mensalidade && (
                    <div className="v8-preview-item v8-preview-highlight">
                      <span className="v8-preview-label">Mensalidade Estimada:</span>
                      <span className="v8-preview-value">{formatCurrency(financeiro.mensalidade)}</span>
                    </div>
                  )}
                  {financeiro.prazo && (
                    <div className="v8-preview-item">
                      <span className="v8-preview-label">Prazo:</span>
                      <span className="v8-preview-value">{financeiro.prazo} meses</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {financeiro.valorTotal && (
                    <div className="v8-preview-item v8-preview-highlight">
                      <span className="v8-preview-label">Investimento Total:</span>
                      <span className="v8-preview-value">{formatCurrency(financeiro.valorTotal)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <div className="v8-preview-note">
            <p>
              <strong>Atenção:</strong> Esta é uma visualização simplificada. Ao aceitar, a proposta completa com
              cores, gráficos e análises detalhadas será gerada em PDF.
            </p>
          </div>
        </div>

        <div className="v8-modal-footer">
          <button className="v8-btn v8-btn-secondary" onClick={onReject}>
            Rejeitar
          </button>
          <button className="v8-btn v8-btn-primary" onClick={onAccept}>
            Aceitar e Gerar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
