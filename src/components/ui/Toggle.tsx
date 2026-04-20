/**
 * Toggle — Componente de seleção em abas/pills padronizado do Design System SolarInvest
 *
 * Segue o padrão de container pill com item ativo destacado.
 * Usa exclusivamente tokens semânticos do design system.
 */

import React from 'react'

export interface ToggleOption {
  label: string
  value: string
  disabled?: boolean
}

export interface ToggleProps {
  value: string
  onChange: (value: string) => void
  options: ToggleOption[]
  className?: string
}

export function Toggle({ value, onChange, options, className = '' }: ToggleProps) {
  return (
    <div
      className={`inline-flex rounded-full bg-ds-table-header border border-ds-border p-1 gap-1 ${className}`}
      role="group"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => !option.disabled && onChange(option.value)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-focus-ring)] focus-visible:ring-offset-1',
              active
                ? 'bg-ds-primary text-white shadow-sm'
                : 'text-ds-text-secondary hover:bg-ds-ghost-hover hover:text-ds-text-primary',
              option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
