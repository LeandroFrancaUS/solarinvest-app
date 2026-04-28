// src/features/simulacoes/simulacoesTypes.ts
// Shared structural types for the Simulações feature.

import type React from 'react'

// Structural type matching the return value of useBRNumberField.
export type MoneyFieldHandle = {
  ref: React.RefObject<HTMLInputElement>
  text: string
  setText: React.Dispatch<React.SetStateAction<string>>
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleBlur: () => void
  handleFocus: (event: React.FocusEvent<HTMLInputElement>) => void
}
