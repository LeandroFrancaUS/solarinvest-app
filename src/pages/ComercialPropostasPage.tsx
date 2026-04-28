// src/pages/ComercialPropostasPage.tsx
// Área Comercial — Propostas (Etapa 3)
// Exibe propostas salvas agrupadas por tipo (Leasing / Vendas) e status.
// Reaproveitamento do orcamentosSalvos existente — sem alterar cálculo ou backend.

import React, { useState, useMemo } from 'react'
import type { PrintableProposalProps } from '../types/printableProposal'

// ---------------------------------------------------------------------------
// Local types — matches App.tsx's OrcamentoSalvo shape (without importing from App)
// ---------------------------------------------------------------------------

export type PropostaItem = {
  id: string
  criadoEm: string
  clienteId?: string | undefined
  clienteNome: string
  clienteCidade: string
  clienteUf: string
  clienteDocumento?: string | undefined
  clienteUc?: string | undefined
  dados: PrintableProposalProps
  ownerName?: string
  ownerUserId?: string
}

// ---------------------------------------------------------------------------
// Status types & helpers
// ---------------------------------------------------------------------------

// Statuses shown in the UI (Portuguese labels)
export type PropostaStatusUI =
  | 'RASCUNHO'
  | 'ENVIADA'
  | 'ACEITA'
  | 'RECUSADA'
  | 'EXPIRADA'

const STATUS_LABEL: Record<PropostaStatusUI, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADA: 'Enviada',
  ACEITA: 'Aceita',
  RECUSADA: 'Recusada',
  EXPIRADA: 'Expirada',
}

const STATUS_COLOR: Record<PropostaStatusUI, string> = {
  RASCUNHO: '#6b7280',
  ENVIADA: '#f59e0b',
  ACEITA: '#22c55e',
  RECUSADA: '#ef4444',
  EXPIRADA: '#9ca3af',
}

const STATUS_ORDER: PropostaStatusUI[] = ['RASCUNHO', 'ENVIADA', 'ACEITA', 'RECUSADA', 'EXPIRADA']

/**
 * Derive a display status from local proposal data.
 * Since local proposals have no explicit status field, all are treated as RASCUNHO.
 * Full status tracking (ENVIADA, ACEITA, etc.) requires the backend proposals API.
 */
