// src/domain/billing/__tests__/monthlyEngine.test.ts
import { describe, it, expect } from 'vitest'
import {
  calculateBillingDates,
  generateInstallments,
  getBillingAlert,
  BILLING_ALERT_LABELS,
} from '../monthlyEngine'

describe('calculateBillingDates', () => {
  it('returns valid output for a standard commissioning date', () => {
    const result = calculateBillingDates({
      data_comissionamento: '2025-03-15',
      dia_leitura: 10,
      dia_vencimento: 25,
      valor_mensalidade: 500,
    })

    expect(result.status_calculo).toBe('ok')
    expect(result.inicio_da_mensalidade).toBeInstanceOf(Date)
    expect(result.inicio_mensalidade_fixa).toBeInstanceOf(Date)
    expect(result.inicio_mensalidade_fixa.getDate()).toBe(25)
    expect(result.mensagem).toBeTruthy()
  })

  it('returns erro_entrada when data_comissionamento is missing', () => {
    const result = calculateBillingDates({
      data_comissionamento: '',
      dia_leitura: 10,
      dia_vencimento: 25,
      valor_mensalidade: 500,
    })

    expect(result.status_calculo).toBe('erro_entrada')
  })

  it('returns erro_entrada when dia_leitura is 0', () => {
    const result = calculateBillingDates({
      data_comissionamento: '2025-01-01',
      dia_leitura: 0,
      dia_vencimento: 25,
      valor_mensalidade: 500,
    })

    expect(result.status_calculo).toBe('erro_entrada')
  })

  it('returns erro_entrada when dia_vencimento is 0', () => {
    const result = calculateBillingDates({
      data_comissionamento: '2025-01-01',
      dia_leitura: 10,
      dia_vencimento: 0,
      valor_mensalidade: 500,
    })

    expect(result.status_calculo).toBe('erro_entrada')
  })

  it('calculates first billing with month offset based on commissioning vs reading day', () => {
    // Commissioned on Jan 5, reading day 10 → comDay(5) < readingDay(10) → offset +1
    // billing month = Jan+1 = Feb → due day 25 → Feb 25
    // Fixed billing = month after → Mar 25
    const result = calculateBillingDates({
      data_comissionamento: '2025-01-05',
      dia_leitura: 10,
      dia_vencimento: 25,
      valor_mensalidade: 400,
    })

    expect(result.status_calculo).toBe('ok')
    expect(result.inicio_da_mensalidade.getMonth()).toBe(1) // February (0-indexed)
    expect(result.inicio_da_mensalidade.getDate()).toBe(25)
    expect(result.inicio_mensalidade_fixa.getMonth()).toBe(2) // March
    expect(result.inicio_mensalidade_fixa.getDate()).toBe(25)
  })

  it('uses offset +2 when commissioning is on or after reading day', () => {
    // Commissioned on Jan 15, reading day 10 → comDay(15) >= readingDay(10) → offset +2
    // billing month = Jan+2 = Mar → due day 5 → Mar 5
    // Fixed billing = Apr 5
    const result = calculateBillingDates({
      data_comissionamento: '2025-01-15',
      dia_leitura: 10,
      dia_vencimento: 5,
      valor_mensalidade: 300,
    })

    expect(result.status_calculo).toBe('ok')
    expect(result.inicio_da_mensalidade.getMonth()).toBe(2) // March
    expect(result.inicio_da_mensalidade.getDate()).toBe(5)
    expect(result.inicio_mensalidade_fixa.getMonth()).toBe(3) // April
    expect(result.inicio_mensalidade_fixa.getDate()).toBe(5)
  })
})

describe('generateInstallments', () => {
  it('generates the correct number of installments', () => {
    const start = new Date('2025-01-25')
    const installments = generateInstallments({
      inicio_mensalidade: start,
      prazo: 12,
      dia_vencimento: 25,
      valor_mensalidade: 500,
    })

    expect(installments).toHaveLength(12)
  })

  it('generates installments with correct due dates', () => {
    const start = new Date('2025-03-10')
    const installments = generateInstallments({
      inicio_mensalidade: start,
      prazo: 3,
      dia_vencimento: 10,
      valor_mensalidade: 250,
    })

    expect(installments).toHaveLength(3)
    expect(installments[0].numero).toBe(1)
    expect(installments[0].data_vencimento.getDate()).toBe(10)
    expect(installments[0].valor).toBe(250)
    expect(installments[1].numero).toBe(2)
    expect(installments[2].numero).toBe(3)
  })

  it('returns empty array for zero prazo', () => {
    const installments = generateInstallments({
      inicio_mensalidade: new Date('2025-01-01'),
      prazo: 0,
      dia_vencimento: 10,
      valor_mensalidade: 100,
    })

    expect(installments).toHaveLength(0)
  })

  it('sets status based on date: future dates are pendente', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 2)
    const installments = generateInstallments({
      inicio_mensalidade: futureDate,
      prazo: 3,
      dia_vencimento: futureDate.getDate() || 15,
      valor_mensalidade: 300,
    })

    for (const inst of installments) {
      expect(inst.status).toBe('pendente')
    }
  })

  it('sets status vencida for past due dates automatically', () => {
    const pastDate = new Date('2020-01-01')
    const installments = generateInstallments({
      inicio_mensalidade: pastDate,
      prazo: 2,
      dia_vencimento: 15,
      valor_mensalidade: 300,
    })

    for (const inst of installments) {
      expect(inst.status).toBe('vencida')
    }
  })
})

describe('getBillingAlert', () => {
  it('returns "paga" when isPaid is true', () => {
    const alert = getBillingAlert(new Date('2020-01-01'), true)
    expect(alert.level).toBe('paga')
  })

  it('returns "vencida" for a past due date', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 5)
    const alert = getBillingAlert(pastDate, false)
    expect(alert.level).toBe('vencida')
  })

  it('returns "vence_hoje" for today', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const alert = getBillingAlert(today, false)
    expect(alert.level).toBe('vence_hoje')
  })

  it('returns "a_vencer" for a date within 7 days', () => {
    const nearDate = new Date()
    nearDate.setDate(nearDate.getDate() + 3)
    const alert = getBillingAlert(nearDate, false)
    expect(alert.level).toBe('a_vencer')
  })

  it('returns "ok" for a date far in the future', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const alert = getBillingAlert(futureDate, false)
    expect(alert.level).toBe('ok')
  })
})

describe('BILLING_ALERT_LABELS', () => {
  it('has labels for all alert levels', () => {
    expect(BILLING_ALERT_LABELS.a_vencer).toBe('A Vencer')
    expect(BILLING_ALERT_LABELS.vence_hoje).toBe('Vence Hoje')
    expect(BILLING_ALERT_LABELS.vencida).toBe('Vencida')
    expect(BILLING_ALERT_LABELS.paga).toBe('Paga')
    expect(BILLING_ALERT_LABELS.ok).toBe('Em Dia')
  })
})
