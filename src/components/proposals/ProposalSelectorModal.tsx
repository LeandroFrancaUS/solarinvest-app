/**
 * Modal/drawer for selecting from multiple proposals of the same client.
 * Shown when a client has more than one proposal and the user tries to open "the" proposal.
 */

import React, { useState } from 'react'

export interface ProposalListItem {
  id: string
  proposal_type: string
  status: string
  version: number
  proposal_code: string | null
  consumption_kwh_month: number | null
  system_kwp: number | null
  client_city: string | null
  client_state: string | null
  created_by_display_name?: string | null
  owner_display_name?: string | null
  created_at: string
  updated_at: string
  is_pending_sync?: boolean
  is_conflicted?: boolean
}

interface ProposalSelectorModalProps {
  clientName: string
  proposals: ProposalListItem[]
  onSelect: (proposal: ProposalListItem) => void
  onCreateNew?: () => void
  onClose: () => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    sent: 'Enviada',
    approved: 'Aprovada',
    rejected: 'Recusada',
    cancelled: 'Cancelada',
  }
  return labels[status] ?? status
}

function typeLabel(type: string): string {
  if (type === 'leasing') return 'Leasing'
  if (type === 'venda') return 'Venda'
  return type
}

export function ProposalSelectorModal({
  clientName,
  proposals,
  onSelect,
  onCreateNew,
  onClose,
}: ProposalSelectorModalProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'type'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = proposals
    .filter((p) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (p.proposal_code ?? '').toLowerCase().includes(q) ||
        (p.client_city ?? '').toLowerCase().includes(q) ||
        typeLabel(p.proposal_type).toLowerCase().includes(q) ||
        statusLabel(p.status).toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let compareResult = 0
      if (sortBy === 'date') {
        compareResult = b.created_at.localeCompare(a.created_at)
      } else if (sortBy === 'status') {
        compareResult = a.status.localeCompare(b.status)
      } else if (sortBy === 'type') {
        compareResult = a.proposal_type.localeCompare(b.proposal_type)
      }
      return sortDir === 'asc' ? -compareResult : compareResult
    })

  const toggleSort = (field: 'date' | 'status' | 'type') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir(field === 'date' ? 'desc' : 'asc')
    }
  }

  const newest = proposals.reduce(
    (acc, p) => (!acc || p.created_at > acc.created_at ? p : acc),
    null as ProposalListItem | null
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Propostas de ${clientName}`}
      className="proposal-selector-modal"
    >
      <div className="proposal-selector-modal__overlay" onClick={onClose} />
      <div className="proposal-selector-modal__panel">
        <div className="proposal-selector-modal__header">
          <h2 className="proposal-selector-modal__title">
            Propostas de {clientName}
          </h2>
          <button
            type="button"
            className="proposal-selector-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="proposal-selector-modal__controls">
          <input
            type="search"
            placeholder="Buscar proposta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="proposal-selector-modal__search"
            aria-label="Buscar proposta"
          />
        </div>

        {/* Sort controls */}
        <div style={{ padding: '8px 20px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Ordenar por:</span>
          <button
            type="button"
            onClick={() => toggleSort('date')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: sortBy === 'date' ? '1px solid var(--accent, #ff8c00)' : '1px solid var(--border, #e2e8f0)',
              background: sortBy === 'date' ? 'rgba(255,140,0,0.1)' : 'transparent',
              color: sortBy === 'date' ? 'var(--accent, #ff8c00)' : 'var(--text-base)',
              cursor: 'pointer',
              fontWeight: sortBy === 'date' ? 600 : 400,
            }}
            title="Clique para ordenar por data"
          >
            Data {sortBy === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
          <button
            type="button"
            onClick={() => toggleSort('status')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: sortBy === 'status' ? '1px solid var(--accent, #ff8c00)' : '1px solid var(--border, #e2e8f0)',
              background: sortBy === 'status' ? 'rgba(255,140,0,0.1)' : 'transparent',
              color: sortBy === 'status' ? 'var(--accent, #ff8c00)' : 'var(--text-base)',
              cursor: 'pointer',
              fontWeight: sortBy === 'status' ? 600 : 400,
            }}
            title="Clique para ordenar por status"
          >
            Status {sortBy === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
          <button
            type="button"
            onClick={() => toggleSort('type')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: sortBy === 'type' ? '1px solid var(--accent, #ff8c00)' : '1px solid var(--border, #e2e8f0)',
              background: sortBy === 'type' ? 'rgba(255,140,0,0.1)' : 'transparent',
              color: sortBy === 'type' ? 'var(--accent, #ff8c00)' : 'var(--text-base)',
              cursor: 'pointer',
              fontWeight: sortBy === 'type' ? 600 : 400,
            }}
            title="Clique para ordenar por tipo"
          >
            Tipo {sortBy === 'type' && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
        </div>

        <ul className="proposal-selector-modal__list" role="listbox" aria-label="Lista de propostas">
          {filtered.length === 0 && (
            <li className="proposal-selector-modal__empty">Nenhuma proposta encontrada</li>
          )}
          {filtered.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button
                type="button"
                className={`proposal-selector-modal__item${p.id === newest?.id ? ' proposal-selector-modal__item--newest' : ''}`}
                onClick={() => onSelect(p)}
              >
                <div className="proposal-selector-modal__item-header">
                  <span className="proposal-selector-modal__type">{typeLabel(p.proposal_type)}</span>
                  <span className={`proposal-selector-modal__status proposal-selector-modal__status--${p.status}`}>
                    {statusLabel(p.status)}
                  </span>
                  {p.id === newest?.id && (
                    <span className="proposal-selector-modal__newest-tag">Mais recente</span>
                  )}
                  {p.is_pending_sync && (
                    <span className="proposal-selector-modal__pending-tag">Pendente sync</span>
                  )}
                  {p.is_conflicted && (
                    <span className="proposal-selector-modal__conflict-tag">⚠ Conflito</span>
                  )}
                </div>
                <div className="proposal-selector-modal__item-meta">
                  {p.proposal_code && <span>Cód: {p.proposal_code}</span>}
                  {p.consumption_kwh_month != null && (
                    <span>{p.consumption_kwh_month.toLocaleString('pt-BR')} kWh/mês</span>
                  )}
                  {p.system_kwp != null && (
                    <span>{p.system_kwp.toLocaleString('pt-BR')} kWp</span>
                  )}
                  {p.client_city && <span>{p.client_city}{p.client_state ? `/${p.client_state}` : ''}</span>}
                  <span>v{p.version}</span>
                  <span>{formatDate(p.created_at)}</span>
                  {p.owner_display_name && <span>Consultor: {p.owner_display_name}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>

        {onCreateNew && (
          <div className="proposal-selector-modal__footer">
            <button
              type="button"
              className="proposal-selector-modal__new-btn"
              onClick={onCreateNew}
            >
              + Nova proposta para este cliente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
