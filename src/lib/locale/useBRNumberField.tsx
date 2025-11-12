import * as React from 'react'
import { formatMoneyBR, formatNumberBR, toNumberFlexible } from './br-number'

type Mode = 'number' | 'money' | 'percent'

export const MONEY_INPUT_PLACEHOLDER = 'Ex.: R$ 0,00'

function formatMoneyForEditing(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return ''
  }
  const numeric = Number(value)
  const [integer, decimals] = Math.abs(numeric).toFixed(2).split('.')
  const sign = numeric < 0 ? '-' : ''
  return `${sign}${integer}${decimals ? `,${decimals}` : ''}`
}

function sanitizeMoneyInput(raw: string): string {
  const withoutCurrency = raw.replace(/[^0-9,.-]/g, '').replace(/\./g, '')
  const [integer = '', ...decimalParts] = withoutCurrency.split(',')
  const decimals = decimalParts.join('')
  const sanitizedDecimals = decimals ? `,${decimals}` : ''
  const sign = integer.startsWith('-') ? '-' : ''
  const absoluteInteger = integer.replace(/^-/, '')
  return `${sign}${absoluteInteger}${sanitizedDecimals}`
}

export function useBRNumberField({
  mode = 'number',
  value,
  onChange,
}: {
  mode?: Mode
  value?: number | null
  onChange?: (n: number | null) => void
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const latestValueRef = React.useRef<number | null>(
    Number.isFinite(value ?? NaN) ? Number(value) : null,
  )

  const formatValue = React.useCallback(
    (input: number | null | undefined) => {
      if (input == null || !Number.isFinite(input)) {
        return ''
      }
      if (mode === 'money') {
        return formatMoneyBR(input)
      }
      return formatNumberBR(input)
    },
    [mode],
  )

  const [text, setText] = React.useState<string>(() => formatValue(value ?? null))

  React.useEffect(() => {
    latestValueRef.current = Number.isFinite(value ?? NaN) ? Number(value) : null
  }, [value])

  React.useEffect(() => {
    if (isEditing) {
      return
    }

    const element = ref.current
    if (typeof document === 'undefined' || document.activeElement === element) {
      return
    }

    setText(formatValue(value ?? null))
  }, [formatValue, isEditing, value])

  const commitMoneyValue = React.useCallback(
    (rawText: string) => {
      const parsed = toNumberFlexible(rawText)
      if (!Number.isFinite(parsed ?? NaN)) {
        onChange?.(null)
        setText('')
        return
      }

      const numericValue = Number(parsed)
      onChange?.(numericValue)
      setText(formatMoneyBR(numericValue))
    },
    [onChange],
  )

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    if (mode === 'money') {
      const sanitized = sanitizeMoneyInput(raw)
      setText(sanitized)

      if (!sanitized) {
        onChange?.(null)
        return
      }

      const parsed = toNumberFlexible(sanitized)
      if (!Number.isFinite(parsed ?? NaN)) {
        onChange?.(null)
        return
      }

      onChange?.(Number(parsed))
      return
    }

    setText(raw)
    onChange?.(toNumberFlexible(raw))
  }

  function handleBlur() {
    setIsEditing(false)

    if (mode === 'money') {
      if (!text.trim()) {
        onChange?.(null)
        setText('')
        return
      }

      commitMoneyValue(text)
      return
    }

    const nextValue = toNumberFlexible(text)
    onChange?.(nextValue)
    setText(formatValue(nextValue))
  }

  const handleFocus = React.useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (mode !== 'money') {
        return
      }

      setIsEditing(true)

      const numeric = latestValueRef.current
      if (numeric == null) {
        setText('')
        return
      }

      const editingValue = formatMoneyForEditing(numeric)
      setText(editingValue)

      // Ensure the DOM input mirrors the latest editing value when focus is triggered programmatically.
      if (event.currentTarget.value !== editingValue) {
        event.currentTarget.value = editingValue
      }
    },
    [mode],
  )

  return { ref, text, setText, handleChange, handleBlur, handleFocus }
}
