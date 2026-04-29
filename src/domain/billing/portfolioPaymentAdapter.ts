// src/domain/billing/portfolioPaymentAdapter.ts
//
// Adapter between Carteira Ativa client rows / generated mensalidades and
// the pure payment status engine. This keeps UI components tiny and prevents
// status rules from leaking into JSX.

import type { Installment } from './monthlyEngine'
import {
  getLandingPaymentStatus,
  type LandingPaymentStatus,
  type MonthlyChargeLike,
} from './paymentStatusEngine'

export interface InstallmentPaymentLike {
  number?: number | null
  numero?: number | null
  status?: string | null
  payment_status?: string | null
  paid_at?: string | Date | null
  paidAt?: string | Date | null
  paidDate?: string | Date | null
  payment_date?: string | Date | null
}

export interface PortfolioPaymentSource {
  installments_json?: InstallmentPaymentLike[] | null
}

function getPaymentNumber(payment: InstallmentPaymentLike): number | null {
  const raw = payment.number ?? payment.numero
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

function toChargeFromPayment(payment: InstallmentPaymentLike): MonthlyChargeLike {
  return {
    number: payment.number ?? payment.numero ?? null,
    status: payment.status ?? payment.payment_status ?? null,
    paid_at: payment.paid_at ?? payment.paidAt ?? payment.paidDate ?? payment.payment_date ?? null,
  }
}

function toChargeFromGeneratedInstallment(
  installment: Installment,
  payment?: InstallmentPaymentLike,
): MonthlyChargeLike {
  return {
    number: installment.numero,
    data_vencimento: installment.data_vencimento,
    status: payment?.status ?? payment?.payment_status ?? installment.status,
    paid_at: payment?.paid_at ?? payment?.paidAt ?? payment?.paidDate ?? payment?.payment_date ?? null,
  }
}

/**
 * Builds normalized charges by merging generated due dates with persisted
 * per-installment payment rows (`installments_json`).
 *
 * If generated installments are not available yet, it still preserves paid
 * rows so future confirmed payments can produce PAGO instead of SEM_COBRANCA.
 */
export function buildPortfolioMonthlyCharges(
  source: PortfolioPaymentSource | null | undefined,
  generatedInstallments: Installment[] = [],
): MonthlyChargeLike[] {
  const payments = source?.installments_json ?? []
  const paymentByNumber = new Map<number, InstallmentPaymentLike>()

  for (const payment of payments) {
    const n = getPaymentNumber(payment)
    if (n != null) paymentByNumber.set(n, payment)
  }

  const charges = generatedInstallments.map((installment) =>
    toChargeFromGeneratedInstallment(installment, paymentByNumber.get(installment.numero)),
  )

  if (charges.length > 0) return charges

  return payments.map(toChargeFromPayment)
}

export function resolvePortfolioLandingPaymentStatus(
  source: PortfolioPaymentSource | null | undefined,
  generatedInstallments: Installment[] = [],
  today: Date = new Date(),
): LandingPaymentStatus {
  return getLandingPaymentStatus(buildPortfolioMonthlyCharges(source, generatedInstallments), today)
}
