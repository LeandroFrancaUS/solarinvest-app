import React, { useState, useMemo } from 'react'
import type { PrintableProposalProps } from '../types/printableProposal'
import { normalizeProposalId } from '../lib/ids'
import { normalizeNumbers } from '../utils/formatters'
import { Field } from '../components/ui/Field'
import { labelWithTooltip } from '../components/InfoTooltip'

const PrintableProposal = React.lazy(() => import('../components/print/PrintableProposal'))

// ---------------------------------------------------------------------------
// Local types — structural subset of App.tsx's OrcamentoSalvo
// ---------------------------------------------------------------------------

type OrcamentoRegistro = {
  id: string
  criadoEm: string
  clienteId?: string
  clienteNome: string
  clienteCidade: string
  clienteUf: string
  clienteDocumento?: string
  clienteUc?: string
  dados: PrintableProposalProps
  ownerName?: string
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const formatBudgetDate = (isoString: string) => {
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type BudgetSearchPageProps = {
  registros: OrcamentoRegistro[]
  /** When true, shows the "Consultor" column and owner filter */
  isPrivilegedUser: boolean
  /** When true, the delete action is hidden */
  isProposalReadOnly: boolean
  onClose: () => void
  onCarregarOrcamento: (registro: OrcamentoRegistro) => Promise<void>
  onAbrirOrcamento: (registro: OrcamentoRegistro, modo: 'preview' | 'download') => Promise<void>
  onConfirmarRemocao: (registro: OrcamentoRegistro) => Promise<void>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetSearchPage({
  registros,
  isPrivilegedUser,
  isProposalReadOnly,
  onClose,
  onCarregarOrcamento,
  onAbrirOrcamento,
  onConfirmarRemocao,
}: BudgetSearchPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOwner, setSelectedOwner] = useState('all')
  const [visualizado, setVisualizado] = useState<PrintableProposalProps | null>(null)
  const [visualizadoInfo, setVisualizadoInfo] = useState<{ id: string; cliente: string } | null>(null)

  const ownerOptions = useMemo(() => {
    if (!isPrivilegedUser) return []
    return Array.from(new Set(registros.map((r) => r.ownerName ?? 'Desconhecido')))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [isPrivilegedUser, registros])

  const filtered = useMemo(() => {
    if (!searchTerm.trim() && selectedOwner === 'all') {
      return registros
    }

    const queryText = normalizeText(searchTerm.trim())
    const queryDigits = normalizeNumbers(searchTerm)

    return registros.filter((registro) => {
      const codigo = normalizeText(registro.id)
      const codigoDigits = normalizeNumbers(registro.id)
      const nome = normalizeText(registro.clienteNome || registro.dados.cliente.nome || '')
      const clienteIdTexto = normalizeText(registro.clienteId ?? '')
      const clienteIdDigits = normalizeNumbers(registro.clienteId ?? '')
      const documentoRaw = registro.clienteDocumento || registro.dados.cliente.documento || ''
      const documentoTexto = normalizeText(documentoRaw)
      const documentoDigits = normalizeNumbers(documentoRaw)
      const ucRaw = registro.clienteUc || registro.dados.cliente.uc || ''
      const ucTexto = normalizeText(ucRaw)
      const ucDigits = normalizeNumbers(ucRaw)
      const ownerTexto = normalizeText(registro.ownerName ?? '')
      const ownerLabel = registro.ownerName ?? 'Desconhecido'
      const matchSelectedOwner = selectedOwner === 'all' || ownerLabel === selectedOwner

      if (
        codigo.includes(queryText) ||
        nome.includes(queryText) ||
        clienteIdTexto.includes(queryText) ||
        documentoTexto.includes(queryText) ||
        ucTexto.includes(queryText) ||
        (ownerTexto && ownerTexto.includes(queryText))
      ) {
        return matchSelectedOwner
      }

      if (!queryDigits) {
        return false
      }

      return matchSelectedOwner && (
        codigoDigits.includes(queryDigits) ||
        clienteIdDigits.includes(queryDigits) ||
        documentoDigits.includes(queryDigits) ||
        ucDigits.includes(queryDigits)
      )
    })
  }, [searchTerm, registros, selectedOwner])

  const totalOrcamentos = registros.length
  const totalResultados = filtered.length

  return (
    <div className="budget-search-page">
      <div className="budget-search-page-header">
        <div>
          <h2>Consultar orçamentos</h2>
          <p>
            Localize propostas salvas pelo cliente, documento, unidade consumidora ou código do orçamento e carregue-as
            novamente na proposta.
          </p>
        </div>
        <button type="button" className="ghost" onClick={onClose}>
          Voltar
        </button>
      </div>
      <div className="budget-search-panels budget-search-panels--single budget-search-panels--budget">
        <section className="budget-search-panel budget-search-panel--records">
          <div className="budget-search-quick">
            <div className="budget-search-header">
              <h4>Consulta rápida</h4>
              <p>Busque pelo cliente, código interno, CPF/CNPJ ou unidade consumidora.</p>
            </div>
            <Field
              label={labelWithTooltip(
                'Buscar orçamentos',
                'Filtra propostas salvas por nome do cliente, documento, UC ou código interno.',
              )}
              hint="Procure pelo cliente, ID do cliente, CPF, unidade consumidora ou código do orçamento."
            >
              <input
                id="budget-search-input"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex.: ABC12, 123.456.789-00 ou SLRINVST-00001234"
                autoFocus
              />
            </Field>
            {isPrivilegedUser ? (
              <div className="owner-filter-row">
                <label htmlFor="propostas-owner-filter">Criador/consultor</label>
                <select
                  id="propostas-owner-filter"
                  value={selectedOwner}
                  onChange={(event) => setSelectedOwner(event.target.value)}
                >
                  <option value="all">Todos os consultores</option>
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="budget-search-summary">
              <span>
                {totalOrcamentos === 0
                  ? 'Nenhum orçamento salvo até o momento.'
                  : `${totalResultados} de ${totalOrcamentos} orçamento(s) exibidos.`}
              </span>
              {(searchTerm || selectedOwner !== 'all') ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setSearchTerm('')
                    setSelectedOwner('all')
                  }}
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>
          <div className="budget-search-header">
            <h4>Registros salvos</h4>
          </div>
          {totalOrcamentos === 0 ? (
            <p className="budget-search-empty">Nenhum orçamento foi salvo ainda. Gere uma proposta para começar.</p>
          ) : totalResultados === 0 ? (
            <p className="budget-search-empty">
              Nenhum orçamento encontrado para &quot;<strong>{searchTerm}</strong>&quot;.
            </p>
          ) : (
            <div className="budget-search-table">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Cliente</th>
                      <th>Documento</th>
                      <th>Unidade consumidora</th>
                      <th>Criado em</th>
                      {isPrivilegedUser ? <th className="col-nowrap">Consultor</th> : null}
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((registro) => {
                      const documento =
                        registro.clienteDocumento?.trim() ||
                        registro.dados.cliente.documento?.trim() ||
                        ''
                      const unidadeConsumidora =
                        registro.clienteUc?.trim() || registro.dados.cliente.uc?.trim() || ''
                      const cidade =
                        registro.clienteCidade?.trim() || registro.dados.cliente.cidade?.trim() || ''
                      const uf = registro.clienteUf?.trim() || registro.dados.cliente.uf?.trim() || ''
                      const nomeCliente =
                        registro.clienteNome?.trim() ||
                        registro.dados.cliente.nome?.trim() ||
                        registro.id
                      const registroIdPadronizado = normalizeProposalId(registro.id) || registro.id
                      const cidadeUf = [cidade, uf].filter(Boolean).join(' / ')
                      return (
                        <tr
                          key={registro.id}
                          className={
                            visualizadoInfo?.id === registroIdPadronizado ? 'is-selected' : undefined
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="budget-search-code"
                              onClick={() => { void onCarregarOrcamento(registro) }}
                              title="Visualizar orçamento salvo"
                            >
                              {registro.id}
                            </button>
                          </td>
                          <td>
                            <div className="budget-search-client">
                              <strong>{nomeCliente}</strong>
                              {cidadeUf ? <span>{cidadeUf}</span> : null}
                            </div>
                          </td>
                          <td>{documento || null}</td>
                          <td>{unidadeConsumidora || null}</td>
                          <td>{formatBudgetDate(registro.criadoEm)}</td>
                          {isPrivilegedUser ? (
                            <td data-label="Consultor">
                              {registro.ownerName ? (
                                <span className="budget-search-owner">{registro.ownerName}</span>
                              ) : null}
                            </td>
                          ) : null}
                          <td>
                            <div className="budget-search-actions">
                              <button
                                type="button"
                                className="budget-search-action"
                                onClick={() => { void onCarregarOrcamento(registro) }}
                                aria-label="Carregar orçamento salvo"
                                title="Carregar orçamento"
                              >
                                📂
                              </button>
                              <button
                                type="button"
                                className="budget-search-action"
                                onClick={() => { void onAbrirOrcamento(registro, 'preview') }}
                                aria-label="Visualizar orçamento salvo"
                                title="Visualizar orçamento"
                              >
                                👁
                              </button>
                              <button
                                type="button"
                                className="budget-search-action"
                                onClick={() => { void onAbrirOrcamento(registro, 'download') }}
                                aria-label="Baixar orçamento em PDF"
                                title="Baixar PDF"
                              >
                                ⤓
                              </button>
                              {!isProposalReadOnly && (
                              <button
                                type="button"
                                className="budget-search-action danger"
                                onClick={() => void onConfirmarRemocao(registro)}
                                aria-label="Excluir orçamento salvo"
                                title="Excluir orçamento salvo"
                              >
                                🗑
                              </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
      {visualizado ? (
        <section className="budget-search-panel budget-search-viewer">
          <div className="budget-search-header">
            <h4>
              Visualizando orçamento <strong>{visualizadoInfo?.id ?? '—'}</strong>
            </h4>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setVisualizado(null)
                setVisualizadoInfo(null)
              }}
            >
              Fechar visualização
            </button>
          </div>
          <p className="budget-viewer-subtitle">
            Dados somente leitura para {visualizadoInfo?.cliente ?? 'o cliente selecionado'}.
          </p>
          <div className="budget-viewer-body">
            <React.Suspense fallback={<p className="budget-search-empty">Carregando orçamento selecionado…</p>}>
              <div className="budget-viewer-content">
                <PrintableProposal {...visualizado} />
              </div>
            </React.Suspense>
          </div>
        </section>
      ) : null}
    </div>
  )
}
