// src/domain/payments/clientPaymentStatusV2.ts
// Payment status for the Carteira Ativa landing page.
// Source of truth: installments_json from the billing table.
// Does NOT rely on contract_status, contract_type, or isBillingActive.

import type { PortfolioClientRow } from '../../types/clientPortfolio'
import {
  getLandingPaymentStatus,
  type LandingPaymentStatus,
  LANDING_PAYMENT_STATUS_LABELS,
  type MonthlyCharge,
} from './landingPaymentStatus'

export type ClientPaymentStatusV2 = LandingPaymentStatus

export interface ClientPaymentStatusResultV2 {
  status: ClientPaymentStatusV2
  label: string
}

export const CLIENT_PAYMENT_STATUS_V2_LABELS: Record<ClientPaymentStatusV2, string> =
  LANDING_PAYMENT_STATUS_LABELS

function resolveInstallmentDueDate(client: PortfolioClientRow, installmentNumber: number): string | null {
  const startDate =
    client.first_billing_date ?? client.inicio_da_mensalidade ?? client.commissioning_date_billing
  if (!startDate) return null

  const dueDay = client.due_day
  if (!dueDay || dueDay < 1 || dueDay > 31) return null

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  const safeNumber = installmentNumber > 0 ? installmentNumber : 1
  const month = start.getMonth() + (safeNumber - 1)
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

function readInstallments(raw: unknown): Array<{ number?: number; status?: string; paid_at?: string | null; paidAt?: string | null; payment_date?: string | null }> {
  if (Array.isArray(raw)) return raw as Array<{ number?: number; status?: string; paid_at?: string | null; paidAt?: string | null; payment_date?: string | null }>
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function toMonthlyCharges(client: PortfolioClientRow): MonthlyCharge[] {
  const installments = readInstallments(client.installments_json)
  return installments.map((inst, index) => {
    const number = typeof inst.number === 'number' && inst.number > 0 ? inst.number : index + 1
    return {
      dueDate: resolveInstallmentDueDate(client, number),
      status: inst.status,
      paidAt: inst.paid_at ?? inst.paidAt ?? inst.payment_date ?? null,
    }
  })
}

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
