/**
 * CNPJ normalization and validation utilities.
 * Mirrors the CPF module — same API shape, same pure-function contract.
 * Used across UI, import, sync and migration pipelines.
 */

/**
 * Strip all non-digit characters and return exactly 14 digits, or null.
 */
export function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 14) return null
  return digits
}

/**
 * Validate a CNPJ using the official Brazilian check-digit algorithm.
 * Input must be already normalized (14 digits, no punctuation).
 */
export function isValidCnpj(cnpj: string | null | undefined): boolean {
  if (!cnpj || cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false // reject all-same digits

  const calcDigit = (cnpj: string, weights: number[]): number => {
    let sum = 0
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(cnpj.charAt(i), 10) * (weights[i] ?? 0)
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const d1 = calcDigit(cnpj, w1)
  const d2 = calcDigit(cnpj, w2)
  return d1 === parseInt(cnpj.charAt(12), 10) && d2 === parseInt(cnpj.charAt(13), 10)
}

/**
 * Format a normalized CNPJ for display: 00.000.000/0001-00
 */
export function formatCnpj(normalized: string | null | undefined): string {
  if (!normalized || normalized.length !== 14) return normalized ?? ''
  return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`
}

/**
 * Normalize and validate in one step. Returns normalized string if valid, null otherwise.
 */
export function normalizeAndValidateCnpj(raw: string | null | undefined): string | null {
  const normalized = normalizeCnpj(raw)
  if (!normalized) return null
  if (!isValidCnpj(normalized)) return null
  return normalized
}
