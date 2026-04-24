// src/domain/billing/__tests__/billingDates.test.ts
import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonthsSafe,
  calculateBillingDates,
  clampDay,
  daysBetween,
  getDayOfMonth,
  getNextReadingDate,
  parseDate,
  startOfDay,
} from '../billingDates'

describe('parseDate', () => {
  it('returns null for missing values', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('   ')).toBeNull()
    expect(parseDate('not a date')).toBeNull()
  })

  it('parses YYYY-MM-DD as a local date', () => {
    const d = parseDate('2025-01-20')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2025)
    expect(d!.getMonth()).toBe(0)
    expect(d!.getDate()).toBe(20)
  })

  it('clones Date inputs', () => {
    const original = new Date(2025, 0, 20)
    const parsed = parseDate(original)
    expect(parsed).not.toBe(original)
    expect(parsed!.getTime()).toBe(original.getTime())
  })
})

describe('helpers', () => {
  it('startOfDay drops the time component', () => {
    const d = new Date(2025, 4, 10, 14, 30, 45, 500)
    const s = startOfDay(d)
    expect(s.getHours()).toBe(0)
    expect(s.getMinutes()).toBe(0)
    expect(s.getSeconds()).toBe(0)
    expect(s.getMilliseconds()).toBe(0)
  })

  it('addDays handles month rollovers', () => {
    expect(addDays(new Date(2025, 0, 20), 31).toISOString().slice(0, 10)).toBe('2025-02-20')
    expect(addDays(new Date(2025, 1, 1), -1).toISOString().slice(0, 10)).toBe('2025-01-31')
  })

  it('clampDay caps at the last day of the month', () => {
    expect(clampDay(2025, 1, 31)).toBe(28) // Feb 2025
    expect(clampDay(2024, 1, 31)).toBe(29) // Feb 2024 (leap)
    expect(clampDay(2025, 3, 31)).toBe(30) // April
    expect(clampDay(2025, 0, 10)).toBe(10)
  })

  it('daysBetween computes whole-day differences', () => {
    expect(daysBetween(new Date(2025, 0, 1), new Date(2025, 0, 31))).toBe(30)
    expect(daysBetween(new Date(2025, 0, 1), new Date(2025, 0, 1))).toBe(0)
  })
})

describe('getDayOfMonth', () => {
  it('returns the day for valid numeric inputs', () => {
    expect(getDayOfMonth(10)).toBe(10)
    expect(getDayOfMonth(1)).toBe(1)
    expect(getDayOfMonth(31)).toBe(31)
  })

  it('rejects out-of-range numbers', () => {
    expect(getDayOfMonth(0)).toBeNull()
    expect(getDayOfMonth(32)).toBeNull()
    expect(getDayOfMonth(Number.NaN)).toBeNull()
  })

  it('extracts day-of-month from Date / string', () => {
    expect(getDayOfMonth(new Date(2025, 4, 17))).toBe(17)
    expect(getDayOfMonth('2025-05-25')).toBe(25)
  })

  it('returns null for invalid strings', () => {
    expect(getDayOfMonth('xyz')).toBeNull()
    expect(getDayOfMonth(null)).toBeNull()
  })
})

describe('getNextReadingDate', () => {
  it('uses same month when reading day is after commissioning', () => {
    const r = getNextReadingDate(new Date(2025, 0, 1), 30)
    expect(r.getFullYear()).toBe(2025)
    expect(r.getMonth()).toBe(0)
    expect(r.getDate()).toBe(30)
  })

  it('uses next month when reading day already passed', () => {
    const r = getNextReadingDate(new Date(2025, 0, 25), 10)
    expect(r.getFullYear()).toBe(2025)
    expect(r.getMonth()).toBe(1)
    expect(r.getDate()).toBe(10)
  })

  it('clamps to last day of month for short months', () => {
    const r = getNextReadingDate(new Date(2025, 0, 31), 31)
    expect(r.getMonth()).toBe(1)
    expect(r.getDate()).toBe(28) // Feb 2025
  })
})

describe('addMonthsSafe', () => {
  it('preserves the preferred day when it exists', () => {
    const d = addMonthsSafe(new Date(2025, 0, 10), 1, 10)
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(10)
  })

  it('falls back to the last day of the destination month', () => {
    const d = addMonthsSafe(new Date(2025, 0, 31), 1, 31)
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(28)
  })

  it('rolls into the following year', () => {
    const d = addMonthsSafe(new Date(2025, 11, 10), 1, 10)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
  })
})

