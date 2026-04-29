// src/domain/billing/paymentStatusEngine.ts
//
// Pure payment-status engine for Carteira Ativa.
// The card status must be derived from the installment list rendered in
// Cobrança → Mensalidades, not from a generic contract/client status.

export type MonthlyPaymentStatus = 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'ATRASADO'

export type LandingPaymentStatus =
  | 'PAGO'
  | 'PENDENTE'
  | 'VENCIDO'
  | 'ATRASADO'
  | 'PARCIALMENTE_PAGO'
  | 'SEM_COBRANCA'

export interface MonthlyChargeLike {
  /** 1-based installment number. Optional but useful when joining generated due dates. */
  number?: number | null
  numero?: number | null
  /** Due date from generated installments or persisted charges. */
  dueDate?: string | Date | null
  data_vencimento?: string | Date | null
  /** Explicit payment date fields accepted by the UI/API. */
  paidAt?: string | Date | null
  paid_at?: string | Date | null
  paidDate?: string | Date | null
  payment_date?: string | Date | null
  /** Human status from the payment spreadsheet/list. */
  status?: string | null
  payment_status?: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfCurrentMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function parseDateBRorISO(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : startOfDay(value)

  const raw = String(value).trim()
  if (!raw) return null

  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) {
    const [, dd, mm, yyyy] = br
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    return Number.isNaN(date.getTime()) ? null : startOfDay(date)
  }

  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDateOnly) {
    const [, yyyy, mm, dd] = isoDateOnly
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    return Number.isNaN(date.getTime()) ? null : startOfDay(date)
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : startOfDay(date)
}

export function isPaidLike(charge: MonthlyChargeLike): boolean {
  const status = normalizeText(charge.status ?? charge.payment_status)
  return Boolean(
    charge.paidAt ||
    charge.paid_at ||
    charge.paidDate ||
    charge.payment_date ||
    status === 'pago' ||
    status === 'paga' ||
    status === 'confirmado' ||
    status === 'confirmada' ||
    status === 'paid',
  )
}

export function getChargeDueDate(charge: MonthlyChargeLike): Date | null {
  return parseDateBRorISO(charge.dueDate ?? charge.data_vencimento)
}

/**
 * Monthly rule:
 * - paid/confirmed always wins
 * - from day 01 of due month through due date: PENDENTE
 * - from day after due through 5 days after due: VENCIDO
 * - after the 5-day tolerance: ATRASADO
 */
export function normalizeMonthlyPaymentStatus(
  charge: MonthlyChargeLike,
  todayInput: Date = new Date(),
): MonthlyPaymentStatus {
  if (isPaidLike(charge)) return 'PAGO'

  const due = getChargeDueDate(charge)
  if (!due) return 'PENDENTE'

  const today = startOfDay(todayInput)
  const monthStart = firstDayOfMonth(due)

  if (today < monthStart) return 'PENDENTE'
  if (today <= due) return 'PENDENTE'
  if (today <= addDays(due, 5)) return 'VENCIDO'
  return 'ATRASADO'
}

/**
 * Aggregate status for the active wallet card.
 *
 * Critical business rule:
 * A future installment that was already paid/confirmed means the client has
 * started payments. If there is no open past/current charge, the card is PAGO,
 * never SEM_COBRANCA.
 */
export function getLandingPaymentStatus(
  charges: MonthlyChargeLike[] | null | undefined,
  todayInput: Date = new Date(),
): LandingPaymentStatus {
  if (!charges?.length) return 'SEM_COBRANCA'

  const today = startOfDay(todayInput)
  const currentMonthEnd = endOfCurrentMonth(today)

  // Future paid charges must stay in the aggregation. Future pending charges
  // must not become debt before their month starts.
  const relevant = charges.filter((charge) => {
    if (isPaidLike(charge)) return true
    const due = getChargeDueDate(charge)
    if (!due) return true
    return due <= currentMonthEnd
  })

  if (!relevant.length) return 'PENDENTE'

  const statuses = relevant.map((charge) => normalizeMonthlyPaymentStatus(charge, today))
  const hasPaid = statuses.includes('PAGO')
  const hasPending = statuses.includes('PENDENTE')
  const hasExpired = statuses.includes('VENCIDO')
  const hasOverdue = statuses.includes('ATRASADO')

  const hasOpenPastOrCurrent = relevant.some((charge) => {
    if (isPaidLike(charge)) return false
    const due = getChargeDueDate(charge)
    if (!due) return true
    return today >= firstDayOfMonth(due)
  })

  if (hasOverdue && hasPaid) return 'PARCIALMENTE_PAGO'
  if (hasOverdue) return 'ATRASADO'

  if (hasExpired && hasPaid) return 'PARCIALMENTE_PAGO'
  if (hasExpired) return 'VENCIDO'

  if (hasPaid && !hasOpenPastOrCurrent) return 'PAGO'
  if (hasPaid && hasOpenPastOrCurrent) return 'PARCIALMENTE_PAGO'

  if (hasPending) return 'PENDENTE'
  return 'SEM_COBRANCA'
}

export const LANDING_PAYMENT_STATUS_META: Record<LandingPaymentStatus, { label: string; tone: string; icon: string }> = {
  PAGO: { label: 'Pago', tone: 'success', icon: '✅' },
  PENDENTE: { label: 'Pendente', tone: 'warning', icon: '🟡' },
  VENCIDO: { label: 'Vencido', tone: 'orange', icon: '🟠' },
  ATRASADO: { label: 'Atrasado', tone: 'danger', icon: '🔴' },
  PARCIALMENTE_PAGO: { label: 'Parcialmente pago', tone: 'info', icon: '🟣' },
  SEM_COBRANCA: { label: 'Sem cobrança', tone: 'neutral', icon: '⚪' },
}
