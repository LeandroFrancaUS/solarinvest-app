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
  default: 'bg-ds-table-header text-ds-text-secondary border border-ds-border',
  primary: 'bg-ds-primary-soft text-ds-primary border border-[var(--border-strong)]',
  success: 'bg-[var(--color-success-bg)] text-ds-success border border-[var(--color-success-border)]',
  danger: 'bg-[var(--color-error-bg)] text-ds-danger border border-[var(--color-error-border)]',
  warning: 'bg-[var(--color-warning-bg)] text-ds-warning border border-[var(--color-warning-border)]',
  muted: 'bg-ds-ghost text-ds-text-muted border border-ds-border',
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
