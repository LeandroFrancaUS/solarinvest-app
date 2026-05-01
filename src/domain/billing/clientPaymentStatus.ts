// src/domain/billing/clientPaymentStatus.ts
// Utilities to determine client payment status for display on Carteira Ativa landing page.

import type { PortfolioClientRow, InstallmentPayment } from '../../types/clientPortfolio'

/**
 * Payment status for a client in the active portfolio.
 * - 'inativo': Billing tab is not active/available for this client
 * - 'pendente': Has pending (not paid/confirmed) installments
 * - 'pago': All installments are paid/confirmed
 * - 'vencido': Has overdue installments (past due date, not paid)
 * - 'em_atraso': Has installments significantly overdue (>30 days)
 */
export type ClientPaymentStatus = 'inativo' | 'pendente' | 'pago' | 'vencido' | 'em_atraso'

export interface ClientPaymentStatusResult {
  status: ClientPaymentStatus
  label: string
  /** Total unpaid installments */
  unpaidCount?: number
  /** Total overdue installments */
  overdueCount?: number
  /** Days until next due date (negative if overdue) */
  daysUntilNextDue?: number
  /** Next due date */
  nextDueDate?: Date
}

export const CLIENT_PAYMENT_STATUS_LABELS: Record<ClientPaymentStatus, string> = {
  inativo: 'Inativo',
  pendente: 'Pendente',
  pago: 'Pago',
  vencido: 'Vencido',
  em_atraso: 'Em Atraso',
}

/** Days threshold to consider payment severely overdue */
const SEVERELY_OVERDUE_DAYS = 30

/**
 * Resolves whether the billing/cobrança feature is active for a client.
 * Billing is only active for leasing contracts with active status and complete plan info.
 */
function isBillingActive(client: PortfolioClientRow): boolean {
  // Only leasing contracts have recurring billing
  if (client.contract_type !== 'leasing') {
    return false
  }
  // Contract must be active
  if (client.contract_status !== 'active') {
    return false
  }
  // Must have term months defined
  const termMonths = client.contractual_term_months ?? client.term_months ?? client.prazo_meses ?? 0
  if (termMonths <= 0) {
    return false
  }
  return true
}

/**
 * Checks if an installment is paid or confirmed.
 */
function isInstallmentPaid(installment: InstallmentPayment): boolean {
  return installment.status === 'pago' || installment.status === 'confirmado'
}

/**
 * Calculates the due date for a given installment number.
 * Returns null if unable to calculate.
 *
 * Installment #1 uses the exact `first_billing_date`.
 * Installments #2+ use the recurring `due_day` in successive calendar months.
 */
function calculateInstallmentDueDate(
  client: PortfolioClientRow,
  installmentNumber: number,
): Date | null {
  // Get billing start date
  const startDate = client.first_billing_date ?? client.inicio_da_mensalidade ?? client.commissioning_date_billing
  if (!startDate) return null

  const dueDay = client.due_day
  if (!dueDay || dueDay < 1 || dueDay > 31) return null

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  // Installment #1 → exact firstBillingDate
  if (installmentNumber === 1) {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate())
  }

  // Installments #2+ → month of firstBillingDate + (N − 1), day = dueDay (clamped)
  const targetMonthOffset = installmentNumber - 1
  const month = start.getMonth() + targetMonthOffset
  const year = start.getFullYear() + Math.floor(month / 12)
  const monthNormalized = ((month % 12) + 12) % 12

  // Clamp day to valid range for the month
  const lastDay = new Date(year, monthNormalized + 1, 0).getDate()
  const day = Math.min(dueDay, lastDay)

  return new Date(year, monthNormalized, day)
}

/**
 * Determines the overall payment status for a client based on their installments,
 * due dates, and billing configuration.
 */
export function getClientPaymentStatus(client: PortfolioClientRow): ClientPaymentStatusResult {
  // Check if billing is active for this client
  if (!isBillingActive(client)) {
    return {
      status: 'inativo',
      label: CLIENT_PAYMENT_STATUS_LABELS.inativo,
    }
  }

  const rawInstallments = client.installments_json ?? []
  const installments: InstallmentPayment[] = typeof rawInstallments === 'string'
    ? (() => { try { return JSON.parse(rawInstallments) as InstallmentPayment[] } catch { return [] } })()
    : rawInstallments

  // If no installments, billing is inactive
  if (installments.length === 0) {
    return {
      status: 'inativo',
      label: CLIENT_PAYMENT_STATUS_LABELS.inativo,
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let unpaidCount = 0
  let overdueCount = 0
  let severelyOverdueCount = 0
  let nextDueDate: Date | null = null
  let daysUntilNextDue: number | null = null

  // Analyze each installment
  for (const inst of installments) {
    const isPaid = isInstallmentPaid(inst)

    if (!isPaid) {
      unpaidCount++

      // Calculate due date for this installment
      const dueDate = calculateInstallmentDueDate(client, inst.number ?? 1)
      if (dueDate) {
        const diffMs = dueDate.getTime() - today.getTime()
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

        // Count overdue
        if (diffDays < 0) {
          overdueCount++
          if (Math.abs(diffDays) > SEVERELY_OVERDUE_DAYS) {
            severelyOverdueCount++
          }
        }

        // Track the next upcoming due date (earliest unpaid installment)
        if (!nextDueDate || dueDate < nextDueDate) {
          nextDueDate = dueDate
          daysUntilNextDue = diffDays
        }
      }
    }
  }

  // Determine status based on analysis
  // Priority: em_atraso > vencido > pago > pendente

  if (severelyOverdueCount > 0) {
    const result: ClientPaymentStatusResult = {
      status: 'em_atraso',
      label: CLIENT_PAYMENT_STATUS_LABELS.em_atraso,
      unpaidCount,
      overdueCount,
    }
    if (daysUntilNextDue != null) result.daysUntilNextDue = daysUntilNextDue
    if (nextDueDate != null) result.nextDueDate = nextDueDate
    return result
  }

  if (overdueCount > 0) {
    const result: ClientPaymentStatusResult = {
      status: 'vencido',
      label: CLIENT_PAYMENT_STATUS_LABELS.vencido,
      unpaidCount,
      overdueCount,
    }
    if (daysUntilNextDue != null) result.daysUntilNextDue = daysUntilNextDue
    if (nextDueDate != null) result.nextDueDate = nextDueDate
    return result
  }

  if (unpaidCount === 0) {
    return {
      status: 'pago',
      label: CLIENT_PAYMENT_STATUS_LABELS.pago,
      unpaidCount: 0,
      overdueCount: 0,
    }
  }

  const result: ClientPaymentStatusResult = {
    status: 'pendente',
    label: CLIENT_PAYMENT_STATUS_LABELS.pendente,
    unpaidCount,
    overdueCount: 0,
  }
  if (daysUntilNextDue != null) result.daysUntilNextDue = daysUntilNextDue
  if (nextDueDate != null) result.nextDueDate = nextDueDate
  return result
}
