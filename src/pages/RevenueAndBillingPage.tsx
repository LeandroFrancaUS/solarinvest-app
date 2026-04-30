// src/pages/RevenueAndBillingPage.tsx
// Receita e Cobrança — wraps FinancialManagementPage with a deduplicated
// "Projetos" tab backed by /api/revenue-billing/clients.
//
// DEDUPLICATION GUARANTEE
// ───────────────────────
// The original "Projetos" tab (RealProjectsTab) read from /api/projects —
// one row per project record.  A client with multiple project rows appeared
// multiple times, and clients with duplicate CPF/CNPJ records appeared even
// more.
//
// This page injects a DeduplicatedProjectsTab via FinancialManagementPage's
// projectsTabOverride prop.  The new tab calls /api/revenue-billing/clients
// which returns EXACTLY ONE canonical row per active client, deduplicated
// by normalised CPF/CNPJ on the server side (see
// server/revenue-billing/repository.js for the SQL CTE strategy).
//
// All other tabs (Visão Geral, Fluxo de Caixa, Leasing, Vendas, Faturas)
// are delegated to FinancialManagementPage unchanged.

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { FinancialManagementPage } from './FinancialManagementPage'
import {
  fetchRevenueClients,
  type RevenueClientRow,
  type RevenueClientsFilters,
} from '../services/revenueBillingApi'
import { formatCpfCnpj } from '../lib/format/document'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
  initialProjectId?: string | null
}

type SortKey = 'client' | 'document' | 'location' | 'contract_type' | 'contract_status' | 'updated_at'

interface SortState {
  key: SortKey
  direction: 'asc' | 'desc'
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  leasing: 'Leasing',
  sale:    'Venda',
  buyout:  'Buyout',
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft:     'Rascunho',
  active:    'Ativo',
  suspended: 'Suspenso',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const CONTRACT_STATUS_CLASS: Record<string, string> = {
  active:    'fm-badge fm-badge--project-status-andamento',
  completed: 'fm-badge fm-badge--project-status-concluido',
  cancelled: 'fm-badge fm-badge--danger',
  suspended: 'fm-badge',
  draft:     'fm-badge',
}

const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sortCompare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' })
}

// ─────────────────────────────────────────────────────────────────────────────
// DeduplicatedProjectsTab
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders one row per canonical active client from the deduplicated server
 * endpoint /api/revenue-billing/clients.
 *
 * No Array.filter deduplication is performed on the frontend; the server
 * guarantees exactly one row per CPF/CNPJ.
 */
function DeduplicatedProjectsTab() {
  const [rows, setRows]           = useState<RevenueClientRow[]>([])
  const [total, setTotal]         = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (filters: RevenueClientsFilters = {}) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchRevenueClients({ limit: 500, ...filters })
      setRows(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar projetos.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void load({
        ...(value ? { search: value } : {}),
        ...(typeFilter ? { contract_type: typeFilter } : {}),
      })
    }, 300)
  }, [typeFilter, load])

  const handleTypeFilter = useCallback((value: string) => {
    setTypeFilter(value)
    void load({
      ...(search ? { search } : {}),
      ...(value ? { contract_type: value } : {}),
    })
  }, [search, load])

  function toggleSort(key: SortKey): void {
    setSortState((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const sortedRows = useMemo(() => {
    if (!sortState) return rows
    return [...rows].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown
      switch (sortState.key) {
        case 'client':          aVal = a.client_name;       bVal = b.client_name;       break
        case 'document':        aVal = a.document_key;      bVal = b.document_key;      break
        case 'location':
          aVal = [a.city, a.state].filter(Boolean).join(' / ')
          bVal = [b.city, b.state].filter(Boolean).join(' / ')
          break
        case 'contract_type':   aVal = a.contract_type;     bVal = b.contract_type;     break
        case 'contract_status': aVal = a.contract_status;   bVal = b.contract_status;   break
        default:                aVal = a.client_updated_at; bVal = b.client_updated_at
      }
      const cmp = sortCompare(aVal, bVal)
      return sortState.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, sortState])

  function sortIcon(key: SortKey): string {
    if (sortState?.key !== key) return ' ↕'
    return sortState.direction === 'asc' ? ' ↑' : ' ↓'
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="fm-loading">
        <span className="fm-loading-spinner" aria-hidden="true" />
        Carregando projetos…
      </div>
    )
  }

  if (error && rows.length === 0) {
    return (
      <div className="fm-error" role="alert">
        <strong>Erro ao carregar:</strong> {error}
        <button type="button" className="ghost" onClick={() => void load()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="fm-projects">
      <div className="fm-real-projects-header">
        <div className="fm-filters">
          <input
            type="search"
            className="fm-filter-input"
            placeholder="Buscar nome, CPF/CNPJ, cidade…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <select
            className="fm-filter-select"
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            <option value="leasing">Leasing</option>
            <option value="sale">Venda</option>
            <option value="buyout">Buyout</option>
          </select>
        </div>
        <span className="fm-real-projects-meta">
          {total > 0 ? `${total} cliente${total !== 1 ? 's' : ''}` : null}
        </span>
      </div>

      {sortedRows.length === 0 ? (
        <div className="fm-empty">Nenhum cliente encontrado com os filtros aplicados.</div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th style={thStyle} onClick={() => toggleSort('client')}>
                  Cliente{sortIcon('client')}
                </th>
                <th style={thStyle} onClick={() => toggleSort('document')}>
                  CPF / CNPJ{sortIcon('document')}
                </th>
                <th style={thStyle} onClick={() => toggleSort('location')}>
                  Cidade / UF{sortIcon('location')}
                </th>
                <th style={thStyle} onClick={() => toggleSort('contract_type')}>
                  Tipo{sortIcon('contract_type')}
                </th>
                <th style={thStyle} onClick={() => toggleSort('contract_status')}>
                  Status Contrato{sortIcon('contract_status')}
                </th>
                <th style={thStyle} onClick={() => toggleSort('updated_at')}>
                  Atualizado em{sortIcon('updated_at')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const location =
                  row.city && row.state ? `${row.city} / ${row.state}`
                  : row.city ?? row.state ?? '—'
                const updatedAt = row.client_updated_at
                  ? new Date(row.client_updated_at).toLocaleDateString('pt-BR')
                  : '—'
                const statusClass =
                  (row.contract_status ? CONTRACT_STATUS_CLASS[row.contract_status] : null) ?? 'fm-badge'
                return (
                  <tr key={row.client_id}>
                    <td>{row.client_name ?? '—'}</td>
                    <td>{formatCpfCnpj(row.document_key)}</td>
                    <td>{location}</td>
                    <td>
                      {row.contract_type ? (
                        <span className={`fm-badge fm-badge--${row.contract_type}`}>
                          {CONTRACT_TYPE_LABELS[row.contract_type] ?? row.contract_type}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {row.contract_status ? (
                        <span className={statusClass}>
                          {CONTRACT_STATUS_LABELS[row.contract_status] ?? row.contract_status}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{updatedAt}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RevenueAndBillingPage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Receita e Cobrança page.
 *
 * Delegates entirely to FinancialManagementPage but overrides the "Projetos"
 * tab with DeduplicatedProjectsTab, which calls the deduplicated server
 * endpoint and guarantees one row per canonical active client.
 */
export function RevenueAndBillingPage({ onBack, initialProjectId }: Props) {
  return (
    <FinancialManagementPage
      onBack={onBack}
      {...(initialProjectId != null ? { initialProjectId } : {})}
      projectsTabOverride={<DeduplicatedProjectsTab />}
    />
  )
}
