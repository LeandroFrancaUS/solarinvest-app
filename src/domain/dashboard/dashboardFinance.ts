import type { PortfolioClientRow, InstallmentPayment } from '../../types/clientPortfolio'
import {
  getChargeDueDate,
  isPaidLike,
  normalizeMonthlyPaymentStatus,
  type MonthlyChargeLike,
} from '../billing/paymentStatusEngine'

export interface DashboardFinanceKPIs {
  salesContractedValue: number
  leasingMonthlyRevenue: number
  leasingContractedValue: number
  realRevenueCurrentMonth: number
  overdueRevenue: number
  revenueAtRisk: number
  overdueClients: number
  defaultRate: number
  projectedRevenueNext30Days: number
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function isLeasing(row: PortfolioClientRow): boolean {
  return row.contract_type === 'leasing' || String(row.modalidade ?? '').toLowerCase() === 'leasing'
}

function isSale(row: PortfolioClientRow): boolean {
  return row.contract_type === 'sale' || row.contract_type === 'buyout'
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function resolveStartDate(row: PortfolioClientRow): Date | null {
  const raw =
    row.first_billing_date ??
    row.inicio_da_mensalidade ??
    row.commissioning_date_billing ??
    row.billing_start_date ??
    row.contract_start_date
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : startOfDay(date)
}

function resolveDueDay(row: PortfolioClientRow): number {
  const day = Number(row.due_day)
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : 5
}

function dueDateForInstallment(row: PortfolioClientRow, number: number): Date | null {
  const start = resolveStartDate(row)
  if (!start) return null
  const base = addMonths(start, Math.max(0, number - 1))
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  return new Date(base.getFullYear(), base.getMonth(), Math.min(resolveDueDay(row), lastDay))
}

function normalizeInstallments(raw: unknown): InstallmentPayment[] {
  if (Array.isArray(raw)) return raw as InstallmentPayment[]
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function buildCharges(row: PortfolioClientRow): Array<MonthlyChargeLike & { value: number }> {
  const monthlyValue = toNumber(row.valor_mensalidade ?? row.mensalidade)
  const installments = normalizeInstallments(row.installments_json)

  if (installments.length > 0) {
    return installments.map((inst, index) => {
      const number = Number(inst.number || index + 1)
      return {
        number,
        dueDate: dueDateForInstallment(row, number),
        status: inst.status,
        paid_at: inst.paid_at,
        paidAt: inst.paid_at,
        value: toNumber(inst.valor_override ?? monthlyValue),
      }
    })
  }

  const term = Number(row.contractual_term_months ?? row.term_months ?? row.prazo_meses ?? 0)
  if (!monthlyValue || !term) return []

  return Array.from({ length: term }, (_, index) => {
    const number = index + 1
    return {
      number,
      dueDate: dueDateForInstallment(row, number),
      status: 'pendente',
      value: monthlyValue,
    }
  })
}

export function computeDashboardFinanceKPIs(
  portfolio: PortfolioClientRow[],
  todayInput: Date = new Date(),
): DashboardFinanceKPIs {
  const today = startOfDay(todayInput)
  const currentMonth = monthKey(today)
  const next30 = new Date(today)
  next30.setDate(next30.getDate() + 30)

  let salesContractedValue = 0
  let leasingMonthlyRevenue = 0
  let leasingContractedValue = 0
  let realRevenueCurrentMonth = 0
  let overdueRevenue = 0
  let revenueAtRisk = 0
  let projectedRevenueNext30Days = 0
  let openRevenue = 0
  const overdueClientIds = new Set<number>()

  for (const row of portfolio) {
    if (isSale(row)) {
      salesContractedValue += toNumber(row.buyout_amount_reference ?? row.valordemercado)
    }

    if (!isLeasing(row)) continue

    const monthlyValue = toNumber(row.valor_mensalidade ?? row.mensalidade)
    leasingMonthlyRevenue += monthlyValue

    const term = Number(row.contractual_term_months ?? row.term_months ?? row.prazo_meses ?? 0)
    leasingContractedValue += monthlyValue * (Number.isFinite(term) ? term : 0)

    for (const charge of buildCharges(row)) {
      const due = getChargeDueDate(charge)
      const status = normalizeMonthlyPaymentStatus(charge, today)
      const value = toNumber(charge.value)
      if (!value) continue

      if (isPaidLike(charge) && due && monthKey(due) === currentMonth) realRevenueCurrentMonth += value

      if (!isPaidLike(charge)) {
        openRevenue += value
        if (status === 'VENCIDO' || status === 'ATRASADO') {
          overdueRevenue += value
          overdueClientIds.add(row.id)
        }
        if (status === 'ATRASADO') revenueAtRisk += value
        if (due && due >= today && due <= next30) projectedRevenueNext30Days += value
      }
    }
  }

  return {
    salesContractedValue,
    leasingMonthlyRevenue,
    leasingContractedValue,
    realRevenueCurrentMonth,
    overdueRevenue,
    revenueAtRisk,
    overdueClients: overdueClientIds.size,
    defaultRate: openRevenue > 0 ? overdueRevenue / openRevenue : 0,
    projectedRevenueNext30Days,
  }
}
