import { describe, it, expect } from 'vitest'
import { getLandingPaymentStatus } from '../paymentStatusEngine'

describe('paymentStatusEngine', () => {
  it('future paid = PAGO', () => {
    const today = new Date('2026-04-28')
    const charges = [
      { data_vencimento: '2026-05-05', status: 'Confirmado', paid_at: '2026-04-28' },
      { data_vencimento: '2026-06-05', status: 'Pendente' },
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('PAGO')
  })

  it('paid + overdue = PARCIALMENTE_PAGO', () => {
    const today = new Date('2026-06-20')
    const charges = [
      { data_vencimento: '2026-05-05', status: 'Confirmado', paid_at: '2026-05-04' },
      { data_vencimento: '2026-06-05', status: 'Pendente' },
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('PARCIALMENTE_PAGO')
  })

  it('overdue only = ATRASADO', () => {
    const today = new Date('2026-06-20')
    const charges = [
      { data_vencimento: '2026-06-05', status: 'Pendente' },
    ]
    expect(getLandingPaymentStatus(charges, today)).toBe('ATRASADO')
  })
})
