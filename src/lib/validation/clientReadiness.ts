/**
 * Central client-readiness validation layer.
 *
 * This module is the single source of truth for the data-integrity gate that
 * blocks two critical actions:
 *   • "Negócio Fechado" (portfolio export)
 *   • "Gerar contratos" (contract generation)
 *
 * All functions are pure — no side effects, no API calls, no state mutations.
 */

import { normalizeDocument } from '../normalize/document'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ValidationIssue = {
  /** Machine-readable field identifier, e.g. "cep" */
  field: string
  /** Human-readable field label for display */
  label: string
  /** Short explanation of what is wrong */
  message: string
  severity: 'error' | 'warning'
}

export type ClientReadinessResult = {
  /** true when all required fields pass validation */
  ok: boolean
  issues: ValidationIssue[]
}

/**
 * Flat input contract for the readiness validator.
 * Callers are responsible for extracting these values from whatever data source
 * is in use (ClienteDados, OrcamentoSnapshot, ClienteRegistro, etc.).
 */
export type ClientReadinessInput = {
  cep: string | null | undefined
  document: string | null | undefined
  phone: string | null | undefined
  email: string | null | undefined
  /** UC geradora — always required */
  ucGeradora: string | null | undefined
  /**
   * UC beneficiárias — each entry is validated when the array is non-empty.
   * Pass an empty array or omit to skip UC-beneficiária validation.
   */
  ucBeneficiarias?: (string | null | undefined)[]
}

// ─── CEP helpers ─────────────────────────────────────────────────────────────

export function normalizeCep(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/**
 * A valid Brazilian CEP has exactly 8 digits and is not all-zeros.
 * Accepts both "12345-678" and "12345678".
 */
export function isValidCep(value: string | null | undefined): boolean {
  const cep = normalizeCep(value)
  if (cep.length !== 8) return false
  if (/^0+$/.test(cep)) return false
  return true
}

// ─── CPF / CNPJ helpers ──────────────────────────────────────────────────────

/**
 * Returns true when value is a valid CPF *or* a valid CNPJ (check-digit aware).
 * Delegates to the existing normalizeDocument utility which already runs the
 * full algorithmic validation for both document types.
 */
export function isValidCpfOrCnpj(value: string | null | undefined): boolean {
  return normalizeDocument(value).normalized !== null
}

/**
 * Returns 'cpf', 'cnpj', or null when the digit count is neither 11 nor 14.
 */
export function inferDocumentType(
  value: string | null | undefined,
): 'cpf' | 'cnpj' | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return 'cpf'
  if (digits.length === 14) return 'cnpj'
  return null
}

// ─── Phone helpers ────────────────────────────────────────────────────────────

export function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/**
 * Validates a Brazilian phone number.
 *
 * Rules:
 *   • 10 digits (landline with DDD) or 11 digits (mobile with DDD)
 *   • DDD must not start with 0
 *   • Must not be all-zeros
 *   • Must not be obvious placeholders like "[object Object]"
 */
export function isValidBrazilPhone(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim()
  if (!raw) return false
  if (['[object object]'].includes(raw.toLowerCase())) return false

  const phone = normalizePhone(raw)
  if (phone.length !== 10 && phone.length !== 11) return false
  if (/^0+$/.test(phone)) return false

  const ddd = phone.slice(0, 2)
  if (ddd.startsWith('0')) return false

  return true
}

// ─── Email helpers ────────────────────────────────────────────────────────────

const EMAIL_PLACEHOLDERS = new Set([
  't',
  'teste',
  'test',
  'null',
  'undefined',
  '[object object]',
  'n/a',
  'na',
])

/**
 * Validates an email address.
 *
 * Rules:
 *   • Must not be empty
 *   • Must not be a known placeholder string
 *   • Must match the basic pattern: local@domain.tld
 */
export function isValidEmail(value: string | null | undefined): boolean {
  const email = (value ?? '').trim().toLowerCase()
  if (!email) return false
  if (EMAIL_PLACEHOLDERS.has(email)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ─── UC helpers ───────────────────────────────────────────────────────────────

export function normalizeUc(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/**
 * Validates a UC (Unidade Consumidora) code.
 *
 * Rules (structural; algorithmic check-digit validation per distributor can be
 * added later as needed):
 *   • Exactly 15 numeric digits after stripping non-digit characters
 *   • Must not be all-zeros
 */
export function isValidUc(value: string | null | undefined): boolean {
  const uc = normalizeUc(value)
  if (uc.length !== 15) return false
  if (/^0+$/.test(uc)) return false
  return true
}

// ─── Core validation function ─────────────────────────────────────────────────

/**
 * Run the full readiness validation for a client before contract generation or
 * deal closing.  Returns a deterministic result — the caller decides what to
 * do with it (block action, show modal, etc.).
 */
export function validateClientReadinessForContract(
  input: ClientReadinessInput,
): ClientReadinessResult {
  const issues: ValidationIssue[] = []

  // CEP -----------------------------------------------------------------------
  if (!isValidCep(input.cep)) {
    issues.push({
      field: 'cep',
      label: 'CEP',
      message: 'CEP inválido. Informe um CEP com 8 dígitos no formato 12345-678.',
      severity: 'error',
    })
  }

  // CPF / CNPJ ----------------------------------------------------------------
  if (!isValidCpfOrCnpj(input.document)) {
    const docType = inferDocumentType(input.document)
    let message = 'CPF/CNPJ inválido.'
    if (docType === 'cpf') message = 'CPF inválido.'
    else if (docType === 'cnpj') message = 'CNPJ inválido.'

    issues.push({
      field: 'document',
      label: 'CPF/CNPJ',
      message,
      severity: 'error',
    })
  }

  // Phone ---------------------------------------------------------------------
  if (!isValidBrazilPhone(input.phone)) {
    issues.push({
      field: 'phone',
      label: 'Telefone',
      message: 'Telefone inválido. Informe um número com DDD válido.',
      severity: 'error',
    })
  }

  // Email ---------------------------------------------------------------------
  if (!isValidEmail(input.email)) {
    issues.push({
      field: 'email',
      label: 'E-mail',
      message: 'E-mail inválido.',
      severity: 'error',
    })
  }

  // UC geradora ---------------------------------------------------------------
  if (!isValidUc(input.ucGeradora)) {
    issues.push({
      field: 'ucGeradora',
      label: 'UC geradora',
      message: 'UC geradora inválida. Informe uma sequência válida com 15 dígitos.',
      severity: 'error',
    })
  }

  // UC beneficiárias ----------------------------------------------------------
  // Only validated when entries are present (optional field)
  const ucs = input.ucBeneficiarias ?? []
  ucs.forEach((uc, index) => {
    if (!isValidUc(uc)) {
      issues.push({
        field: `ucBeneficiaria_${index}`,
        label: `UC beneficiária ${ucs.length > 1 ? index + 1 : ''}`.trim(),
        message: 'UC beneficiária inválida. Informe uma sequência válida com 15 dígitos.',
        severity: 'error',
      })
    }
  })

  return { ok: issues.length === 0, issues }
}
