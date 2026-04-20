// src/components/dashboard/DrilldownTable.tsx
import { useState, useMemo } from 'react'
import type { AnalyticsRecord } from '../../domain/analytics/types.js'

type Props = {
  records: AnalyticsRecord[]
}

type SortKey = 'closedAt' | 'contractValue' | 'consumption' | 'city' | 'consultant'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

export function DrilldownTable({ records }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('closedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    const arr = [...records]
    arr.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
    return arr
  }, [records, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <div className="rounded-xl border border-ds-border bg-ds-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-ds-border px-4 py-3">
        <h3 className="text-sm font-semibold text-ds-text-primary">Detalhamento</h3>
        <span className="text-xs text-ds-text-muted">{records.length} registros</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ds-border bg-ds-background/40 text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
            <tr>
              <th className="cursor-pointer px-4 py-2 hover:text-ds-text-primary transition-colors" onClick={() => toggleSort('consultant')}>
                Consultor{arrow('consultant')}
              </th>
              <th className="cursor-pointer px-4 py-2 hover:text-ds-text-primary transition-colors" onClick={() => toggleSort('city')}>
                Cidade{arrow('city')}
              </th>
              <th className="px-4 py-2">UF</th>
              <th className="cursor-pointer px-4 py-2 text-right hover:text-ds-text-primary transition-colors" onClick={() => toggleSort('contractValue')}>
                Valor{arrow('contractValue')}
              </th>
              <th className="cursor-pointer px-4 py-2 text-right hover:text-ds-text-primary transition-colors" onClick={() => toggleSort('consumption')}>
                Consumo{arrow('consumption')}
              </th>
              <th className="cursor-pointer px-4 py-2 hover:text-ds-text-primary transition-colors" onClick={() => toggleSort('closedAt')}>
                Fechamento{arrow('closedAt')}
              </th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((r) => (
              <tr key={r.id} className="border-b border-ds-border/40 text-ds-text-secondary transition-colors hover:bg-ds-surface-hover/60">
                <td className="px-4 py-2">{r.consultant ?? '—'}</td>
                <td className="px-4 py-2">{r.city ?? '—'}</td>
                <td className="px-4 py-2">{r.state ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  {r.contractValue != null
                    ? r.contractValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.consumption != null
                    ? `${r.consumption.toLocaleString('pt-BR')} kWh`
                    : '—'}
                </td>
                <td className="px-4 py-2 text-ds-text-muted">
                  {r.closedAt ? new Date(r.closedAt).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-2">
                  {r.isClosed ? (
                    <span className="inline-block rounded-full bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-2 py-0.5 text-xs font-medium text-ds-success">
                      Fechado
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-ds-ghost border border-ds-border px-2 py-0.5 text-xs font-medium text-ds-text-muted">
                      Aberto
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ds-text-muted">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ds-border px-4 py-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="cursor-pointer text-xs text-ds-primary hover:text-ds-primary-hover transition-colors disabled:text-ds-text-muted disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          <span className="text-xs text-ds-text-muted">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="cursor-pointer text-xs text-ds-primary hover:text-ds-primary-hover transition-colors disabled:text-ds-text-muted disabled:cursor-not-allowed"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}

