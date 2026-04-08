/**
 * CPF normalization and validation utilities.
 * Used across UI, import, sync and migration pipelines.
 *
 * All functions are pure with no side-effects.
 */

/**
 * Strip all non-digit characters and return exactly 11 digits, or null.
 */
export function normalizeCpf(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return null
  return digits
}

/**
 * Validate a CPF using the official Brazilian check-digit algorithm.
 * Input must be already normalized (11 digits, no punctuation).
 */
export function isValidCpf(cpf: string | null | undefined): boolean {
  if (!cpf || cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false // reject all-same digits

  const calcDigit = (s: string, length: number): number => {
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += parseInt(s.charAt(i), 10) * (length + 1 - i)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 || remainder === 11 ? 0 : remainder
  }

  const d1 = calcDigit(cpf, 9)
  const d2 = calcDigit(cpf, 10)
  return d1 === parseInt(cpf.charAt(9), 10) && d2 === parseInt(cpf.charAt(10), 10)
}

/**
 * Format a normalized CPF for display: 000.000.000-00
 */
export function formatCpf(normalized: string | null | undefined): string {
  if (!normalized || normalized.length !== 11) return normalized ?? ''
  return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-${normalized.slice(9)}`
}

/**
 * Normalize and validate in one step. Returns normalized string if valid, null otherwise.
 */
export function normalizeAndValidateCpf(raw: string | null | undefined): string | null {
  const normalized = normalizeCpf(raw)
  if (!normalized) return null
  if (!isValidCpf(normalized)) return null
  return normalized
}