describe('calculateBillingDates', () => {
  it('1) returns NA when valorMensalidade is 0', () => {
    const out = calculateBillingDates({
      valorMensalidade: 0,
      dataComissionamento: '2025-01-01',
      diaLeituraDistribuidora: 30,
      diaVencimentoCliente: 10,
    })
    expect(out.status).toBe('NA')
    expect(out.dataPrimeiraCobranca).toBeNull()
    expect(out.vencimentoRecorrenteMensal).toBeNull()
    expect(out.proximaCobrancaRecorrente).toBeNull()
  })

  it('NA for null/undefined valorMensalidade', () => {
    expect(
      calculateBillingDates({
        valorMensalidade: null,
        dataComissionamento: '2025-01-01',
        diaLeituraDistribuidora: 30,
        diaVencimentoCliente: 10,
      }).status,
    ).toBe('NA')
  })

  it('2) AGUARDANDO when dataComissionamento is missing', () => {
    const out = calculateBillingDates({
      valorMensalidade: 500,
      dataComissionamento: null,
      diaLeituraDistribuidora: 30,
      diaVencimentoCliente: 10,
    })
    expect(out.status).toBe('AGUARDANDO')
  })

  it('3) AGUARDANDO when diaLeituraDistribuidora is missing', () => {
    const out = calculateBillingDates({
      valorMensalidade: 500,
      dataComissionamento: '2025-01-01',
      diaLeituraDistribuidora: null,
      diaVencimentoCliente: 10,
    })
    expect(out.status).toBe('AGUARDANDO')
  })

  it('4) AGUARDANDO when diaVencimentoCliente is missing', () => {
    const out = calculateBillingDates({
      valorMensalidade: 500,
      dataComissionamento: '2025-01-01',
      diaLeituraDistribuidora: 30,
      diaVencimentoCliente: null,
    })
    expect(out.status).toBe('AGUARDANDO')
  })

  it('5) commissioning 01/01, reading 30, due 10 → first billing 10/01 (interval ≥ 27)', () => {
    const out = calculateBillingDates({
      valorMensalidade: 500,
      dataComissionamento: '2025-01-01',
      diaLeituraDistribuidora: 30,
      diaVencimentoCliente: 10,
    })
    expect(out.status).toBe('OK')
    expect(out.dataPrimeiraCobranca!.getFullYear()).toBe(2025)
    expect(out.dataPrimeiraCobranca!.getMonth()).toBe(0) // January
    expect(out.dataPrimeiraCobranca!.getDate()).toBe(10)
    expect(out.vencimentoRecorrenteMensal).toBe(10)
    expect(out.proximaCobrancaRecorrente!.getMonth()).toBe(1) // February
    expect(out.proximaCobrancaRecorrente!.getDate()).toBe(10)
  })

  it('6) commissioning 20/01, reading 25, due 10 → first billing = +31 days, recorrência volta para dia 10', () => {
    const out = calculateBillingDates({
      valorMensalidade: 500,
      dataComissionamento: '2025-01-20',
      diaLeituraDistribuidora: 25,
      diaVencimentoCliente: 10,
    })
    expect(out.status).toBe('OK')
    // 20/01 + 31 days = 20/02
    expect(out.dataPrimeiraCobranca!.getFullYear()).toBe(2025)
    expect(out.dataPrimeiraCobranca!.getMonth()).toBe(1) // February
    expect(out.dataPrimeiraCobranca!.getDate()).toBe(20)
    expect(out.vencimentoRecorrenteMensal).toBe(10)
    // Next recurring billing: month after the first billing, on day 10
    expect(out.proximaCobrancaRecorrente!.getMonth()).toBe(2) // March
    expect(out.proximaCobrancaRecorrente!.getDate()).toBe(10)
  })

  it('7) due day 31 in February uses last day of February', () => {
    // commissioning 01/Jan/2025, reading 30 → first billing 31/Jan (clamped to 31).
    // Recurring from 31/Jan goes to 28/Feb.
    const out = calculateBillingDates({
      valorMensalidade: 500,
      dataComissionamento: '2025-01-01',
      diaLeituraDistribuidora: 30,
      diaVencimentoCliente: 31,
    })
    expect(out.status).toBe('OK')
    expect(out.dataPrimeiraCobranca!.getMonth()).toBe(0)
    expect(out.dataPrimeiraCobranca!.getDate()).toBe(31)
    expect(out.proximaCobrancaRecorrente!.getMonth()).toBe(1)
    expect(out.proximaCobrancaRecorrente!.getDate()).toBe(28)
  })

  it('8) reading day given as a full date uses only its day-of-month', () => {
    const out = calculateBillingDates({
      valorMensalidade: 500,
      dataComissionamento: '2025-01-01',
      diaLeituraDistribuidora: '2024-07-30', // only day-of-month (30) matters
      diaVencimentoCliente: 10,
    })
    expect(out.status).toBe('OK')
    expect(out.dataPrimeiraCobranca!.getMonth()).toBe(0)
    expect(out.dataPrimeiraCobranca!.getDate()).toBe(10)
  })

  it('9) cliente fora de GO — usa valorMensalidade já calculado, datas seguem as mesmas regras', () => {
    // The function does not depend on the regra used to compute valor
    // mensalidade — it only uses the final value. Same shape as test 5.
    const out = calculateBillingDates({
      valorMensalidade: 425.5, // calculated by standard rule
      dataComissionamento: '2025-03-01',
      diaLeituraDistribuidora: 28,
      diaVencimentoCliente: 5,
    })
    expect(out.status).toBe('OK')
    expect(out.dataPrimeiraCobranca!.getMonth()).toBe(2) // March
    expect(out.dataPrimeiraCobranca!.getDate()).toBe(5)
  })

  it('10) cliente GO com titularidade SolarInvest — datas idênticas com valorMensalidade da regra especial', () => {
    const out = calculateBillingDates({
      valorMensalidade: 1234.56, // calculated by GO/SolarInvest rule
      dataComissionamento: '2025-03-01',
      diaLeituraDistribuidora: 28,
      diaVencimentoCliente: 5,
    })
    expect(out.status).toBe('OK')
    expect(out.dataPrimeiraCobranca!.getMonth()).toBe(2)
    expect(out.dataPrimeiraCobranca!.getDate()).toBe(5)
  })
})
