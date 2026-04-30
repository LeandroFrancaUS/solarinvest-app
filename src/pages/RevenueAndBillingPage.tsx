// src/pages/RevenueAndBillingPage.tsx
// Receita e Cobrança — wraps FinancialManagementPage with a "Projetos" tab
// backed by /api/revenue-billing/projects (one row per active project).
//
// SEMANTICS
// ─────────
// The Projetos tab lists PROJECTS (not clients). Each row corresponds to one
// project record in the `projects` table whose linked client is activated
// (in_portfolio = true, portfolio_exported_at IS NOT NULL, or has at least one
// active contract). The query is rooted in `projects`, so duplicated client
// rows in the `clients` table cannot inflate the count.
//
// A client with two distinct closed projects may appear twice — once per
// project. CPF/CNPJ deduplication across client rows is NOT applied here;
// dedup by document is only meaningful when listing clients, not projects.
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

type SortKey = 'client' | 'document' | 'location' | 'project_type' | 'project_status' | 'updated_at'

interface SortState {
  key: SortKey
  direction: 'asc' | 'desc'
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_TYPE_LABELS: Record<string, string> = {
  leasing: 'Leasing',
  venda:   'Venda',
}

const PROJECT_STATUS_CLASS: Record<string, string> = {
  'Concluído':    'fm-badge fm-badge--project-status-concluido',
  'Em andamento': 'fm-badge fm-badge--project-status-andamento',
  'Aguardando':   'fm-badge',
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
 * Renders one row per active project from the server endpoint
 * /api/revenue-billing/projects.
 *
 * The server guarantees that the list is rooted in the projects table, so
 * each row is a real project — not a client. Deduplication is by project.id.
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
        case 'project_type':
          aVal = a.project_type; bVal = b.project_type; break
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
            <option value="venda">Venda</option>
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
                <th style={thStyle} onClick={() => toggleSort('project_type')}>
                  Tipo{sortIcon('project_type')}
                </th>
                <th style={thStyle} onClick={() => toggleSort('project_status')}>
                  Status{sortIcon('project_status')}
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
                  <tr key={row.project_id}>
                    <td>{row.client_name ?? '—'}</td>
                    <td>{formatCpfCnpj(row.document_key)}</td>
                    <td>{location}</td>
                    <td>
                      {row.project_type ? (
                        <span className={`fm-badge fm-badge--${row.project_type}`}>
                          {PROJECT_TYPE_LABELS[row.project_type] ?? row.project_type}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {row.project_status ? (
                        <span className={statusClass}>
                          {row.project_status}
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
 * tab with ProjectsTab, which calls /api/revenue-billing/projects and returns
 * one row per active project (not per client).
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
