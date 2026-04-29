// src/domain/payments/landingPaymentStatus.ts
// Pure functions to determine payment status for the Carteira Ativa landing page.
// Source of truth: the installments list from Cobrança → Mensalidades.
// Does NOT depend on contract_status, contract_type, or any contract flags.

/**
 * Status of a single monthly charge, normalized from raw status strings.
 */
export type MonthlyChargeStatus = 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'ATRASADO'

/**
 * Aggregated payment status for the Carteira Ativa landing page badge.
 * - PAGO: All charges paid
 * - EM_DIA: Has paid charges + only future/pending charges remaining (on track)
 * - PENDENTE: Has pending charges only (no paid, no overdue)
 * - VENCIDO: Has charges overdue 1–5 days, none in ATRASADO
 * - ATRASADO: Has charges overdue >5 days
 * - PARCIALMENTE_PAGO: Some charges paid, others in ATRASADO
 * - SEM_COBRANCA: No charges available
 */
export type LandingPaymentStatus =
  | 'PAGO'
  | 'EM_DIA'
  | 'PENDENTE'
  | 'VENCIDO'
  | 'ATRASADO'
  | 'PARCIALMENTE_PAGO'
  | 'SEM_COBRANCA'

/**
 * A single monthly charge from the billing table.
 * Maps to the installments rendered in Cobrança → Mensalidades.
 */
export interface MonthlyCharge {
  /** ISO date YYYY-MM-DD or BR date DD/MM/YYYY */
  dueDate?: string | null
  /** Raw status string from the database (e.g. "Confirmado", "Pendente", "pago") */
  status?: string | null
  /** ISO date when the charge was paid */
  paidAt?: string | null
  /** Alternate paid date field */
  paidDate?: string | null
}

/**
 * Display labels for the landing page payment status.
 */
export const LANDING_PAYMENT_STATUS_LABELS: Record<LandingPaymentStatus, string> = {
  PAGO: 'Pago',
  EM_DIA: 'Em dia',
  PENDENTE: 'Pendente',
  VENCIDO: 'Vencido',
  ATRASADO: 'Atrasado',
  PARCIALMENTE_PAGO: 'Parcialmente pago',
  SEM_COBRANCA: 'Sem cobrança',
}

/** Number of days after due date before status changes from VENCIDO to ATRASADO */
const GRACE_PERIOD_DAYS = 5

/**
 * Parses a date string in YYYY-MM-DD or DD/MM/YYYY format.
 * Returns null if the string is invalid or empty.
 */
function parseDateBRorISO(value: string | null | undefined): Date | null {
  if (!value) return null

  let date: Date
  // DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const parts = value.split('/')
    const day = Number(parts[0])
    const month = Number(parts[1])
    const year = Number(parts[2])
    date = new Date(year, month - 1, day)
  } else {
    date = new Date(value)
  }

  return isNaN(date.getTime()) ? null : date
}

/**
 * Normalizes a status string to a canonical lowercase form for comparison.
 */
function normalizeText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim()
}

/**
 * Returns true if the charge is paid-like (paidAt/paidDate set, or status is confirmado/pago/paid).
 */
export function isPaidLike(charge: MonthlyCharge): boolean {
  if (charge.paidAt || charge.paidDate) return true
  const s = normalizeText(charge.status)
  return s === 'confirmado' || s === 'pago' || s === 'paid' || s === 'confirmed'
}

/**
 * Returns the end-of-day timestamp for the last day of the current month.
 */