function deriveStatus(_proposta: PropostaItem): PropostaStatusUI {
  return 'RASCUNHO'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeSearch = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function propostaMatchesType(p: PropostaItem, tab: 'leasing' | 'vendas'): boolean {
  const tipo = p.dados.tipoProposta
  return tab === 'leasing' ? tipo === 'LEASING' : tipo === 'VENDA_DIRETA'
}

const formatDate = (isoString: string) => {
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const formatCapex = (value: number | undefined) => {
  if (!value) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComercialPropostasPageProps {
  propostas: PropostaItem[]
  initialTab?: 'leasing' | 'vendas'
  isPrivilegedUser: boolean
  isProposalReadOnly: boolean
  onCarregarProposta: (proposta: PropostaItem) => void
  onAbrirProposta: (proposta: PropostaItem, modo: 'preview' | 'print' | 'download') => void
  onAbrirBudgetSearch: () => void
  onEnviarProposta: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComercialPropostasPage({
  propostas,
  initialTab = 'leasing',
  isPrivilegedUser,
  isProposalReadOnly,
  onCarregarProposta,
  onAbrirProposta,
  onAbrirBudgetSearch,
  onEnviarProposta,
}: ComercialPropostasPageProps) {
  const [activeTab, setActiveTab] = useState<'leasing' | 'vendas'>(initialTab)
  const [filtroStatus, setFiltroStatus] = useState<PropostaStatusUI | 'all'>('all')
  const [busca, setBusca] = useState('')

  // Filter proposals by type
  const propostasPorTipo = useMemo(() => {
    return propostas.filter((p) => propostaMatchesType(p, activeTab))
  }, [propostas, activeTab])

  // Apply search and status filter
  const propostasFiltradas = useMemo(() => {
    const query = normalizeSearch(busca)
    return propostasPorTipo.filter((p) => {
      const status = deriveStatus(p)
      if (filtroStatus !== 'all' && status !== filtroStatus) return false
      if (!busca) return true
      const nome = normalizeSearch(p.clienteNome)
      const cidade = normalizeSearch(p.clienteCidade)
      return nome.includes(query) || cidade.includes(query)
    })
  }, [propostasPorTipo, filtroStatus, busca])

  // Group filtered proposals by status
  const grupos = useMemo(() => {
    const byStatus = new Map<PropostaStatusUI, PropostaItem[]>()
    for (const p of propostasFiltradas) {
      const s = deriveStatus(p)
      if (!byStatus.has(s)) byStatus.set(s, [])
      byStatus.get(s)!.push(p)
    }
    return STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => ({
      status: s,
      items: byStatus.get(s)!,
    }))
  }, [propostasFiltradas])

  const totalTab = propostasPorTipo.length

  return (
    <div className="page comercial-propostas-page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Propostas</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #6b7280)', fontSize: '0.875rem' }}>
            Propostas salvas agrupadas por tipo e status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn secondary"
            onClick={onAbrirBudgetSearch}
            style={{ fontSize: '0.875rem' }}
          >
            📂 Ver todas
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={onEnviarProposta}
            style={{ fontSize: '0.875rem' }}
          >
            📨 Enviar proposta
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.25rem', borderBottom: '2px solid var(--color-border, #e5e7eb)' }}>
        {(['leasing', 'vendas'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setFiltroStatus('all'); setBusca('') }}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--color-primary, #2563eb)' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab ? 'var(--color-primary, #2563eb)' : 'var(--color-text-muted, #6b7280)',
              cursor: 'pointer',
              marginBottom: '-2px',
            }}
          >
            {tab === 'leasing' ? '📝 Leasing' : '🧾 Vendas'}
            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted, #9ca3af)' }}>
              ({propostas.filter((p) => propostaMatchesType(p, tab)).length})
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <label htmlFor="cp-busca" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Buscar
          </label>
          <input
            id="cp-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome do cliente ou cidade…"
            style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border, #d1d5db)', fontSize: '0.875rem', minWidth: '220px' }}
          />
        </div>

        <div>
          <label htmlFor="cp-status" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Status
          </label>
          <select
            id="cp-status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as PropostaStatusUI | 'all')}
            style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border, #d1d5db)', fontSize: '0.875rem' }}
          >
            <option value="all">Todos os status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {totalTab === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted, #6b7280)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <p style={{ margin: 0 }}>
            Nenhuma proposta de {activeTab === 'leasing' ? 'Leasing' : 'Vendas'} salva.
          </p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
            Use o formulário principal para criar uma nova proposta.
          </p>
        </div>
      ) : grupos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted, #6b7280)' }}>
          <p style={{ margin: 0 }}>Nenhuma proposta encontrada com os filtros aplicados.</p>
        </div>
      ) : (
        <div>
          {grupos.map(({ status, items }) => (
            <div key={status} style={{ marginBottom: '1.5rem' }}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: STATUS_COLOR[status],
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: STATUS_COLOR[status] }}>
                  {STATUS_LABEL[status]}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #9ca3af)' }}>
                  ({items.length})
                </span>
              </div>

              {/* Proposals table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)', background: 'var(--color-surface-alt, #f9fafb)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Cliente</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Cidade / UF</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>CAPEX</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Criado em</th>
                      {isPrivilegedUser && (
                        <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Consultor</th>
                      )}
                      <th style={{ padding: '0.5rem 0.75rem' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        style={{ borderBottom: '1px solid var(--color-border, #f3f4f6)', cursor: 'pointer' }}
                        onClick={() => onCarregarProposta(p)}
                      >
                        <td style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>{p.clienteNome || '—'}</td>
                        <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
                          {[p.clienteCidade, p.clienteUf].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem' }}>{formatCapex(p.dados.capex)}</td>
                        <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
                          {formatDate(p.criadoEm)}
                        </td>
                        {isPrivilegedUser && (
                          <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
                            {p.ownerName ?? '—'}
                          </td>
                        )}
                        <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                            {!isProposalReadOnly && (
                              <button
                                type="button"
                                className="btn primary"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                                onClick={(e) => { e.stopPropagation(); onCarregarProposta(p) }}
                              >
                                Editar
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                              onClick={(e) => { e.stopPropagation(); onAbrirProposta(p, 'preview') }}
                            >
                              Preview
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted, #9ca3af)' }}>
            <em>
              Nota: status ENVIADA, ACEITA, RECUSADA e EXPIRADA dependem da integração com o backend de propostas.
              Atualmente todas as propostas locais são exibidas como Rascunho.
            </em>
          </p>
        </div>
      )}
    </div>
  )
}
