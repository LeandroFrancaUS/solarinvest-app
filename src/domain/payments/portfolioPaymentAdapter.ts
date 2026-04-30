// src/domain/payments/portfolioPaymentAdapter.ts
// Adapter to convert portfolio client data to MonthlyPayment format for status calculation.

import type { PortfolioClientRow, InstallmentPayment } from '../../types/clientPortfolio'
import type { MonthlyPayment } from './paymentStatus'

/**
 * Calculates the due date for a given installment number based on client billing configuration.
 *
 * @param client - The portfolio client with billing configuration
 * @param installmentNumber - The installment number (1-indexed)
 * @returns The due date as YYYY-MM-DD string, or null if unable to calculate
 */
function calculateInstallmentDueDate(
  client: PortfolioClientRow,
  installmentNumber: number,
): string | null {
  // Get billing start date
  const startDate = client.first_billing_date ?? client.inicio_da_mensalidade ?? client.commissioning_date_billing
  if (!startDate) return null

  const dueDay = client.due_day
  if (!dueDay || dueDay < 1 || dueDay > 31) return null

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  // Calculate the month for this installment (0-indexed, so subtract 1)
  const month = start.getMonth() + (installmentNumber - 1)
  const year = start.getFullYear() + Math.floor(month / 12)
  const monthNormalized = ((month % 12) + 12) % 12

  // Clamp day to valid range for the month
  const lastDay = new Date(year, monthNormalized + 1, 0).getDate()
  const day = Math.min(dueDay, lastDay)

  const dueDate = new Date(year, monthNormalized, day)

  // Format as YYYY-MM-DD
  const yyyy = dueDate.getFullYear()
  const mm = String(dueDate.getMonth() + 1).padStart(2, '0')
  const dd = String(dueDate.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

/**
 * Calculates the reference month (YYYY-MM) for a given installment number.
 *
 * @param client - The portfolio client with billing configuration
 * @param installmentNumber - The installment number (1-indexed)
 * @returns The reference month as YYYY-MM string, or null if unable to calculate
 */
function calculateReferenceMonth(
  client: PortfolioClientRow,
  installmentNumber: number,
): string | null {
  const startDate = client.first_billing_date ?? client.inicio_da_mensalidade ?? client.commissioning_date_billing
  if (!startDate) return null

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  // Calculate the month for this installment (0-indexed, so subtract 1)
  const month = start.getMonth() + (installmentNumber - 1)
  const year = start.getFullYear() + Math.floor(month / 12)
  const monthNormalized = ((month % 12) + 12) % 12

  const yyyy = year
  const mm = String(monthNormalized + 1).padStart(2, '0')

  return `${yyyy}-${mm}`
}

/**
 * Converts a portfolio client's installments to MonthlyPayment format.
 * Only includes installments with valid due dates.
 *
 * @param client - The portfolio client with installments
 * @returns Array of MonthlyPayment objects
 */
export function convertToMonthlyPayments(client: PortfolioClientRow): MonthlyPayment[] {
  const installments = client.installments_json ?? []

  const monthlyPayments: MonthlyPayment[] = []

  for (const installment of installments) {
    const dueDate = calculateInstallmentDueDate(client, installment.number)
    const referenceMonth = calculateReferenceMonth(client, installment.number)

    if (!dueDate || !referenceMonth) {
      continue // Skip installments with invalid dates
    }

    // Check if paid
    const isPaid = installment.status === 'pago' || installment.status === 'confirmado'

    monthlyPayments.push({
      referenceMonth,
      dueDate,
      paidAt: isPaid ? (installment.paid_at ?? dueDate) : null,
    })
  }

  return monthlyPayments
}

/**
 * Checks if billing is active for a client.
 * Billing is only active for leasing contracts with active status and complete plan info.
 */
export function isBillingActive(client: PortfolioClientRow): boolean {
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
