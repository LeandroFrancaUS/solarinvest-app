// src/components/dashboard/ForecastPanel.tsx
import type { Forecast } from '../../domain/analytics/types.js'

type Props = {
  forecast: Forecast
}

const CONFIDENCE_LABELS: Record<Forecast['confidence'], { text: string; color: string }> = {
  low: { text: 'Baixa', color: 'text-red-600 bg-red-50' },
  medium: { text: 'Média', color: 'text-amber-600 bg-amber-50' },
  high: { text: 'Alta', color: 'text-emerald-600 bg-emerald-50' },
}

export function ForecastPanel({ forecast }: Props) {
  const total = forecast.next30Days.reduce((a, b) => a + b, 0)
  const conf = CONFIDENCE_LABELS[forecast.confidence]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Previsão – Próximos 30 dias</h3>

      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-slate-800">
          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${conf.color}`}>
          Confiança: {conf.text}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {forecast.confidence === 'low'
          ? 'Poucos dados disponíveis — a previsão pode variar significativamente.'
          : forecast.confidence === 'medium'
            ? 'Base de dados razoável — previsão indicativa.'
            : 'Base de dados sólida — previsão confiável.'}
      </p>

      {/* Mini bar visualization */}
      <div className="mt-3 flex h-10 items-end gap-px">
        {forecast.next30Days.map((v, i) => {
          const max = Math.max(...forecast.next30Days, 1)
          const h = Math.max(2, (v / max) * 100)
          return (
            <div
              key={`day-${i + 1}`}
              className="flex-1 rounded-t bg-indigo-400 opacity-70"
              style={{ height: `${h}%` }}
              title={`Dia ${i + 1}: ${v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            />
          )
        })}
      </div>
    </div>
  )
}
