/**
 * Contact field normalization (phone, email, name).
 */

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return null
  return digits
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed.includes('@')) return null
  return trimmed
}

export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.trim().replace(/\s+/g, ' ') || null
}
