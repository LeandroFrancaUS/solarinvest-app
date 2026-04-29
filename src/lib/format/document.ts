/**
 * Display-only CPF / CNPJ formatting utilities.
 *
 * These functions format raw document strings for UI display only.
 * They do NOT validate check-digits and must NOT modify stored values.
 */

/**
 * Returns only the digit characters from a string.
 */
export function onlyDigits(value?: string | null): string {
  return String(value ?? '').replace(/\D/g, '')
}

/**
 * Formats a raw CPF or CNPJ string for display.
 *
 * - 11 digits → CPF:  000.000.000-00
 * - 14 digits → CNPJ: 00.000.000/0000-00
 * - Otherwise → returns the original value or "—"
 *
 * Does not validate check-digits; purely cosmetic.
 */
export function formatCpfCnpj(value?: string | null): string {
  const digits = onlyDigits(value)

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  return value || '—'
}
