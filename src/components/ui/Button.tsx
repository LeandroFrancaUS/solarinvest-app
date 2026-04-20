/**
 * Button — Componente de botão padronizado do Design System SolarInvest
 *
 * Variantes: primary | success | danger | ghost
 * Tamanhos: sm | md (padrão) | lg
 */

import React from 'react'

export type ButtonVariant = 'primary' | 'success' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-ds-primary hover:bg-ds-primary-hover text-white border border-transparent shadow-md',
  success:
    'bg-ds-success hover:bg-ds-success-hover text-white border border-transparent shadow-md',
  danger:
    'bg-ds-danger hover:bg-ds-danger-hover text-white border border-transparent shadow-md',
  ghost:
    'bg-transparent hover:bg-white/10 text-ds-text-secondary hover:text-ds-text-primary border border-ds-border hover:border-ds-primary/40',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-6 py-3 text-base min-h-[48px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
        'transition-all duration-200 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ds-background',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : icon && iconPosition === 'left' ? (
        <span className="shrink-0" aria-hidden="true">{icon}</span>
      ) : null}

      {children}

      {!loading && icon && iconPosition === 'right' ? (
        <span className="shrink-0" aria-hidden="true">{icon}</span>
      ) : null}
    </button>
  )
}
