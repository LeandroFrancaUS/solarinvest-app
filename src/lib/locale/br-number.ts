const fmtNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 })
const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPerc = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 })

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const sanitizeNumericInput = (input: unknown): string | null => {
  if (typeof input === 'string') {
    return input
  }
  if (isFiniteNumber(input)) {
    return input.toString()
  }
  if (typeof input === 'bigint') {
    return input.toString()
  }
  return null
}

/** Converte string BR/US para number (null se inválido). Aceita "1.234,56" e "1234.56". */
export function toNumberFlexible(input: unknown): number | null {
  if (input == null) return null
  if (isFiniteNumber(input)) return input
  const raw = sanitizeNumericInput(input)
  if (raw == null) return null
  let normalized = raw.trim().replace(/\u00A0/g, ' ')
  if (!normalized) return null
  if (/,\d{1,}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  }
  normalized = normalized.replace(/[^\d.\-]/g, '')
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/** Formata número genérico no padrão pt-BR. */
export function formatNumberBR(n: number | null | undefined): string {
  if (!isFiniteNumber(n)) return ''
  return fmtNumber.format(n)
}

/** Formata número com opções customizadas. */
export function formatNumberBRWithOptions(
  n: number | null | undefined,
  options: Intl.NumberFormatOptions,
): string {
  if (!isFiniteNumber(n)) return ''
  return new Intl.NumberFormat('pt-BR', options).format(n)
}

/** Formata moeda (BRL). */
export function formatMoneyBR(n: number | null | undefined): string {
  if (!isFiniteNumber(n)) return ''
  return fmtMoney.format(n)
}

/** Formata moeda (BRL) com frações personalizadas. */
export function formatMoneyBRWithDigits(
  n: number | null | undefined,
  fractionDigits: number,
): string {
  if (!isFiniteNumber(n)) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n)
}

/** Formata percentual (0.105 -> "10,5%"). */
export function formatPercentBR(frac: number | null | undefined): string {
  if (!isFiniteNumber(frac)) return ''
  return fmtPerc.format(frac)
}

export function formatPercentBRWithDigits(
  frac: number | null | undefined,
  fractionDigits: number,
): string {
  if (!isFiniteNumber(frac)) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(frac)
}

// Unidades técnicas
export const fmt = {
  kwhMes: (n?: number | null) => (!isFiniteNumber(n) ? '' : `${fmtNumber.format(n)} kWh/mês`),
  kwp: (n?: number | null) => (!isFiniteNumber(n) ? '' : `${fmtNumber.format(n)} kWp`),
  wp: (n?: number | null) => (!isFiniteNumber(n) ? '' : `${fmtNumber.format(n)} Wp`),
  m2: (n?: number | null) => (!isFiniteNumber(n) ? '' : `${fmtNumber.format(n)} m²`),
}
