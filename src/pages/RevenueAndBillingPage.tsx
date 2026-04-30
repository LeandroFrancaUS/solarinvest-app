// src/pages/RevenueAndBillingPage.tsx
// Receita e Cobrança — wraps FinancialManagementPage with a "Projetos" tab
// backed by /api/revenue-billing/projects.
//
// SEMANTICS
// ─────────
// The Projetos tab lists the portfolio clients from the Carteira Ativa —
// one row per client where clients.in_portfolio = true (same filter as
// Carteira Ativa). The query is backed by the clients table, not by the
// public.projects operational-project table.
//
// Deduplication: one row per client.id (no CPF/CNPJ collapsing).
// Project status: sourced from client_project_status (Carteira tracking table).
// Contract type/status: LATERAL join picks the most relevant contract per client.
//
// All other tabs (Visão Geral, Fluxo de Caixa, Leasing, Vendas, Faturas)
// are delegated to FinancialManagementPage unchanged.

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { FinancialManagementPage } from './FinancialManagementPage'
import {
  fetchRevenueProjects,
  type RevenueProjectRow,
  type RevenueProjectsFilters,
} from '../services/revenueBillingApi'
import { formatCpfCnpj } from '../lib/format/document'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
  initialProjectId?: string | null
}

type SortKey = 'client' | 'document' | 'location' | 'contract_type' | 'project_status' | 'updated_at'

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

/** Status labels for client_project_status.project_status values */
const PROJECT_STATUS_LABELS: Record<string, string> = {
  pending:       'Pendente',
  engineering:   'Engenharia',
  installation:  'Instalação',
  homologation:  'Homologação',
  commissioned:  'Comissionado',
  active:        'Ativo',
  issue:         'Problema',
}

const PROJECT_STATUS_CLASS: Record<string, string> = {
  active:       'fm-badge fm-badge--project-status-concluido',
  commissioned: 'fm-badge fm-badge--project-status-concluido',
  installation: 'fm-badge fm-badge--project-status-andamento',
  homologation: 'fm-badge fm-badge--project-status-andamento',
  engineering:  'fm-badge fm-badge--project-status-andamento',
  pending:      'fm-badge',
  issue:        'fm-badge fm-badge--danger',
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
// ProjectsTab
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders one row per portfolio client (clients.in_portfolio = true) from
 * /api/revenue-billing/projects. Same data set as the Carteira Ativa.
 */
function ProjectsTab() {
  const [rows, setRows]           = useState<RevenueProjectRow[]>([])
  const [total, setTotal]         = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (filters: RevenueProjectsFilters = {}) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchRevenueProjects({ limit: 500, ...filters })
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

  function sortIcon(key: SortKey): string {
    if (sortState?.key !== key) return ' ↕'
    return sortState.direction === 'asc' ? ' ↑' : ' ↓'
  }

  const sortedRows = useMemo(() => {
    if (!sortState) return rows
    return [...rows].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown
      switch (sortState.key) {
        case 'client':
          aVal = a.client_name; bVal = b.client_name; break
        case 'document':
          aVal = a.document_key; bVal = b.document_key; break
        case 'location':
          aVal = [a.city, a.state].filter(Boolean).join(' / ')
          bVal = [b.city, b.state].filter(Boolean).join(' / ')
          break
        case 'contract_type':
          aVal = a.contract_type; bVal = b.contract_type; break
        case 'project_status':
          aVal = a.project_status; bVal = b.project_status; break
        default:
          aVal = a.updated_at; bVal = b.updated_at
      }
      const cmp = sortCompare(aVal, bVal)
      return sortState.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, sortState])

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
          {total > 0 ? `${total} projeto${total !== 1 ? 's' : ''}` : null}
        </span>
      </div>

      {sortedRows.length === 0 ? (
        <div className="fm-empty">Nenhum projeto encontrado com os filtros aplicados.</div>
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
                <th style={thStyle} onClick={() => toggleSort('project_status')}>
                  Status do Projeto{sortIcon('project_status')}
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
                const updatedAt = row.updated_at
                  ? new Date(row.updated_at).toLocaleDateString('pt-BR')
                  : '—'
                const statusClass =
                  (row.project_status ? PROJECT_STATUS_CLASS[row.project_status] : null) ?? 'fm-badge'
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
                      {row.project_status ? (
                        <span className={statusClass}>
                          {PROJECT_STATUS_LABELS[row.project_status] ?? row.project_status}
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
 * tab with ProjectsTab, which shows the same portfolio clients as Carteira
 * Ativa (clients.in_portfolio = true), one row per client.
 */
export function RevenueAndBillingPage({ onBack, initialProjectId }: Props) {
  return (
    <FinancialManagementPage
      onBack={onBack}
      {...(initialProjectId != null ? { initialProjectId } : {})}
      projectsTabOverride={<ProjectsTab />}
    />
  )
}
