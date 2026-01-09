/**
 * Flow V8 - Proposal Preview Component
 * Shows monochromatic preview of proposal before final generation
 */

import React from 'react'
import type { ClienteDados } from '../../types/printableProposal'

export interface ProposalPreviewProps {
  flowType: 'vendas' | 'leasing'
  cliente: ClienteDados
  potenciaKwp?: number | null
  valorTotal?: number | null
  mensalidade?: number | null
  prazo?: number | null
  consumoMedioMensal: number
  tipoInstalacao: string
  tipoSistema: string
  onConfirm: () => void
  onCancel: () => void
  isGenerating: boolean
}

export function ProposalPreview({
  flowType,
  cliente,
  potenciaKwp,
  valorTotal,
  mensalidade,
  prazo,
  consumoMedioMensal,
  tipoInstalacao,
  tipoSistema,
  onConfirm,
  onCancel,
  isGenerating,
}: ProposalPreviewProps): JSX.Element {
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ —'
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const formatNumber = (value: number | null | undefined, suffix = '') => {
    if (!value) return '—'
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`
  }

  return (
    <div className="v8-preview-container">
      <div className="v8-preview-header">
        <h3>Preview da Proposta</h3>
        <p className="v8-preview-subtitle">
          Revise as informações antes de gerar a proposta final
        </p>
      </div>

      <div className="v8-preview-content">
        {/* Client Section */}
        <section className="v8-preview-section">
          <h4 className="v8-preview-section-title">Cliente</h4>
          <div className="v8-preview-row">
            <span className="v8-preview-label">Nome/Razão Social:</span>
            <span className="v8-preview-value">{cliente.nome || '—'}</span>
          </div>
          <div className="v8-preview-row">
            <span className="v8-preview-label">E-mail:</span>
            <span className="v8-preview-value">{cliente.email || '—'}</span>
          </div>
          {cliente.telefone && (
            <div className="v8-preview-row">
              <span className="v8-preview-label">Telefone:</span>
              <span className="v8-preview-value">{cliente.telefone}</span>
            </div>
          )}
          {cliente.endereco && (
            <div className="v8-preview-row">
              <span className="v8-preview-label">Endereço:</span>
              <span className="v8-preview-value">{cliente.endereco}</span>
            </div>
          )}
        </section>

        {/* System Section */}
        <section className="v8-preview-section">
          <h4 className="v8-preview-section-title">Sistema</h4>
          <div className="v8-preview-row">
            <span className="v8-preview-label">Consumo Médio:</span>
            <span className="v8-preview-value">{formatNumber(consumoMedioMensal, ' kWh/mês')}</span>
          </div>
          <div className="v8-preview-row">
            <span className="v8-preview-label">Potência Recomendada:</span>
            <span className="v8-preview-value">{formatNumber(potenciaKwp, ' kWp')}</span>
          </div>
          <div className="v8-preview-row">
            <span className="v8-preview-label">Tipo de Instalação:</span>
            <span className="v8-preview-value">{tipoInstalacao || '—'}</span>
          </div>
          <div className="v8-preview-row">
            <span className="v8-preview-label">Tipo de Sistema:</span>
            <span className="v8-preview-value">{tipoSistema || '—'}</span>
          </div>
        </section>

        {/* Financial Section */}
        <section className="v8-preview-section">
          <h4 className="v8-preview-section-title">Valores</h4>
          {flowType === 'vendas' ? (
            <>
              <div className="v8-preview-row highlight">
                <span className="v8-preview-label">Investimento Total:</span>
                <span className="v8-preview-value">{formatCurrency(valorTotal)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="v8-preview-row highlight">
                <span className="v8-preview-label">Mensalidade:</span>
                <span className="v8-preview-value">{formatCurrency(mensalidade)}</span>
              </div>
              <div className="v8-preview-row">
                <span className="v8-preview-label">Prazo:</span>
                <span className="v8-preview-value">{prazo ? `${prazo} meses` : '—'}</span>
              </div>
            </>
          )}
        </section>

        {/* Note */}
        <div className="v8-preview-note">
          <strong>Nota:</strong> Esta é uma visualização simplificada. A proposta final terá todos os detalhes técnicos e comerciais.
        </div>
      </div>

      <div className="v8-preview-actions">
        <button
          type="button"
          className="v8-btn v8-btn-secondary"
          onClick={onCancel}
          disabled={isGenerating}
        >
          Voltar
        </button>
        <button
          type="button"
          className="v8-btn v8-btn-primary"
          onClick={onConfirm}
          disabled={isGenerating}
        >
          {isGenerating ? 'Gerando...' : 'Confirmar e Gerar Proposta'}
        </button>
      </div>
    </div>
  )
}
