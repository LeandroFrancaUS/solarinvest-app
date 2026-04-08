/**
 * Unified document (CPF / CNPJ) detection and normalization.
 * Provides a single entry point for code that must handle both document types.
 */

import { normalizeCpf, isValidCpf, normalizeAndValidateCpf } from './cpf'
import { normalizeCnpj, isValidCnpj, normalizeAndValidateCnpj } from './cnpj'

export type DocumentType = 'cpf' | 'cnpj' | 'unknown'

export interface NormalizedDocument {
  type: DocumentType
  /** Validated + normalized digits, or null when invalid. */
  normalized: string | null
  /** Raw digits (stripped) even if invalid, or null when empty. */
  rawDigits: string | null
}

/**
 * Detect whether a raw string looks like a CPF (11 digits) or CNPJ (14 digits).
 * Returns 'unknown' if the digit count matches neither.
 */
export function detectDocumentType(raw: string | null | undefined): DocumentType {
  if (!raw) return 'unknown'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return 'cpf'
  if (digits.length === 14) return 'cnpj'
  return 'unknown'
}

/**
 * Normalize and validate a document string, auto-detecting CPF vs CNPJ.
 * Returns { type, normalized, rawDigits }.
 *
 * - `normalized` is non-null only when the document passes check-digit validation.
 * - `rawDigits` contains the stripped digits regardless of validity.
 */
export function normalizeDocument(raw: string | null | undefined): NormalizedDocument {
  if (!raw) return { type: 'unknown', normalized: null, rawDigits: null }

  const digits = raw.replace(/\D/g, '')
  if (!digits) return { type: 'unknown', normalized: null, rawDigits: null }

  if (digits.length === 11) {
    return {
      type: 'cpf',
      normalized: normalizeAndValidateCpf(raw),
      rawDigits: normalizeCpf(raw),
    }
  }

  if (digits.length === 14) {
    return {
      type: 'cnpj',
      normalized: normalizeAndValidateCnpj(raw),
      rawDigits: normalizeCnpj(raw),
    }
  }

  return { type: 'unknown', normalized: null, rawDigits: digits || null }
}

/**
 * Returns true when the raw string is a valid CPF or CNPJ.
 */
export function isValidDocument(raw: string | null | undefined): boolean {
  const doc = normalizeDocument(raw)
  return doc.normalized !== null
}

/**
 * Convenience: normalize CPF or CNPJ and return only the validated digits.
 * Returns null when the document is absent, has wrong length, or fails check-digit.
 */
export function normalizeAndValidateDocument(raw: string | null | undefined): string | null {
  return normalizeDocument(raw).normalized
}

// Re-export individual utilities so callers can import from one place when needed
// (cpf.ts and cnpj.ts are also re-exported from the barrel index.ts)
export {
  normalizeCpf, isValidCpf, normalizeAndValidateCpf,
  normalizeCnpj, isValidCnpj, normalizeAndValidateCnpj,
}
