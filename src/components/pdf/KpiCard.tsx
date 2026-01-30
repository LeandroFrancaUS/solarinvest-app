import React from 'react'

interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  variant?: 'default' | 'highlight' | 'accent'
  className?: string
}

/**
 * KpiCard - Large value display for key performance indicators
 * Perfect for metrics like kWp, kWh/month, percentages
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  variant = 'default',
  className = '',
}) => {
  const variantClasses = {
    default: 'bg-white border-slate-200',
    highlight: 'bg-solar-brand/10 border-solar-brand/30',
    accent: 'bg-solar-accent/10 border-solar-accent/30',
  }

  const valueColor = {
    default: 'text-slate-900',
    highlight: 'text-solar-brand',
    accent: 'text-solar-accent',
  }

  return (
    <div className={`bg-white rounded-3xl border shadow-sm p-6 break-inside-avoid ${variantClasses[variant]} ${className}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className={`text-4xl md:text-5xl font-extrabold ${valueColor[variant]}`}>
          {value}
        </p>
        {unit && (
          <span className="text-lg text-slate-600 font-medium">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
