import { toNumberFlexible } from '../lib/locale/br-number'
import type { ImpostosRegimeConfig } from '../lib/venda/calcComposicaoUFV'

export const toNumberSafe = (value: number | null | undefined): number =>
  Number.isFinite(value) ? Number(value) : 0

export const parseNumericInput = (value: string): number | null => {
  if (!value) {
    return null
  }
  return toNumberFlexible(value)
}

export const cloneImpostosOverrides = (
  overrides?: Partial<ImpostosRegimeConfig> | null,
): Partial<ImpostosRegimeConfig> => {
  if (!overrides) {
    return {}
  }
  const cloned: Partial<ImpostosRegimeConfig> = {}
  for (const regime of ['simples', 'lucro_presumido', 'lucro_real'] as const) {
    if (Array.isArray(overrides[regime])) {
      cloned[regime] = overrides[regime].map((item) => ({ ...item }))
    }
  }
  return cloned
}
