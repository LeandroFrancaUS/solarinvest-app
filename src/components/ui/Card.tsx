/**
 * Card — Componente de cartão padronizado do Design System SolarInvest
 *
 * Background: ds-surface
 * Border-radius: 10px
 * Padding: 16px
 * Shadow leve
 */

import React from 'react'

export interface CardProps {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({
  children,
  title,
  subtitle,
  actions,
  className = '',
  padding = 'md',
  hoverable = false,
}: CardProps) {
  const hasHeader = Boolean(title || subtitle || actions)

  return (
    <div
      className={[
        'bg-ds-surface border border-ds-border rounded-xl',
        'shadow-sm',
        hoverable ? 'transition-all duration-200 hover:bg-ds-surface-hover hover:border-ds-primary/30 hover:shadow-md cursor-pointer' : '',
        paddingStyles[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasHeader ? (
        <div className={`flex items-start justify-between gap-3 ${padding !== 'none' ? 'mb-4' : 'p-4 pb-0'}`}>
          <div className="min-w-0 flex-1">
            {title ? (
              <h3 className="text-base font-semibold text-ds-text-primary leading-tight">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-xs text-ds-text-muted">{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}

      {hasHeader && padding === 'none' ? <div className="p-4">{children}</div> : children}
    </div>
  )
}
