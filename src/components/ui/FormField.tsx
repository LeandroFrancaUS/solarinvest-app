/**
 * FormField — Wrapper padronizado de campo de formulário do Design System SolarInvest
 *
 * Envolve qualquer input/select/textarea com label, hint e mensagem de erro
 * respeitando as regras de contraste e hierarquia tipográfica do DS.
 */

import React from 'react'

export interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  hint,
  error,
  required = false,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-semibold text-ds-text-secondary uppercase tracking-wide">
        {label}
        {required ? (
          <span className="ml-1 text-ds-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {children}

      {error ? (
        <p className="text-xs text-ds-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ds-text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
