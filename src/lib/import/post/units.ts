import { toNumberFlexible } from '../../locale/br-number'

const UNIT_ALIASES: Record<string, string> = {
  un: 'UN',
  unidade: 'UN',
  unidades: 'UN',
  pcs: 'UN',
  pçs: 'UN',
  pecas: 'UN',
  peças: 'UN',
  kit: 'KIT',
  kits: 'KIT',
  modulo: 'MOD',
  módulos: 'MOD',
  modulos: 'MOD',
  kva: 'KVA',
  kwp: 'KWP',
}

const TRAILING_QUANTITY_REGEX = /^(?:qtd|qtde|quantidade)?\s*[:=-]?\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*(\p{L}+)?$/iu

export type QuantityParseResult = {
  quantity: number | null
  unit: string | null
}

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) {
    return null
  }
  const normalized = unit.toLowerCase().replace(/[^\p{L}]/gu, '')
  if (!normalized) {
    return null
  }
  const alias = UNIT_ALIASES[normalized]
  return (alias ?? normalized.toUpperCase()).slice(0, 5)
}

export function parseQuantityToken(token: string): QuantityParseResult | null {
  const cleaned = token
    .replace(/[•·●▪︎◦]/g, ' ')
    .replace(/[,;]$/g, '')
    .trim()
  if (!cleaned) {
    return null
  }
  const trailing = cleaned.match(TRAILING_QUANTITY_REGEX)
  if (!trailing) {
    return null
  }
  const rawNumber = trailing[1]
  const parsed = toNumberFlexible(rawNumber)
  if (parsed === null || Number.isNaN(parsed)) {
    return null
  }
  const quantity = Math.round(parsed)
  const unit = normalizeUnit(trailing[2] ?? cleaned.replace(rawNumber, ''))
  return { quantity, unit }
}

export function ensureInteger(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) {
    return null
  }
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.round(value)
}
