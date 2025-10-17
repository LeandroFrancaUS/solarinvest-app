import * as React from 'react'
import { formatMoneyBR, formatNumberBR, toNumberFlexible } from './br-number'

type Mode = 'number' | 'money' | 'percent'

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
    const element = ref.current
    if (typeof document === 'undefined' || document.activeElement === element) {
      return
    }
    setText(formatValue(value ?? null))
  }, [formatValue, value])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    setText(raw)
    onChange?.(toNumberFlexible(raw))
  }

  function handleBlur() {
    const nextValue = toNumberFlexible(text)
    onChange?.(nextValue)
    setText(formatValue(nextValue))
  }

  return { ref, text, setText, handleChange, handleBlur }
}
