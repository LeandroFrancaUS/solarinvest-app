// src/domain/payments/paymentStatus.ts
// Pure payment status calculation logic for monthly recurring payments.
// Zero dependencies on React or UI components.

/**
 * Payment status for a single monthly payment.
 * - PAGO: Payment has been confirmed/paid
 * - PENDENTE: Within the month, before or on due date, not paid yet
 * - VENCIDO: Overdue by 1-5 days after due date
 * - ATRASADO: Overdue by more than 5 days after due date
 */
export type MonthlyPaymentStatus = 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'ATRASADO'

/**
 * Represents a single monthly payment with its reference month and due date.
 */
export interface MonthlyPayment {
  /** Reference month in YYYY-MM format (e.g., "2026-04") */
  referenceMonth: string
  /** Due date in YYYY-MM-DD format (e.g., "2026-04-05") */
  dueDate: string
  /** Payment confirmation date in YYYY-MM-DD format, or null if not paid */
  paidAt?: string | null
}

/**
 * Aggregated payment status for portfolio/client view.
 * - PAGO: All relevant months are paid
 * - PENDENTE: Has pending payments, no overdue
 * - VENCIDO: Has overdue payments (1-5 days), no severely delayed
 * - ATRASADO: Has severely delayed payments (>5 days), no paid months
 * - PARCIALMENTE_PAGO: Has delayed payments AND at least one paid month
 */
export type PortfolioPaymentStatus =
  | 'PAGO'
  | 'PENDENTE'
  | 'VENCIDO'
  | 'ATRASADO'
  | 'PARCIALMENTE_PAGO'

/** Number of days after due date before status changes from VENCIDO to ATRASADO */
const GRACE_PERIOD_DAYS = 5

/**
 * Display labels for monthly payment status
 */
export const MONTHLY_PAYMENT_STATUS_LABELS: Record<MonthlyPaymentStatus, string> = {
  PAGO: 'Pago',
  PENDENTE: 'Pendente',
  VENCIDO: 'Vencido',
  ATRASADO: 'Atrasado',
}

/**
 * Display labels for portfolio payment status
 */
export const PORTFOLIO_PAYMENT_STATUS_LABELS: Record<PortfolioPaymentStatus, string> = {
  PAGO: 'Pago',
  PENDENTE: 'Pendente',
  VENCIDO: 'Vencido',
  ATRASADO: 'Em Atraso',
  PARCIALMENTE_PAGO: 'Parcialmente Pago',
}

/**
 * Determines the payment status for a single monthly payment.
 *
 * Logic:
 * 1. If paidAt is set → PAGO
 * 2. If today is before the first day of the reference month → PENDENTE (future payment)
 * 3. If today is between first day of month and due date (inclusive) → PENDENTE
 * 4. If today is 1-5 days after due date → VENCIDO
 * 5. If today is more than 5 days after due date → ATRASADO
 *
 * @param payment - The monthly payment to check
 * @param today - Reference date for comparison (defaults to current date, normalized to midnight)
 * @returns The payment status
 */
export function getMonthlyPaymentStatus(
  payment: MonthlyPayment,
  today: Date = new Date(),
): MonthlyPaymentStatus {
  // Normalize today to midnight for consistent date comparisons
  const todayNormalized = new Date(today)
  todayNormalized.setHours(0, 0, 0, 0)

  // If payment is confirmed, status is always PAGO
  if (payment.paidAt) {
    return 'PAGO'
  }

  // Parse due date
  const dueDate = new Date(payment.dueDate)
  dueDate.setHours(0, 0, 0, 0)

  // Calculate first day of the reference month
  const parts = payment.referenceMonth.split('-').map(Number)
  const [year, month] = [parts[0] ?? 0, parts[1] ?? 1]
  const firstDayOfMonth = new Date(year, month - 1, 1)
  firstDayOfMonth.setHours(0, 0, 0, 0)

  // If before the reference month starts, treat as pending (future payment)
  if (todayNormalized < firstDayOfMonth) {
    return 'PENDENTE'
  }

  // If within the month and on or before due date → PENDENTE
  if (todayNormalized <= dueDate) {
    return 'PENDENTE'
  }

  // Calculate days overdue
  const diffMs = todayNormalized.getTime() - dueDate.getTime()
  const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // If 1-5 days overdue → VENCIDO
  if (daysOverdue <= GRACE_PERIOD_DAYS) {
    return 'VENCIDO'
  }

  // If more than 5 days overdue → ATRASADO
  return 'ATRASADO'
}

/**
 * Determines the aggregated payment status for a portfolio client based on all their payments.
 *
 * Only considers payments up to and including the current month (ignores future months).
 *
 * Logic:
 * 1. Filter to only relevant payments (reference month <= current month)
 * 2. Get status for each relevant payment
 * 3. Count statuses: paid, pending, overdue (vencido), delayed (atrasado)
 * 4. Apply aggregation rules:
 *    - All paid → PAGO
 *    - Has delayed + has paid → PARCIALMENTE_PAGO
 *    - Has delayed + no paid → ATRASADO
 *    - Has overdue + no delayed → VENCIDO
 *    - Otherwise → PENDENTE
 *
 * @param payments - Array of monthly payments to aggregate
 * @param today - Reference date for comparison (defaults to current date)
 * @returns The aggregated portfolio status
 */
export function getPortfolioPaymentStatus(
  payments: MonthlyPayment[],
  today: Date = new Date(),
): PortfolioPaymentStatus {
  if (payments.length === 0) {
    return 'PENDENTE'
  }

  // Normalize today to midnight
  const todayNormalized = new Date(today)
  todayNormalized.setHours(0, 0, 0, 0)

  // Get current month in YYYY-MM format for filtering
  const currentMonth = `${todayNormalized.getFullYear()}-${String(todayNormalized.getMonth() + 1).padStart(2, '0')}`

  // Filter to only payments up to current month (ignore future payments)
  const relevantPayments = payments.filter((p) => p.referenceMonth <= currentMonth)

  if (relevantPayments.length === 0) {
    return 'PENDENTE'
  }

  // Calculate status for each relevant payment
  const statuses = relevantPayments.map((p) => getMonthlyPaymentStatus(p, todayNormalized))

  // Count each status type
  const paidCount = statuses.filter((s) => s === 'PAGO').length
  const pendenteCount = statuses.filter((s) => s === 'PENDENTE').length
  const vencidoCount = statuses.filter((s) => s === 'VENCIDO').length
  const atrasadoCount = statuses.filter((s) => s === 'ATRASADO').length

  // Apply aggregation rules

  // If all relevant payments are paid → PAGO
  if (paidCount === relevantPayments.length) {
    return 'PAGO'
  }

  // If has delayed payments AND at least one paid → PARCIALMENTE_PAGO
  if (atrasadoCount > 0 && paidCount > 0) {
    return 'PARCIALMENTE_PAGO'
  }

  // If has delayed payments and no paid → ATRASADO
  if (atrasadoCount > 0) {
    return 'ATRASADO'
  }

  // If has overdue payments (but not delayed) → VENCIDO
  if (vencidoCount > 0) {
    return 'VENCIDO'
  }

  // Otherwise (only pending or mix of pending/paid) → PENDENTE
  return 'PENDENTE'
}
