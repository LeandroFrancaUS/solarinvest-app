/**
 * Badge — Componente de etiqueta/status padronizado do Design System SolarInvest
 *
 * Variantes: default | primary | success | danger | warning | muted
 */

import React from 'react'

export type BadgeVariant = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'muted'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-ds-border/60 text-ds-text-secondary border border-ds-border',
  primary: 'bg-ds-primary/15 text-ds-primary border border-ds-primary/30',
  success: 'bg-ds-success/15 text-ds-success border border-ds-success/30',
  danger: 'bg-ds-danger/15 text-ds-danger border border-ds-danger/30',
  warning: 'bg-ds-warning/15 text-ds-warning border border-ds-warning/30',
  muted: 'bg-white/5 text-ds-text-muted border border-ds-border',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-ds-text-secondary',
  primary: 'bg-ds-primary',
  success: 'bg-ds-success',
  danger: 'bg-ds-danger',
  warning: 'bg-ds-warning',
  muted: 'bg-ds-text-muted',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot ? (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dotColors[variant]}`}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  )
}
