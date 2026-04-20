// src/components/dashboard/DashboardFilters.tsx
import { useState } from 'react'
import type { DashboardFilters as Filters } from '../../domain/analytics/types.js'

type Props = {
  filters: Filters
  onChange: (filters: Filters) => void
  availableConsultants: string[]
  availableStates: string[]
  availableRegions: string[]
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo o período' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: 'ytd', label: 'Ano atual' },
  { value: 'custom', label: 'Personalizado' },
]

export function DashboardFiltersPanel({ filters, onChange, availableConsultants, availableStates, availableRegions }: Props) {
  const [expanded, setExpanded] = useState(false)

  const update = (patch: Partial<Filters>) => {
    onChange({ ...filters, ...patch })
  }

  const toggleArrayItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]

  return (
    <div className="rounded-xl border border-ds-border bg-ds-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Period selector */}
        <select
          value={filters.period}
          onChange={(e) => update({ period: e.target.value })}
          className="rounded-lg border border-ds-border bg-ds-input-bg px-3 py-2 text-sm text-ds-text-primary focus:border-ds-primary focus:outline-none focus:ring-1 focus:ring-ds-primary/40"
          aria-label="Período"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Custom date range */}
        {filters.period === 'custom' && (
          <>
            <input
              type="date"
              value={filters.startDate ?? ''}
              onChange={(e) => update({ startDate: e.target.value || null })}
              className="rounded-lg border border-ds-border bg-ds-input-bg px-3 py-2 text-sm text-ds-text-primary focus:border-ds-primary focus:outline-none"
              aria-label="Data inicial"
            />
            <input
              type="date"
              value={filters.endDate ?? ''}
              onChange={(e) => update({ endDate: e.target.value || null })}
              className="rounded-lg border border-ds-border bg-ds-input-bg px-3 py-2 text-sm text-ds-text-primary focus:border-ds-primary focus:outline-none"
              aria-label="Data final"
            />
          </>
        )}

        {/* Toggle advanced filters */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="ml-auto cursor-pointer text-sm text-ds-primary hover:text-ds-primary-hover transition-colors"
        >
          {expanded ? 'Menos filtros ▲' : 'Mais filtros ▼'}
        </button>
      </div>

      {/* Advanced filters */}
      {expanded && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Consultants */}
          {availableConsultants.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Consultor</legend>
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                {availableConsultants.map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-1.5 text-sm text-ds-text-secondary hover:text-ds-text-primary">
                    <input
                      type="checkbox"
                      checked={filters.consultants.includes(c)}
                      onChange={() => update({ consultants: toggleArrayItem(filters.consultants, c) })}
                      className="accent-ds-primary"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* States */}
          {availableStates.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Estado</legend>
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                {availableStates.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-1.5 text-sm text-ds-text-secondary hover:text-ds-text-primary">
                    <input
                      type="checkbox"
                      checked={filters.states.includes(s)}
                      onChange={() => update({ states: toggleArrayItem(filters.states, s) })}
                      className="accent-ds-primary"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Regions */}
          {availableRegions.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Região</legend>
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                {availableRegions.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-1.5 text-sm text-ds-text-secondary hover:text-ds-text-primary">
                    <input
                      type="checkbox"
                      checked={filters.regions.includes(r)}
                      onChange={() => update({ regions: toggleArrayItem(filters.regions, r) })}
                      className="accent-ds-primary"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Value range */}
          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Valor (R$)</legend>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Mín"
                value={filters.minValue ?? ''}
                onChange={(e) => update({ minValue: e.target.value ? Number(e.target.value) : null })}
                className="w-24 rounded-lg border border-ds-border bg-ds-input-bg px-2 py-1.5 text-sm text-ds-text-primary placeholder-ds-text-muted focus:border-ds-primary focus:outline-none"
                aria-label="Valor mínimo"
              />
              <span className="text-ds-text-muted">–</span>
              <input
                type="number"
                placeholder="Máx"
                value={filters.maxValue ?? ''}
                onChange={(e) => update({ maxValue: e.target.value ? Number(e.target.value) : null })}
                className="w-24 rounded-lg border border-ds-border bg-ds-input-bg px-2 py-1.5 text-sm text-ds-text-primary placeholder-ds-text-muted focus:border-ds-primary focus:outline-none"
                aria-label="Valor máximo"
              />
            </div>
          </fieldset>
        </div>
      )}
    </div>
  )
}

