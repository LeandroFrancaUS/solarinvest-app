import React from 'react'
import type { KpiSummary } from '../../services/operationalDashboardApi'

interface KpiCardProps {
  label: string
  value: number | string
  icon: string
  colorClass: string
}

function KpiCard({ label, value, icon, colorClass }: KpiCardProps) {
  return (
    <div className={`rounded-lg border p-4 flex items-center gap-3 ${colorClass}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}

interface OperationalKpiCardsProps {
  kpi: KpiSummary | null
  loading?: boolean
}

export function OperationalKpiCards({ kpi, loading }: OperationalKpiCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 animate-pulse bg-gray-100 h-20" />
        ))}
      </div>
    )
  }

  if (!kpi) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard label="Tarefas Ativas" value={kpi.active_tasks} icon="📋" colorClass="bg-white border-gray-200" />
      <KpiCard label="Bloqueadas" value={kpi.blocked_tasks} icon="🚫" colorClass="bg-red-50 border-red-200" />
      <KpiCard label="Críticas" value={kpi.critical_tasks} icon="⚠️" colorClass="bg-orange-50 border-orange-200" />
      <KpiCard label="Entregas Pendentes" value={kpi.pending_deliveries} icon="📦" colorClass="bg-blue-50 border-blue-200" />
    </div>
  )
}
