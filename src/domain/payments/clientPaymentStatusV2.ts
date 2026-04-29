// src/domain/payments/clientPaymentStatusV2.ts
// Payment status for the Carteira Ativa landing page.
// Source of truth: installments_json from the billing table.
// Does NOT rely on contract_status, contract_type, or isBillingActive.
// Delegates to the canonical paymentStatusEngine for all status logic.

import type { PortfolioClientRow } from '../../types/clientPortfolio'
import {
  getLandingPaymentStatus,
  type LandingPaymentStatus,
  LANDING_PAYMENT_STATUS_META,
  type MonthlyChargeLike,
} from '../billing/paymentStatusEngine'

/**
 * Client payment status for the landing page badge.
 * Delegates to LandingPaymentStatus which uses the installment list as source of truth.
 */
export type ClientPaymentStatusV2 = LandingPaymentStatus

/**
 * Result object with status and display information.
 */
export interface ClientPaymentStatusResultV2 {
  status: ClientPaymentStatusV2
  label: string
}

/**
 * Display labels for client payment status, derived from the engine metadata.
 */
export const CLIENT_PAYMENT_STATUS_V2_LABELS: Record<ClientPaymentStatusV2, string> =
  Object.fromEntries(
    Object.entries(LANDING_PAYMENT_STATUS_META).map(([k, v]) => [k, v.label]),
  ) as Record<ClientPaymentStatusV2, string>

/**
 * Fallback chain for billing start date (highest to lowest priority):
 * 1. first_billing_date — explicit billing start from client_billing_profile
 * 2. inicio_da_mensalidade — legacy field for billing start
 * 3. commissioning_date_billing — commissioning date used as billing proxy
 */
function resolveInstallmentDueDate(client: PortfolioClientRow, installmentNumber: number): string | null {
  const startDate =
    client.first_billing_date ?? client.inicio_da_mensalidade ?? client.commissioning_date_billing
  if (!startDate) return null

  const dueDay = client.due_day
  if (!dueDay || dueDay < 1 || dueDay > 31) return null

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  const month = start.getMonth() + (installmentNumber - 1)
  const year = start.getFullYear() + Math.floor(month / 12)
  const monthNormalized = ((month % 12) + 12) % 12

  const lastDay = new Date(year, monthNormalized + 1, 0).getDate()
  const day = Math.min(dueDay, lastDay)
  const dueDate = new Date(year, monthNormalized, day)

  const yyyy = dueDate.getFullYear()
  const mm = String(dueDate.getMonth() + 1).padStart(2, '0')
  const dd = String(dueDate.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Converts a portfolio client's installments_json to MonthlyChargeLike format
 * accepted by the paymentStatusEngine.
 *
 * Uses the status already stored on each installment (pago/confirmado/pendente)
 * and calculates the dueDate from billing configuration when possible.
 */
function toMonthlyCharges(client: PortfolioClientRow): MonthlyChargeLike[] {
  const installments = client.installments_json ?? []
  return installments.map((inst) => ({
    dueDate: resolveInstallmentDueDate(client, inst.number),
    status: inst.status,
    paidAt: inst.paid_at,
  }))
}

/**
 * Determines the payment status for the Carteira Ativa landing page card badge.
 *
 * Uses installments_json as the exclusive source of truth.
 * Never returns "Inativo" just because contract_status is not 'active' —
 * if there are installment records, the actual payment situation is used.
 *
 * @param client - The portfolio client to analyze
 * @param today - Reference date for calculations (defaults to current date)
 * @returns Status result with label
 */
export function getClientPaymentStatusV2(
  client: PortfolioClientRow,
  today: Date = new Date(),
): ClientPaymentStatusResultV2 {
  const charges = toMonthlyCharges(client)
  const status = getLandingPaymentStatus(charges, today)

  return {
    status,
    label: CLIENT_PAYMENT_STATUS_V2_LABELS[status],
  }
}
