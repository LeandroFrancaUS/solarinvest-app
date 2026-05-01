// src/domain/payments/clientPaymentStatusV2.ts

import type { PortfolioClientRow } from '../../types/clientPortfolio'
import {
  getLandingPaymentStatus,
  type LandingPaymentStatus,
  LANDING_PAYMENT_STATUS_META,
  type MonthlyChargeLike,
} from '../billing/paymentStatusEngine'

export type ClientPaymentStatusV2 = LandingPaymentStatus

export interface ClientPaymentStatusResultV2 {
  status: ClientPaymentStatusV2
  label: string
}

export const CLIENT_PAYMENT_STATUS_V2_LABELS: Record<ClientPaymentStatusV2, string> =
  Object.fromEntries(
    Object.entries(LANDING_PAYMENT_STATUS_META).map(([k, v]) => [k, v.label]),
  ) as Record<ClientPaymentStatusV2, string>

function parseInstallments(raw: unknown): any[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

function resolveDueDate(client: PortfolioClientRow, index: number): string | null {
  const startDate =
    client.first_billing_date ??
    client.inicio_da_mensalidade ??
    client.commissioning_date_billing

  if (!startDate || !client.due_day) return null

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  const month = start.getMonth() + index
  const year = start.getFullYear() + Math.floor(month / 12)
  const m = ((month % 12) + 12) % 12

  const lastDay = new Date(year, m + 1, 0).getDate()
  const day = Math.min(client.due_day, lastDay)

  const d = new Date(year, m, day)

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function toCharges(client: PortfolioClientRow): MonthlyChargeLike[] {
  const installments = parseInstallments(client.installments_json)

  return installments.map((inst: any, i: number) => ({
    dueDate: resolveDueDate(client, inst.number ? inst.number - 1 : i),
    status: inst.status ?? inst.payment_status,
    paidAt: inst.paid_at ?? inst.paidAt ?? inst.payment_date ?? null,
  }))
}

export function getClientPaymentStatusV2(
  client: PortfolioClientRow,
  today: Date = new Date(),
): ClientPaymentStatusResultV2 {
  const charges = toCharges(client)
  const status = getLandingPaymentStatus(charges, today)

  return {
    status,
    label: CLIENT_PAYMENT_STATUS_V2_LABELS[status],
  }
}