function endOfCurrentMonth(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Normalizes a single charge to a canonical MonthlyChargeStatus.
 *
 * Rules (in priority order):
 * 1. If paid (paidAt/paidDate or status = confirmado/pago/paid) → PAGO
 * 2. If dueDate cannot be parsed → PENDENTE (safe fallback)
 * 3. If today is before the first day of the due month → PENDENTE
 * 4. If today <= dueDate → PENDENTE
 * 5. If today <= dueDate + 5 days → VENCIDO
 * 6. Otherwise → ATRASADO
 *
 * @param charge - The monthly charge to evaluate
 * @param today - Reference date for comparison (defaults to current date)
 */
export function normalizeChargeStatus(
  charge: MonthlyCharge,
  today: Date = new Date(),
): MonthlyChargeStatus {
  // Paid/confirmed wins over any date logic
  if (isPaidLike(charge)) return 'PAGO'

  const due = parseDateBRorISO(charge.dueDate)
  if (!due) return 'PENDENTE'

  const todayNorm = new Date(today)
  todayNorm.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  // First day of the due month
  const firstDayOfDueMonth = new Date(due.getFullYear(), due.getMonth(), 1)
  firstDayOfDueMonth.setHours(0, 0, 0, 0)

  // Before the month starts → PENDENTE
  if (todayNorm < firstDayOfDueMonth) return 'PENDENTE'

  // On or before due date → PENDENTE
  if (todayNorm <= due) return 'PENDENTE'

  // Days overdue
  const diffMs = todayNorm.getTime() - due.getTime()
  const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (daysOverdue <= GRACE_PERIOD_DAYS) return 'VENCIDO'
  return 'ATRASADO'
}

/**
 * Calculates the aggregated payment status for the Carteira Ativa landing page badge.
 *
 * Uses only the installment list as the source of truth.
 * Does NOT check contract_type, contract_status, or any billing-active flags.
 *
 * Only considers charges up to and including the current month end,
 * plus any charges that are already paid (regardless of month).
 *
 * Scenario from requirements:
 *   Parcela 1: Confirmado → hasPaid = true
 *   Parcelas 2,3,...: Pendente (future) → hasPending = true (but filtered out as future)
 *   Result: EM_DIA (not Inativo, not Pendente)
 *
 * @param charges - Array of monthly charges from the billing table
 * @param today - Reference date (defaults to current date)
 * @returns The aggregated landing payment status
 */
export function getLandingPaymentStatus(
  charges: MonthlyCharge[],
  today: Date = new Date(),
): LandingPaymentStatus {
  if (!charges?.length) return 'SEM_COBRANCA'

  const todayNorm = new Date(today)
  todayNorm.setHours(0, 0, 0, 0)
  const monthEnd = endOfCurrentMonth(today)

  // Relevant charges: those with dueDate in the current month or earlier,
  // plus any paid/confirmed charges regardless of month.
  const relevant = charges.filter((charge) => {
    if (isPaidLike(charge)) return true
    const due = parseDateBRorISO(charge.dueDate)
    if (!due) return true // Include when date cannot be determined
    return due <= monthEnd
  })

  if (relevant.length === 0) return 'PENDENTE'

  const statuses = relevant.map((c) => normalizeChargeStatus(c, todayNorm))

  const hasPaid = statuses.includes('PAGO')
  const hasPending = statuses.includes('PENDENTE')
  const hasVencido = statuses.includes('VENCIDO')
  const hasAtrasado = statuses.includes('ATRASADO')

  // Has delayed (>5 days) AND some paid → PARCIALMENTE_PAGO
  if (hasAtrasado && hasPaid) return 'PARCIALMENTE_PAGO'

  // Has delayed (>5 days) and no paid → ATRASADO
  if (hasAtrasado) return 'ATRASADO'

  // Has overdue within grace period AND some paid → PARCIALMENTE_PAGO
  if (hasVencido && hasPaid) return 'PARCIALMENTE_PAGO'

  // Has overdue within grace period (none paid) → VENCIDO
  if (hasVencido) return 'VENCIDO'

  // All relevant charges paid, nothing pending within range
  if (hasPaid && !hasPending) {
    // Check if there are future pending charges not included in `relevant`
    // (charges whose dueDate is after the current month end and are not paid)
    const hasFuturePending = charges.some((charge) => {
      if (isPaidLike(charge)) return false
      const due = parseDateBRorISO(charge.dueDate)
      if (!due) return false
      return due > monthEnd
    })
    // Paid up to now, but more charges are coming → EM_DIA
    if (hasFuturePending) return 'EM_DIA'
    return 'PAGO'
  }

  // Paid + pending within range (on track)
  if (hasPaid && hasPending) return 'EM_DIA'

  return 'PENDENTE'
}
