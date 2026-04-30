// src/domain/payments/__tests__/paymentStatus.test.ts
import { describe, it, expect } from 'vitest'
import {
  getMonthlyPaymentStatus,
  getPortfolioPaymentStatus,
  type MonthlyPayment,
} from '../paymentStatus'

describe('getMonthlyPaymentStatus', () => {
  describe('PAGO status', () => {
    it('should return PAGO when paidAt is set', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: '2026-05-03',
      }
      const today = new Date('2026-05-10')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('PAGO')
    })

    it('should return PAGO even if overdue but paidAt is set', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: '2026-05-15', // paid after due date
      }
      const today = new Date('2026-05-20')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('PAGO')
    })
  })

  describe('PENDENTE status', () => {
    it('should return PENDENTE on first day of month (before due date)', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-05-01')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('PENDENTE')
    })

    it('should return PENDENTE on due date itself', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-05-05')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('PENDENTE')
    })

    it('should return PENDENTE one day before due date', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-05-04')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('PENDENTE')
    })

    it('should return PENDENTE when before reference month starts', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-04-30')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('PENDENTE')
    })
  })

  describe('VENCIDO status', () => {
    it('should return VENCIDO one day after due date', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-05-06')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('VENCIDO')
    })

    it('should return VENCIDO five days after due date (grace period boundary)', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-05-10')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('VENCIDO')
    })

    it('should return VENCIDO three days after due date', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-05-08')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('VENCIDO')
    })
  })

  describe('ATRASADO status', () => {
    it('should return ATRASADO six days after due date', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-05-11')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('ATRASADO')
    })

    it('should return ATRASADO many days after due date', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-05',
        paidAt: null,
      }
      const today = new Date('2026-06-15')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('ATRASADO')
    })
  })

  describe('Edge cases', () => {
    it('should handle due date at end of month', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-05',
        dueDate: '2026-05-31',
        paidAt: null,
      }
      const today = new Date('2026-05-31')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('PENDENTE')

      const tomorrow = new Date('2026-06-01')
      expect(getMonthlyPaymentStatus(payment, tomorrow)).toBe('VENCIDO')
    })

    it('should handle February due dates', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2026-02',
        dueDate: '2026-02-28',
        paidAt: null,
      }
      const today = new Date('2026-03-01')
      expect(getMonthlyPaymentStatus(payment, today)).toBe('VENCIDO')
    })

    it('should use current date when today parameter is not provided', () => {
      const payment: MonthlyPayment = {
        referenceMonth: '2020-01',
        dueDate: '2020-01-05',
        paidAt: null,
      }
      // Should be ATRASADO since 2020-01-05 is long past
      expect(getMonthlyPaymentStatus(payment)).toBe('ATRASADO')
    })
  })
})

describe('getPortfolioPaymentStatus', () => {
  describe('PAGO status', () => {
    it('should return PAGO when all relevant payments are paid', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: '2026-01-04' },
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: '2026-02-03' },
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: '2026-03-04' },
      ]
      const today = new Date('2026-03-15')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PAGO')
    })

    it('should return PAGO when all past payments are paid, ignoring future months', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: '2026-01-04' },
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: '2026-02-03' },
        { referenceMonth: '2026-06', dueDate: '2026-06-05', paidAt: null }, // future month
      ]
      const today = new Date('2026-03-15')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PAGO')
    })
  })

  describe('PARCIALMENTE_PAGO status', () => {
    it('should return PARCIALMENTE_PAGO when has delayed + paid payments', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: '2026-01-04' }, // paid
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: '2026-02-03' }, // paid
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: null }, // delayed (>5 days)
      ]
      const today = new Date('2026-03-15')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PARCIALMENTE_PAGO')
    })

    it('should return PARCIALMENTE_PAGO with mixed statuses including delayed', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: '2026-01-04' }, // paid
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: null }, // delayed
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: null }, // delayed
        { referenceMonth: '2026-04', dueDate: '2026-04-05', paidAt: '2026-04-04' }, // paid
      ]
      const today = new Date('2026-04-20')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PARCIALMENTE_PAGO')
    })
  })

  describe('ATRASADO status', () => {
    it('should return ATRASADO when has delayed payments and no paid payments', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: null }, // delayed
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: null }, // delayed
      ]
      const today = new Date('2026-03-15')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('ATRASADO')
    })

    it('should return ATRASADO with one severely overdue payment', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: null }, // delayed (>5 days)
      ]
      const today = new Date('2026-01-15')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('ATRASADO')
    })
  })

  describe('VENCIDO status', () => {
    it('should return VENCIDO when has overdue (1-5 days) and no delayed', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: '2026-01-04' }, // paid
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: null }, // overdue 3 days
      ]
      const today = new Date('2026-02-08')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('VENCIDO')
    })

    it('should return VENCIDO on last day of grace period', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: null }, // overdue 5 days
      ]
      const today = new Date('2026-03-10')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('VENCIDO')
    })
  })

  describe('PENDENTE status', () => {
    it('should return PENDENTE when all payments are pending (not overdue)', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: null }, // pending
        { referenceMonth: '2026-04', dueDate: '2026-04-05', paidAt: null }, // future
      ]
      const today = new Date('2026-03-03')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PENDENTE')
    })

    it('should return PENDENTE when mix of paid and pending (no overdue)', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: '2026-01-04' }, // paid
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: '2026-02-03' }, // paid
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: null }, // pending
      ]
      const today = new Date('2026-03-03')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PENDENTE')
    })

    it('should return PENDENTE when empty payments array', () => {
      const payments: MonthlyPayment[] = []
      const today = new Date('2026-03-15')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PENDENTE')
    })
  })

  describe('Future months handling', () => {
    it('should ignore future months when determining status', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: '2026-01-04' }, // paid
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: '2026-02-03' }, // paid
        { referenceMonth: '2026-05', dueDate: '2026-05-05', paidAt: null }, // future month - ignored
        { referenceMonth: '2026-06', dueDate: '2026-06-05', paidAt: null }, // future month - ignored
      ]
      const today = new Date('2026-03-15')
      // Should be PAGO since only Jan and Feb are relevant and both are paid
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PAGO')
    })

    it('should include current month in calculations', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: null }, // current month, pending
      ]
      const today = new Date('2026-03-03')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PENDENTE')
    })
  })

  describe('Complex scenarios', () => {
    it('should handle scenario from requirements: Jan paid, Feb paid, Mar delayed', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: '2026-01-04' },
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: '2026-02-03' },
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: null }, // delayed
      ]
      const today = new Date('2026-03-15') // More than 5 days after March due date
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PARCIALMENTE_PAGO')
    })

    it('should prioritize PARCIALMENTE_PAGO over ATRASADO when both delayed and paid exist', () => {
      const payments: MonthlyPayment[] = [
        { referenceMonth: '2026-01', dueDate: '2026-01-05', paidAt: null }, // delayed
        { referenceMonth: '2026-02', dueDate: '2026-02-05', paidAt: '2026-02-03' }, // paid
        { referenceMonth: '2026-03', dueDate: '2026-03-05', paidAt: null }, // delayed
      ]
      const today = new Date('2026-03-20')
      expect(getPortfolioPaymentStatus(payments, today)).toBe('PARCIALMENTE_PAGO')
    })
  })
})
