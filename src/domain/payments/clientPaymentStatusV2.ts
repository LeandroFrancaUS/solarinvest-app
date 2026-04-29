// src/domain/payments/clientPaymentStatusV2.ts
// New payment status logic using month-specific calculations.
// Replaces the generic status logic in domain/billing/clientPaymentStatus.ts

import type { PortfolioClientRow } from '../../types/clientPortfolio'
import {
  getPortfolioPaymentStatus,
  type PortfolioPaymentStatus,
  PORTFOLIO_PAYMENT_STATUS_LABELS,
} from './paymentStatus'
import { convertToMonthlyPayments, isBillingActive } from './portfolioPaymentAdapter'

/**
 * Extended portfolio payment status that includes 'inativo' for non-billing clients.
 */
export type ClientPaymentStatusV2 = PortfolioPaymentStatus | 'INATIVO'

/**
 * Result object with status and display information.
 */
export interface ClientPaymentStatusResultV2 {
  status: ClientPaymentStatusV2
  label: string
}

/**
 * Display labels for client payment status (including inactive).
 */
export const CLIENT_PAYMENT_STATUS_V2_LABELS: Record<ClientPaymentStatusV2, string> = {
  ...PORTFOLIO_PAYMENT_STATUS_LABELS,
  INATIVO: 'Inativo',
}

/**
 * Determines the payment status for a portfolio client using the new month-specific logic.
 *
 * This replaces the generic getClientPaymentStatus function with accurate month-by-month
 * status calculation based on due dates and 5-day grace periods.
 *
 * @param client - The portfolio client to analyze
 * @param today - Reference date for calculations (defaults to current date)
 * @returns Status result with label
 */
export function getClientPaymentStatusV2(
  client: PortfolioClientRow,
  today: Date = new Date(),
): ClientPaymentStatusResultV2 {
  // Check if billing is active for this client
  if (!isBillingActive(client)) {
    return {
      status: 'INATIVO',
      label: CLIENT_PAYMENT_STATUS_V2_LABELS.INATIVO,
    }
  }

  const installments = client.installments_json ?? []

  // If no installments, billing is inactive
  if (installments.length === 0) {
    return {
      status: 'INATIVO',
      label: CLIENT_PAYMENT_STATUS_V2_LABELS.INATIVO,
    }
  }

  // Convert to monthly payment format
  const monthlyPayments = convertToMonthlyPayments(client)

  // If conversion failed (no valid dates), treat as inactive
  if (monthlyPayments.length === 0) {
    return {
      status: 'INATIVO',
      label: CLIENT_PAYMENT_STATUS_V2_LABELS.INATIVO,
    }
  }

  // Calculate portfolio status
  const status = getPortfolioPaymentStatus(monthlyPayments, today)

  return {
    status,
    label: CLIENT_PAYMENT_STATUS_V2_LABELS[status],
  }
}
