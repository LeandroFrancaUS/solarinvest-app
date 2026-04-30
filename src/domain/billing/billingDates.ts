// src/domain/billing/billingDates.ts
//
// Pure module that calculates the billing dates for a client based on
// commissioning date, distributor reading day and the customer-chosen
// due day.
//
// The monthly amount (`valorMensalidade`) is **not** recalculated here —
// it is provided pre-calculated by the upstream billing engines (GO with
// SolarInvest titularidade or the standard rule). This module only cares
// about the *dates*.
//
// Rules:
//
// 1. Status:
//    - `valorMensalidade` zero/null/empty → 'NA'
//    - any required field missing → 'AGUARDANDO'
//    - otherwise → 'OK'
//
// 2. First billing date:
//    - depends on the next distributor reading after commissioning;
//    - there must be at least 27 days between commissioning and that
//      next reading.
//    - if interval >= 27 days: first billing = customer's due day in the
//      month of the next reading;
//    - if interval < 27 days: first billing = commissioning + 31 days,
//      and recurring billings go back to the customer's due day.
//
// 3. Recurrence: customer's due day every month; if the destination
//    month does not have that day (e.g. 31 in February), use the last
//    day of the month.

export type BillingStatus = 'OK' | 'NA' | 'AGUARDANDO'

export type BillingInput = {
  /** Pre-calculated monthly amount in BRL. Not recomputed here. */
  valorMensalidade: number | null
  /** Commissioning / plant connection date. */
  dataComissionamento: Date | string | null
  /**
   * Typical distributor reading day. Accepts a number (1..31) or a
   * Date / ISO string from which only the day-of-month is used.
   */
  diaLeituraDistribuidora: number | Date | string | null
  /** Customer-chosen due day (1..31). */
  diaVencimentoCliente: number | null
}

export type BillingOutput = {
  status: BillingStatus
  dataPrimeiraCobranca: Date | null
  vencimentoRecorrenteMensal: number | null
  proximaCobrancaRecorrente: Date | null
  motivo?: string
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Parse a value into a Date. Accepts a Date instance or an ISO string
 * (including the "YYYY-MM-DD" shorthand, which is interpreted as a
 * local-time date to avoid UTC off-by-one issues in pt-BR locales).
 * Returns `null` when the input is missing or invalid.
 */
export function parseDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    // "YYYY-MM-DD" — treat as a local date to avoid TZ shifts.
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
    if (ymd) {
      const year = Number(ymd[1])
      const month = Number(ymd[2]) - 1
      const day = Number(ymd[3])
      // Basic range validation — rejects e.g. "2025-99-99".
      if (month < 0 || month > 11 || day < 1 || day > 31) return null
      const d = new Date(year, month, day)
      // Reject dates that JavaScript silently rolled over (e.g. Feb 30
      // would become Mar 02). This keeps the parser strict.
      if (
        Number.isNaN(d.getTime()) ||
        d.getFullYear() !== year ||
        d.getMonth() !== month ||
        d.getDate() !== day
      ) {
        return null
      }
      return d
    }

    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

/** Returns a new Date set to 00:00:00.000 local time. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Returns a new Date `days` days after `date` (preserving local TZ). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Returns the day-of-month (1..31) extracted from a number or Date /
 * ISO date. Returns `null` when the input cannot be interpreted as a
 * valid day.
 */
export function getDayOfMonth(value: number | Date | string | null | undefined): number | null {
  if (value == null || value === '') return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const day = Math.trunc(value)
    if (day >= 1 && day <= 31) return day
    // Out of range: try to interpret as a real date (e.g. Excel serial
    // numbers are not supported here — only proper Date/string values
    // can produce a day above 31).
    return null
  }

  const parsed = parseDate(value)
  if (!parsed) return null
  const day = parsed.getDate()
  return day >= 1 && day <= 31 ? day : null
}

/**
 * Clamp a desired day to the last day of the given month/year.
 * `month` is 0-indexed (Jan = 0).
 */
export function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.max(1, Math.min(day, lastDay))
}

/** Inclusive-of-direction whole-day difference between two dates. */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime()
  const b = startOfDay(to).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * Compute the next distributor reading date strictly after the
 * commissioning date.
 *
 * - If the reading day in the commissioning month is *after* the
 *   commissioning date, that month is used.
 * - Otherwise, the next month is used.
 * - The day is always clamped to the last day of the destination
 *   month, so e.g. reading day 31 in February becomes Feb 28/29.
 */
export function getNextReadingDate(dataComissionamento: Date, diaLeitura: number): Date {
  const com = startOfDay(dataComissionamento)
  const year = com.getFullYear()
  const month = com.getMonth()

  const sameMonthDay = clampDay(year, month, diaLeitura)
  if (sameMonthDay > com.getDate()) {
    return new Date(year, month, sameMonthDay)
  }

  const nextMonthIndex = month + 1
  const nextYear = year + Math.floor(nextMonthIndex / 12)
  const nextMonth = ((nextMonthIndex % 12) + 12) % 12
  const nextDay = clampDay(nextYear, nextMonth, diaLeitura)
  return new Date(nextYear, nextMonth, nextDay)
}

