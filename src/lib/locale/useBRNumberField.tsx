import * as React from 'react'
import { formatMoneyBR, formatNumberBR, toNumberFlexible } from './br-number'

type Mode = 'number' | 'money' | 'percent'

export const MONEY_INPUT_PLACEHOLDER = 'Ex.: R$ 0,00'

function sanitizeMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9,.-]/g, '')
  if (!cleaned) {
    return ''
  }

  const sign = cleaned.startsWith('-') ? '-' : ''
  const unsigned = cleaned.replace(/-/g, '')
  const lastComma = unsigned.lastIndexOf(',')
  const lastDot = unsigned.lastIndexOf('.')
  const decimalIndex = Math.max(lastComma, lastDot)

  if (decimalIndex === -1) {
    const integerDigits = unsigned.replace(/[^0-9]/g, '')
    return `${sign}${integerDigits}`
  }

  const integerPartRaw = unsigned.slice(0, decimalIndex)
  const decimalPartRaw = unsigned.slice(decimalIndex + 1)
  const integerDigits = integerPartRaw.replace(/[^0-9]/g, '')
  const decimalDigits = decimalPartRaw.replace(/[^0-9]/g, '')

  if (!decimalDigits) {
    return `${sign}${integerDigits},`
  }

  return `${sign}${integerDigits},${decimalDigits}`
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
  const editingSessionRef = React.useRef<{ initialValue: number | null; hasTyped: boolean }>(
    { initialValue: null, hasTyped: false },
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

      if (!editingSessionRef.current.hasTyped && sanitized.length > 0) {
        editingSessionRef.current.hasTyped = true
      }

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
        const { initialValue, hasTyped } = editingSessionRef.current
        if (hasTyped) {
          onChange?.(null)
          setText('')
        } else {
          const fallback = Number.isFinite(initialValue ?? NaN) ? Number(initialValue) : null
          setText(formatMoneyBR(fallback))
        }
        editingSessionRef.current = { initialValue: null, hasTyped: false }
        return
      }

      commitMoneyValue(text)
      editingSessionRef.current = { initialValue: null, hasTyped: false }
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

      editingSessionRef.current = {
        initialValue: latestValueRef.current,
        hasTyped: false,
      }

      setText('')

      if (event.currentTarget.value !== '') {
        event.currentTarget.value = ''
      }
    },
    [mode],
  )

  return { ref, text, setText, handleChange, handleBlur, handleFocus }
}

export type UseBRNumberFieldResult = ReturnType<typeof useBRNumberField>
