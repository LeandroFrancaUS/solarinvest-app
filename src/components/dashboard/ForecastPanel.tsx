// src/components/dashboard/ForecastPanel.tsx
import type { Forecast } from '../../domain/analytics/types.js'

type Props = {
  forecast: Forecast
}

const CONFIDENCE_LABELS: Record<Forecast['confidence'], { text: string; className: string }> = {
  low: { text: 'Baixa', className: 'bg-ds-danger/15 text-ds-danger border border-ds-danger/30' },
  medium: { text: 'Média', className: 'bg-ds-warning/15 text-ds-warning border border-ds-warning/30' },
  high: { text: 'Alta', className: 'bg-ds-success/15 text-ds-success border border-ds-success/30' },
}

export function ForecastPanel({ forecast }: Props) {
  const total = forecast.next30Days.reduce((a, b) => a + b, 0)
  const conf = CONFIDENCE_LABELS[forecast.confidence]

  return (
    <div className="rounded-xl border border-ds-border bg-ds-surface p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ds-text-primary">Previsão – Próximos 30 dias</h3>

      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-ds-text-primary">
          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${conf.className}`}>
          Confiança: {conf.text}
        </span>
      </div>

      <p className="mt-2 text-xs text-ds-text-muted">
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
              className="flex-1 rounded-t bg-ds-primary opacity-60 hover:opacity-100 transition-opacity"
              style={{ height: `${h}%` }}
              title={`Dia ${i + 1}: ${v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            />
          )
        })}
      </div>
    </div>
  )
}

