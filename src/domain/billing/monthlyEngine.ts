// src/domain/billing/monthlyEngine.ts
// Billing due-date engine.
//
// Calculates the start of monthly billing and the start of fixed
// billing based on the commissioning date, reading day, due day,
// and monthly amount.
//
// The engine is pure (no side-effects) and fully deterministic.

/** Maximum contract term in months. */
export const MAX_CONTRACT_TERM_MONTHS = 600

/** Days before due date that triggers the "a vencer" alert. */
export const DAYS_BEFORE_DUE_THRESHOLD = 5

/** Maximum number of billing alerts shown on the dashboard. */
export const MAX_DASHBOARD_ALERTS = 50

export interface MonthlyEngineInput {
  /** Date when the solar plant was commissioned (ISO string or Date). */
  data_comissionamento: string | Date
  /** Day of the month when the energy meter is read (1-31). */
  dia_leitura: number
  /** Day of the month when the bill is due (typically 5, 10, 15, 25, or 30). */
  dia_vencimento: number
  /** Fixed monthly amount in BRL. */
  valor_mensalidade: number
}

export interface MonthlyEngineOutput {
  /** Date when the first billing cycle begins. */
  inicio_da_mensalidade: Date
  /** Date when fixed monthly billing begins (first full month after commissioning). */
  inicio_mensalidade_fixa: Date
  /** Human-readable calculation status. */
  status_calculo: 'ok' | 'aguardando_comissionamento' | 'erro_entrada'
  /** Descriptive message for UI display. */
  mensagem: string
}

/**
 * Clamp a day number to a valid range for a given month/year, returning
 * the last day of the month when the requested day exceeds it.
 */
function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(day, lastDay)
}

/**
 * Compute billing start dates based on commissioning, reading, and due-day
 * parameters.
 *
 * Rules:
 * 1. The first billing (inicio_da_mensalidade) starts on the due-day of the
 *    month following the first full reading cycle after commissioning.
 *    – If commissioned BEFORE the reading day in month M, the first full
 *      reading cycle ends on `dia_leitura` of month M+1, so billing starts
 *      on `dia_vencimento` of month M+1.
 *    – If commissioned ON or AFTER the reading day in month M, the first
 *      full reading cycle ends on `dia_leitura` of month M+2, so billing
 *      starts on `dia_vencimento` of month M+2.
 * 2. Fixed monthly billing (inicio_mensalidade_fixa) starts on the
 *    `dia_vencimento` of the month after `inicio_da_mensalidade`.
 */
export function calculateBillingDates(input: MonthlyEngineInput): MonthlyEngineOutput {
  const { data_comissionamento, dia_leitura, dia_vencimento, valor_mensalidade } = input

  // Validate inputs
  if (
    !data_comissionamento ||
    dia_leitura < 1 || dia_leitura > 31 ||
    dia_vencimento < 1 || dia_vencimento > 31 ||
    valor_mensalidade < 0 ||
    !Number.isFinite(dia_leitura) ||
    !Number.isFinite(dia_vencimento) ||
    !Number.isFinite(valor_mensalidade)
  ) {
    return {
      inicio_da_mensalidade: new Date(NaN),
      inicio_mensalidade_fixa: new Date(NaN),
      status_calculo: 'erro_entrada',
      mensagem: 'Dados de entrada inválidos. Verifique comissionamento, dia de leitura e vencimento.',
    }
  }

  const comDate = typeof data_comissionamento === 'string'
    ? new Date(data_comissionamento)
    : new Date(data_comissionamento.getTime())

  if (isNaN(comDate.getTime())) {
    return {
      inicio_da_mensalidade: new Date(NaN),
      inicio_mensalidade_fixa: new Date(NaN),
      status_calculo: 'erro_entrada',
      mensagem: 'Data de comissionamento inválida.',
    }
  }

  // If commissioning is in the future, status is waiting
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (comDate > today) {
    // Still calculate projected dates but flag as waiting
    const result = computeDates(comDate, dia_leitura, dia_vencimento)
    return {
      ...result,
      status_calculo: 'aguardando_comissionamento',
      mensagem: `Comissionamento previsto para ${comDate.toLocaleDateString('pt-BR')}. Datas são projeções.`,
    }
  }

  const result = computeDates(comDate, dia_leitura, dia_vencimento)
  return {
    ...result,
    status_calculo: 'ok',
    mensagem: `Mensalidade inicia em ${result.inicio_da_mensalidade.toLocaleDateString('pt-BR')}. Valor: R$ ${valor_mensalidade.toFixed(2).replace('.', ',')}`,
  }
}

