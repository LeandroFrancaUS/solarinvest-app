import React from 'react'

interface ListItem {
  label: string
  value?: string
  icon?: string
}

interface ListCardProps {
  title: string
  items: ListItem[]
  variant?: 'default' | 'compact'
  className?: string
}

/**
 * ListCard - Structured list display without HTML tables
 * Supports label/value pairs or simple bullet lists
 */
export const ListCard: React.FC<ListCardProps> = ({
  title,
  items,
  variant = 'default',
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-6 break-inside-avoid ${className}`}>
      <h3 className="text-base font-bold text-slate-800 tracking-tight mb-4">
        {title}
      </h3>
      <div className={`space-y-${variant === 'compact' ? '2' : '3'}`}>
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            {item.icon && (
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">
                {item.icon}
              </span>
            )}
            <div className="flex-1 min-w-0">
              {item.value ? (
                // Label/value pair
                <div className="flex justify-between items-baseline gap-4">
                  <span className="text-sm text-slate-600 font-medium">
                    {item.label}
                  </span>
                  <span className="text-sm text-slate-900 font-semibold text-right">
                    {item.value}
                  </span>
                </div>
              ) : (
                // Simple bullet list
                <div className="flex items-start gap-2">
                  {!item.icon && (
                    <span className="text-solar-brand text-sm mt-0.5">•</span>
                  )}
                  <span className="text-sm text-slate-700 leading-relaxed">
                    {item.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
