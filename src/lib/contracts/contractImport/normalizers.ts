export function normalizePersonName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function normalizeDocument(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

export function formatCpfCnpj(input: string | null | undefined): string | null {
  const digits = normalizeDocument(input)
  if (!digits) return null
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return null
}

export function brDateTimeToISO(input: string): string | null {
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
  if (!m) return null
  const [, dd, mm, yyyy, hh, min] = m
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00-03:00`
}

export function parseNumberBR(input: string | null | undefined): number | null {
  if (!input) return null
  const cleaned = input.replace(/\./g, '').replace(',', '.').trim()
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}
