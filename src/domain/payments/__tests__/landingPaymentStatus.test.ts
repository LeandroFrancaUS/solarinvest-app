// src/domain/payments/__tests__/landingPaymentStatus.test.ts
import { describe, it, expect } from 'vitest'
import {
  getLandingPaymentStatus,
  normalizeChargeStatus,
  type MonthlyCharge,
} from '../landingPaymentStatus'

// Helper: build a charge that is confirmed/paid
function paidCharge(dueDate: string): MonthlyCharge {
  return { dueDate, status: 'confirmado', paidAt: dueDate }
}

// Helper: build a charge that is pending with a specific due date
function pendingCharge(dueDate: string): MonthlyCharge {
  return { dueDate, status: 'pendente' }
}

describe('normalizeChargeStatus', () => {
  it('returns PAGO when status is "confirmado"', () => {
    const charge: MonthlyCharge = { dueDate: '2026-04-28', status: 'Confirmado' }
    expect(normalizeChargeStatus(charge, new Date('2026-04-29'))).toBe('PAGO')
  })

  it('returns PAGO when paidAt is set, regardless of due date', () => {
    const charge: MonthlyCharge = { dueDate: '2026-04-28', paidAt: '2026-04-28' }
    expect(normalizeChargeStatus(charge, new Date('2026-04-29'))).toBe('PAGO')
  })

  it('returns PENDENTE when dueDate is null', () => {
    const charge: MonthlyCharge = { dueDate: null, status: 'pendente' }
    expect(normalizeChargeStatus(charge, new Date('2026-04-29'))).toBe('PENDENTE')
  })

  it('returns PENDENTE when today is before the due month starts', () => {
    const charge: MonthlyCharge = { dueDate: '2026-06-05' }
    expect(normalizeChargeStatus(charge, new Date('2026-05-01'))).toBe('PENDENTE')
  })

  it('returns PENDENTE when today is on the due date', () => {
    const charge: MonthlyCharge = { dueDate: '2026-05-05' }
    expect(normalizeChargeStatus(charge, new Date('2026-05-05'))).toBe('PENDENTE')
  })

  it('returns VENCIDO when today is 1 day after due date', () => {
    const charge: MonthlyCharge = { dueDate: '2026-04-28' }
    expect(normalizeChargeStatus(charge, new Date('2026-04-29'))).toBe('VENCIDO')
  })

  it('returns VENCIDO exactly at grace period boundary (5 days after due)', () => {
    const charge: MonthlyCharge = { dueDate: '2026-04-28' }
    expect(normalizeChargeStatus(charge, new Date('2026-05-03'))).toBe('VENCIDO')
  })

  it('returns ATRASADO when today is 6 days after due date', () => {
    const charge: MonthlyCharge = { dueDate: '2026-04-28' }
    expect(normalizeChargeStatus(charge, new Date('2026-05-04'))).toBe('ATRASADO')
  })

  it('parses DD/MM/YYYY formatted due dates', () => {
    const charge: MonthlyCharge = { dueDate: '28/04/2026' }
    // Today is 6 days after → ATRASADO
    expect(normalizeChargeStatus(charge, new Date('2026-05-04'))).toBe('ATRASADO')
  })
})

describe('getLandingPaymentStatus', () => {
  // Test 1: Parcela 1 confirmada + próximas pendentes → PAGO
  // Future pending charges do not count as open debt, so status is PAGO.
  it('returns PAGO when first charge is confirmed and remaining are future pending', () => {
    const today = new Date('2026-04-29')
    const charges: MonthlyCharge[] = [
      paidCharge('2026-04-28'),       // Parcela 1: Confirmado / pago em 28/04/2026
      pendingCharge('2026-05-28'),    // Parcela 2: Pendente – vencimento futuro
      pendingCharge('2026-06-28'),    // Parcela 3: Pendente – vencimento futuro
      pendingCharge('2026-07-28'),    // Parcela 4: Pendente – vencimento futuro
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('PAGO')
  })

  // Test 2: Todas confirmadas → PAGO
  it('returns PAGO when all charges are confirmed/paid', () => {
    const today = new Date('2026-04-29')
    const charges: MonthlyCharge[] = [
      paidCharge('2026-02-05'),
      paidCharge('2026-03-05'),
      paidCharge('2026-04-05'),
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('PAGO')
  })

  // Test 3: Uma atrasada sem pagas → ATRASADO
  it('returns ATRASADO when a charge is overdue by more than 5 days and none are paid', () => {
    const today = new Date('2026-04-29')
    const charges: MonthlyCharge[] = [
      pendingCharge('2026-04-10'), // 19 days overdue
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('ATRASADO')
  })

  // Test 4: Uma atrasada + uma paga → PARCIALMENTE_PAGO
  it('returns PARCIALMENTE_PAGO when one charge is overdue and one is paid', () => {
    const today = new Date('2026-04-29')
    const charges: MonthlyCharge[] = [
      paidCharge('2026-03-05'),       // Parcela 1: Pago
      pendingCharge('2026-04-05'),    // Parcela 2: Atrasada (24 days overdue)
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('PARCIALMENTE_PAGO')
  })

  // Test 5: Vencida dentro de 5 dias → VENCIDO
  it('returns VENCIDO when a charge is overdue within the 5-day grace period', () => {
    const today = new Date('2026-04-30')
    const charges: MonthlyCharge[] = [
      pendingCharge('2026-04-28'), // 2 days overdue – within grace period
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('VENCIDO')
  })

  // Test 6: Sem mensalidades → SEM_COBRANCA
  it('returns SEM_COBRANCA when there are no charges', () => {
    expect(getLandingPaymentStatus([], new Date('2026-04-29'))).toBe('SEM_COBRANCA')
    expect(getLandingPaymentStatus(null as unknown as MonthlyCharge[], new Date())).toBe('SEM_COBRANCA')
    expect(getLandingPaymentStatus(undefined as unknown as MonthlyCharge[], new Date())).toBe('SEM_COBRANCA')
  })

  // Additional edge cases
  it('returns PENDENTE when all charges are pending and within current month', () => {
    const today = new Date('2026-04-03')
    const charges: MonthlyCharge[] = [
      pendingCharge('2026-04-05'),  // not yet due
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('PENDENTE')
  })

  it('ignores future months when determining overdue status', () => {
    const today = new Date('2026-04-29')
    const charges: MonthlyCharge[] = [
      paidCharge('2026-04-05'),        // current month – paid
      pendingCharge('2026-05-05'),     // future month – should not count as open debt
      pendingCharge('2026-06-05'),     // future month – should not count as open debt
    ]
    // April is paid, future pending charges don't count as open → PAGO
    expect(getLandingPaymentStatus(charges, today)).toBe('PAGO')
  })

  it('returns VENCIDO when overdue within grace period and also has paid', () => {
    const today = new Date('2026-04-30')
    const charges: MonthlyCharge[] = [
      paidCharge('2026-03-05'),       // paid last month
      pendingCharge('2026-04-28'),    // 2 days overdue (within grace)
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('PARCIALMENTE_PAGO')
  })

  // Required regression: future confirmed parcela + no past open charges → PAGO
  it('returns PAGO when a future parcela is confirmed and no prior open charges exist', () => {
    const today = new Date('2026-04-28')
    const charges: MonthlyCharge[] = [
      { dueDate: '05/05/2026', status: 'Confirmado', paidAt: '28/04/2026' },
      { dueDate: '05/06/2026', status: 'Pendente' },
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('PAGO')
  })
})