/**
 * Add `months` calendar months to a date while preserving a preferred
 * day-of-month, falling back to the last day of the destination month
 * when that day does not exist there.
 */
export function addMonthsSafe(date: Date, months: number, preferredDay: number): Date {
  const baseYear = date.getFullYear()
  const baseMonth = date.getMonth()
  const targetMonthIndex = baseMonth + months
  const targetYear = baseYear + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const day = clampDay(targetYear, targetMonth, preferredDay)
  return new Date(targetYear, targetMonth, day)
}

// ─────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the first billing date for a client.
 *
 * Priority:
 * 1. `manualFirstBillingDate` — when the user has explicitly overridden the
 *    date, this value is the source of truth.
 * 2. Automatic calculation from `commissioningDate`, `readingDay` and
 *    `dueDay` via `calculateBillingDates`.
 *
 * Returns `null` when neither the manual date nor the automatic calculation
 * can produce a valid date.
 */
export function resolveFirstBillingDate({
  manualFirstBillingDate,
  commissioningDate,
  readingDay,
  dueDay,
  valorMensalidade,
}: {
  manualFirstBillingDate: Date | string | null | undefined
  commissioningDate: Date | string | null | undefined
  readingDay: number | Date | string | null | undefined
  dueDay: number | null | undefined
  valorMensalidade?: number | null
}): Date | null {
  const manual = parseDate(
    manualFirstBillingDate instanceof Date || typeof manualFirstBillingDate === 'string'
      ? manualFirstBillingDate
      : null,
  )
  if (manual) return manual

  const auto = calculateBillingDates({
    valorMensalidade: valorMensalidade ?? 1,
    dataComissionamento: commissioningDate ?? null,
    diaLeituraDistribuidora: readingDay ?? null,
    diaVencimentoCliente: dueDay ?? null,
  })
  return auto.dataPrimeiraCobranca
}

/**
 * Compute billing dates for a client. See module header for the full
 * specification.
 *
 * Summary of the date rules (the monthly amount itself is **not**
 * recomputed here):
 * - When at least 27 days separate the commissioning date from the
 *   next distributor reading, the first billing falls on the
 *   customer's chosen due day in the month of that next reading.
 * - When the interval is shorter than 27 days, the first billing is
 *   shifted to commissioning + 31 days; the subsequent recurring
 *   billings still fall on the customer's chosen due day.
 */
export function calculateBillingDates(input: BillingInput): BillingOutput {
  // Status: NA — no billable amount.
  if (
    input.valorMensalidade == null ||
    !Number.isFinite(input.valorMensalidade) ||
    input.valorMensalidade <= 0
  ) {
    return {
      status: 'NA',
      dataPrimeiraCobranca: null,
      vencimentoRecorrenteMensal: null,
      proximaCobrancaRecorrente: null,
      motivo: 'Mensalidade zerada ou não aplicável',
    }
  }

  const dataComissionamento = parseDate(input.dataComissionamento)
  const diaLeitura = getDayOfMonth(input.diaLeituraDistribuidora)
  const diaVencimento =
    typeof input.diaVencimentoCliente === 'number' &&
    Number.isFinite(input.diaVencimentoCliente) &&
    input.diaVencimentoCliente >= 1 &&
    input.diaVencimentoCliente <= 31
      ? Math.trunc(input.diaVencimentoCliente)
      : null

  // Status: AGUARDANDO — required data missing or invalid.
  if (!dataComissionamento || !diaLeitura || !diaVencimento) {
    return {
      status: 'AGUARDANDO',
      dataPrimeiraCobranca: null,
      vencimentoRecorrenteMensal: null,
      proximaCobrancaRecorrente: null,
      motivo: 'Dados de cobrança incompletos',
    }
  }

  const proximaLeitura = getNextReadingDate(dataComissionamento, diaLeitura)
  const intervaloDias = daysBetween(dataComissionamento, proximaLeitura)

  let dataPrimeiraCobranca: Date
  if (intervaloDias >= 27) {
    const year = proximaLeitura.getFullYear()
    const month = proximaLeitura.getMonth()
    dataPrimeiraCobranca = new Date(year, month, clampDay(year, month, diaVencimento))
  } else {
    dataPrimeiraCobranca = addDays(dataComissionamento, 31)
  }

  const proximaCobrancaRecorrente = addMonthsSafe(dataPrimeiraCobranca, 1, diaVencimento)

  return {
    status: 'OK',
    dataPrimeiraCobranca,
    vencimentoRecorrenteMensal: diaVencimento,
    proximaCobrancaRecorrente,
  }
}
