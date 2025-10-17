const fmtNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 })
const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPerc = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 })

/** Converte string BR/US para number (null se inválido). Aceita "1.234,56" e "1234.56". */
export function toNumberFlexible(input: unknown): number | null {
  if (input == null) return null
  if (typeof input === 'number' && Number.isFinite(input)) return input
  let s = String(input).trim().replace(/\u00A0/g, ' ')
  if (!s) return null
  // Se tiver vírgula decimal, remove separadores de milhar e troca vírgula por ponto
  if (/,\d{1,}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  s = s.replace(/[^\d\.\-]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/** Formata número genérico no padrão pt-BR. */
export function formatNumberBR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n as number)) return '—'
  return fmtNumber.format(n as number)
}

/** Formata número com opções customizadas. */
export function formatNumberBRWithOptions(
  n: number | null | undefined,
  options: Intl.NumberFormatOptions,
): string {
  if (n == null || !Number.isFinite(n as number)) return '—'
  return new Intl.NumberFormat('pt-BR', options).format(n as number)
}

/** Formata moeda (BRL). */
export function formatMoneyBR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n as number)) return '—'
  return fmtMoney.format(n as number)
}

/** Formata moeda (BRL) com frações personalizadas. */
export function formatMoneyBRWithDigits(
  n: number | null | undefined,
  fractionDigits: number,
): string {
  if (n == null || !Number.isFinite(n as number)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n as number)
}

/** Formata percentual (0.105 -> "10,5%"). */
export function formatPercentBR(frac: number | null | undefined): string {
  if (frac == null || !Number.isFinite(frac as number)) return '—'
  return fmtPerc.format(frac as number)
}

export function formatPercentBRWithDigits(
  frac: number | null | undefined,
  fractionDigits: number,
): string {
  if (frac == null || !Number.isFinite(frac as number)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(frac as number)
}

// Unidades técnicas
export const fmt = {
  kwhMes: (n?: number | null) => (n == null ? '—' : `${fmtNumber.format(n)} kWh/mês`),
  kwp: (n?: number | null) => (n == null ? '—' : `${fmtNumber.format(n)} kWp`),
  wp: (n?: number | null) => (n == null ? '—' : `${fmtNumber.format(n)} Wp`),
  m2: (n?: number | null) => (n == null ? '—' : `${fmtNumber.format(n)} m²`),
}
