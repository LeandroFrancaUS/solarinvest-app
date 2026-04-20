/**
 * Input — Componente de campo de entrada padronizado do Design System SolarInvest
 */

import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftAddon?: React.ReactNode
  rightAddon?: React.ReactNode
  fullWidth?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftAddon,
      rightAddon,
      fullWidth = false,
      id,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={`flex flex-col gap-1 ${fullWidth ? 'w-full' : ''}`}>
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-ds-text-secondary uppercase tracking-wide"
          >
            {label}
          </label>
        ) : null}

        <div className="relative flex items-center">
          {leftAddon ? (
            <span className="absolute left-3 flex items-center text-ds-text-muted pointer-events-none">
              {leftAddon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full rounded-lg border text-ds-text-primary placeholder-ds-text-muted',
              'bg-ds-input-bg border-ds-border',
              'px-3 py-2 text-sm',
              'transition-all duration-200',
              'focus:outline-none focus:border-ds-primary focus:ring-1 focus:ring-ds-primary/40',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error ? 'border-ds-danger focus:border-ds-danger focus:ring-ds-danger/40' : '',
              leftAddon ? 'pl-9' : '',
              rightAddon ? 'pr-9' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...rest}
          />

          {rightAddon ? (
            <span className="absolute right-3 flex items-center text-ds-text-muted pointer-events-none">
              {rightAddon}
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="text-xs text-ds-danger">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ds-text-muted">{hint}</p>
        ) : null}
      </div>
    )
  },
)

Input.displayName = 'Input'