function computeDates(
  comDate: Date,
  diaLeitura: number,
  diaVencimento: number,
): Pick<MonthlyEngineOutput, 'inicio_da_mensalidade' | 'inicio_mensalidade_fixa'> {
  const comYear = comDate.getFullYear()
  const comMonth = comDate.getMonth()
  const comDay = comDate.getDate()

  const clampedLeitura = clampDay(comYear, comMonth, diaLeitura)

  // Determine the offset: if commissioned before reading day → +1 month, else → +2 months
  const monthOffset = comDay < clampedLeitura ? 1 : 2

  const billingMonth = comMonth + monthOffset
  const billingYear = comYear + Math.floor(billingMonth / 12)
  const billingMonthNormalized = ((billingMonth % 12) + 12) % 12

  const billingDay = clampDay(billingYear, billingMonthNormalized, diaVencimento)
  const inicioMensalidade = new Date(billingYear, billingMonthNormalized, billingDay)

  // Fixed billing starts the month after
  const fixedMonth = billingMonthNormalized + 1
  const fixedYear = billingYear + Math.floor(fixedMonth / 12)
  const fixedMonthNormalized = ((fixedMonth % 12) + 12) % 12
  const fixedDay = clampDay(fixedYear, fixedMonthNormalized, diaVencimento)
  const inicioMensalidadeFixa = new Date(fixedYear, fixedMonthNormalized, fixedDay)

  return {
    inicio_da_mensalidade: inicioMensalidade,
    inicio_mensalidade_fixa: inicioMensalidadeFixa,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Installment generation
// ─────────────────────────────────────────────────────────────────────────────

export interface Installment {
  /** 1-based installment number. */
  numero: number
  /** Due date for this installment. */
  data_vencimento: Date
  /** Amount in BRL. */
  valor: number
  /** Payment status. */
  status: 'pendente' | 'paga' | 'vencida' | 'cancelada'
}

export interface GenerateInstallmentsInput {
  /** Start date of the first installment (ISO string or Date). */
  inicio_mensalidade: string | Date
  /** Total number of installments (contract term in months). */
  prazo: number
  /** Day of the month when installments are due. */
  dia_vencimento: number
  /** Fixed monthly amount in BRL. */
  valor_mensalidade: number
}

/**
 * Generate a list of installments based on the billing start date,
 * contract term, due day, and monthly amount.
 */
export function generateInstallments(input: GenerateInstallmentsInput): Installment[] {
  const { inicio_mensalidade, prazo, dia_vencimento, valor_mensalidade } = input

  if (
    !inicio_mensalidade ||
    prazo < 1 || prazo > MAX_CONTRACT_TERM_MONTHS ||
    dia_vencimento < 1 || dia_vencimento > 31 ||
    valor_mensalidade < 0 ||
    !Number.isFinite(prazo) ||
    !Number.isFinite(dia_vencimento) ||
    !Number.isFinite(valor_mensalidade)
  ) {
    return []
  }

  const startDate = typeof inicio_mensalidade === 'string'
    ? new Date(inicio_mensalidade)
    : new Date(inicio_mensalidade.getTime())

  if (isNaN(startDate.getTime())) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const installments: Installment[] = []

  for (let i = 0; i < prazo; i++) {
    const month = startDate.getMonth() + i
    const year = startDate.getFullYear() + Math.floor(month / 12)
    const monthNormalized = ((month % 12) + 12) % 12

    const day = clampDay(year, monthNormalized, dia_vencimento)
    const dueDate = new Date(year, monthNormalized, day)

    let status: Installment['status'] = 'pendente'
    if (dueDate < today) {
      status = 'vencida'
    }

    installments.push({
      numero: i + 1,
      data_vencimento: dueDate,
      valor: valor_mensalidade,
      status,
    })
  }

  return installments
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing status helpers
// ─────────────────────────────────────────────────────────────────────────────

export type BillingAlertLevel = 'a_vencer' | 'vence_hoje' | 'vencida' | 'paga' | 'ok'

export interface BillingAlert {
  level: BillingAlertLevel
  label: string
  daysUntilDue: number
}

export const BILLING_ALERT_LABELS: Record<BillingAlertLevel, string> = {
  a_vencer: 'A Vencer',
  vence_hoje: 'Vence Hoje',
  vencida: 'Vencida',
  paga: 'Paga',
  ok: 'Em Dia',
}

/**
 * Determine the billing alert level for a given due date.
 * A bill is "a vencer" when it's due within 5 days.
 */
export function getBillingAlert(dueDate: Date | string, isPaid: boolean = false): BillingAlert {
  if (isPaid) {
    return { level: 'paga', label: BILLING_ALERT_LABELS.paga, daysUntilDue: 0 }
  }

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueNormalized = new Date(due.getFullYear(), due.getMonth(), due.getDate())

  const diffMs = dueNormalized.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { level: 'vencida', label: BILLING_ALERT_LABELS.vencida, daysUntilDue: diffDays }
  }
  if (diffDays === 0) {
    return { level: 'vence_hoje', label: BILLING_ALERT_LABELS.vence_hoje, daysUntilDue: 0 }
  }
  if (diffDays <= DAYS_BEFORE_DUE_THRESHOLD) {
    return { level: 'a_vencer', label: BILLING_ALERT_LABELS.a_vencer, daysUntilDue: diffDays }
  }

  return { level: 'ok', label: BILLING_ALERT_LABELS.ok, daysUntilDue: diffDays }
}
