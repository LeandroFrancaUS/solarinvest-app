import React, { useId, useMemo, useCallback } from 'react'
import { CheckboxSmall } from '../CheckboxSmall'

export type LeasingContratoTipo = 'residencial' | 'condominio'

export type LeasingAnexoId =
  | 'ANEXO_I'
  | 'ANEXO_II'
  | 'ANEXO_III'
  | 'ANEXO_IV'
  | 'ANEXO_VII'
  | 'ANEXO_VIII'
  | 'ANEXO_X'

export type LeasingAnexoConfig = {
  id: LeasingAnexoId
  label: string
  descricao?: string
  tipos: LeasingContratoTipo[]
  autoInclude?: boolean
}

export const LEASING_ANEXOS_CONFIG: LeasingAnexoConfig[] = [
  {
    id: 'ANEXO_II',
    label: 'Opção de Compra',
    descricao: 'Termo de opção de compra da usina ao final do contrato, conforme regras aplicáveis ao modelo de leasing.',
    tipos: ['residencial', 'condominio'],
    autoInclude: true,
  },
  {
    id: 'ANEXO_III',
    label: 'Metodologia de Cálculo',
    descricao: 'Documento com a metodologia interna utilizada para as simulações e estimativas de mensalidade.',
    tipos: ['residencial', 'condominio'],
    autoInclude: true,
  },
  {
    id: 'ANEXO_IV',
    label: 'Autorização do Proprietário',
    descricao: 'Declaração dos proprietários ou herdeiros autorizando a instalação.',
    tipos: ['residencial'],
    autoInclude: true,
  },
  {
    id: 'ANEXO_VIII',
    label: 'Procuração',
    descricao: 'Documento obrigatório para representação.',
    tipos: ['residencial', 'condominio'],
    autoInclude: true,
  },
  {
    id: 'ANEXO_I',
    label: 'Especificações Técnicas',
    descricao: 'Resumo técnico e proposta comercial detalhada conforme metodologia interna da SolarInvest.',
    tipos: ['residencial', 'condominio'],
  },
  {
    id: 'ANEXO_VII',
    label: 'Termo de Entrega e Aceite',
    descricao: 'Registro de entrega técnica da usina.',
    tipos: ['residencial', 'condominio'],
  },
  {
    id: 'ANEXO_X',
    label: 'Corresponsável financeiro',
    descricao: 'Dados do corresponsável financeiro para assinatura complementar.',
    tipos: ['residencial', 'condominio'],
  },
]

export const getDefaultLeasingAnexos = (
  tipo: LeasingContratoTipo,
  options?: { corresponsavelAtivo?: boolean },
): LeasingAnexoId[] => {
  const defaults = LEASING_ANEXOS_CONFIG.filter(
    (anexo) => anexo.autoInclude && anexo.tipos.includes(tipo),
  ).map((anexo) => anexo.id)
  if (options?.corresponsavelAtivo) {
    defaults.push('ANEXO_X')
  }
  return defaults
}

export const ensureRequiredLeasingAnexos = (
  anexosSelecionados: LeasingAnexoId[],
  tipo: LeasingContratoTipo,
  options?: { corresponsavelAtivo?: boolean },
): LeasingAnexoId[] => {
  const required = getDefaultLeasingAnexos(tipo, options)
  const merged = new Set<LeasingAnexoId>([...anexosSelecionados, ...required])
  return Array.from(merged)
}

type LeasingContractsModalProps = {
  tipoContrato: LeasingContratoTipo
  anexosSelecionados: LeasingAnexoId[]
  anexosAvailability: Record<LeasingAnexoId, boolean>
  isLoadingAvailability: boolean
  corresponsavelAtivo: boolean
  onToggleAnexo: (anexoId: LeasingAnexoId) => void
  onSelectAll: (selectAll: boolean) => void
  onConfirm: () => void
  onClose: () => void
  isGenerating: boolean
}

export function LeasingContractsModal({
  tipoContrato,
  anexosSelecionados,
  anexosAvailability,
  isLoadingAvailability,
  corresponsavelAtivo,
  onToggleAnexo,
  onSelectAll,
  onConfirm,
  onClose,
  isGenerating,
}: LeasingContractsModalProps) {
  const modalTitleId = useId()
  const checkboxBaseId = useId()
  const anexosDisponiveis = useMemo(
    () => LEASING_ANEXOS_CONFIG.filter((config) => config.tipos.includes(tipoContrato)),
    [tipoContrato],
  )
  const isRequired = useCallback(
    (config: LeasingAnexoConfig) =>
      Boolean(config.autoInclude || (corresponsavelAtivo && config.id === 'ANEXO_X')),
    [corresponsavelAtivo],
  )
  const opcionais = anexosDisponiveis.filter((config) => !isRequired(config))
  const allOptionalSelected =
    opcionais.length > 0 && opcionais.every((config) => anexosSelecionados.includes(config.id))

  const hasOpcionalSelecionavel = opcionais.length > 0

  return (
    <div
      className="modal contract-templates-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content contract-templates-modal__content">
        <div className="modal-header">
          <h3 id={modalTitleId}>
            {tipoContrato === 'condominio'
              ? 'Gerar documentos do leasing (condomínio)'
              : 'Gerar documentos do leasing (residencial)'}
          </h3>
          <button className="icon" onClick={onClose} aria-label="Fechar seleção de anexos">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>
            Escolha quais anexos devem acompanhar o contrato principal. Itens obrigatórios são
            incluídos automaticamente.
          </p>
          {hasOpcionalSelecionavel ? (
            <div className="contract-template-actions">
              <button
                type="button"
                className="link"
                onClick={() => onSelectAll(!allOptionalSelected)}
              >
                {allOptionalSelected ? 'Desmarcar opcionais' : 'Selecionar todos os opcionais'}
              </button>
            </div>
          ) : null}
          {isLoadingAvailability ? (
            <p className="muted">Verificando disponibilidade dos anexos...</p>
          ) : null}
          <ul className="contract-template-list">
            {anexosDisponiveis.map((config, index) => {
              const checkboxId = `${checkboxBaseId}-${index}`
              const isAvailable = anexosAvailability[config.id] !== false
              const required = isRequired(config)
              const checked = required || anexosSelecionados.includes(config.id)
              const disabled = required || !isAvailable
              return (
                <li key={config.id} className="contract-template-item">
                  <label htmlFor={checkboxId} className="flex items-center gap-2">
                    <CheckboxSmall
                      id={checkboxId}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => {
                        if (disabled) {
                          return
                        }
                        onToggleAnexo(config.id)
                      }}
                    />
                    <span>
                      <strong>{config.label}</strong>
                      {config.descricao ? (
                        <span className="filename">{config.descricao}</span>
                      ) : null}
                      {required ? (
                        <span className="filename">Documento obrigatório</span>
                      ) : null}
                      {!isAvailable ? (
                        <span className="filename" style={{ color: '#dc2626', fontSize: '0.875rem' }}>
                          Arquivo não disponível
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={isGenerating}
          >
            {isGenerating ? 'Gerando…' : 'Gerar pacote'}
          </button>
        </div>
      </div>
    </div>
  )
}
