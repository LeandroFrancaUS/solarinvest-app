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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">Detalhamento</h3>
        <span className="text-xs text-slate-400">{records.length} registros</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort('consultant')}>
                Consultor{arrow('consultant')}
              </th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort('city')}>
                Cidade{arrow('city')}
              </th>
              <th className="px-4 py-2">UF</th>
              <th className="cursor-pointer px-4 py-2 text-right" onClick={() => toggleSort('contractValue')}>
                Valor{arrow('contractValue')}
              </th>
              <th className="cursor-pointer px-4 py-2 text-right" onClick={() => toggleSort('consumption')}>
                Consumo{arrow('consumption')}
              </th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort('closedAt')}>
                Fechamento{arrow('closedAt')}
              </th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
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
                <td className="px-4 py-2 text-slate-500">
                  {r.closedAt ? new Date(r.closedAt).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-2">
                  {r.isClosed ? (
                    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Fechado
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Aberto
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs text-emerald-600 disabled:text-slate-300"
          >
            ← Anterior
          </button>
          <span className="text-xs text-slate-400">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs text-emerald-600 disabled:text-slate-300"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
