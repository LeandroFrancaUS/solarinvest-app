// src/domain/billing/__tests__/clientPaymentStatus.test.ts
import { describe, it, expect } from 'vitest'
import { getClientPaymentStatus } from '../clientPaymentStatus'
import type { PortfolioClientRow, InstallmentPayment } from '../../../types/clientPortfolio'

// Helper to create a minimal client with required fields
function createMockClient(overrides: Partial<PortfolioClientRow> = {}): PortfolioClientRow {
  return {
    id: 1,
    name: 'Test Client',
    email: null,
    phone: null,
    city: null,
    state: null,
    document: null,
    document_type: null,
    consumption_kwh_month: null,
    system_kwp: null,
    term_months: null,
    distribuidora: null,
    uc: null,
    uc_beneficiaria: null,
    owner_user_id: null,
    created_by_user_id: null,
    client_created_at: new Date().toISOString(),
    is_converted_customer: true,
    exported_to_portfolio_at: new Date().toISOString(),
    exported_by_user_id: null,
    contract_type: 'leasing',
    contract_status: 'active',
    contractual_term_months: 12,
    due_day: 5,
    first_billing_date: '2026-01-05',
    installments_json: [],
    ...overrides,
  } as PortfolioClientRow
}

// Helper to create installments
function createInstallment(number: number, status: 'pendente' | 'pago' | 'confirmado' = 'pendente'): InstallmentPayment {
  return {
    number,
    status,
    paid_at: status === 'pago' || status === 'confirmado' ? new Date().toISOString() : null,
    receipt_number: status === 'pago' || status === 'confirmado' ? `REC-${number}` : null,
    transaction_number: null,
    attachment_url: null,
    confirmed_by: null,
  }
}

describe('getClientPaymentStatus', () => {
  describe('Inativo status', () => {
    it('should return inativo when contract type is not leasing', () => {
      const client = createMockClient({ contract_type: 'sale' })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('inativo')
      expect(result.label).toBe('Inativo')
    })

    it('should return inativo when contract status is not active', () => {
      const client = createMockClient({ contract_status: 'draft' })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('inativo')
      expect(result.label).toBe('Inativo')
    })

    it('should return inativo when term months is not set', () => {
      const client = createMockClient({ contractual_term_months: null, term_months: null, prazo_meses: null })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('inativo')
      expect(result.label).toBe('Inativo')
    })

    it('should return inativo when no installments exist', () => {
      const client = createMockClient({ installments_json: [] })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('inativo')
      expect(result.label).toBe('Inativo')
    })
  })

  describe('Pago status', () => {
    it('should return pago when all installments are paid', () => {
      const client = createMockClient({
        installments_json: [
          createInstallment(1, 'pago'),
          createInstallment(2, 'confirmado'),
        ],
      })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('pago')
      expect(result.label).toBe('Pago')
      expect(result.unpaidCount).toBe(0)
      expect(result.overdueCount).toBe(0)
    })
  })

  describe('Pendente status', () => {
    it('should return pendente when has unpaid installments but none overdue', () => {
      const client = createMockClient({
        installments_json: [
          createInstallment(1, 'pago'),
          createInstallment(2, 'pendente'),
        ],
        first_billing_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 60 days in future
      })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('pendente')
      expect(result.label).toBe('Pendente')
      expect(result.unpaidCount).toBe(1)
      expect(result.overdueCount).toBe(0)
    })
  })

  describe('Vencido status', () => {
    it('should return vencido when has overdue installments (< 30 days)', () => {
      const client = createMockClient({
        installments_json: [
          createInstallment(1, 'pendente'),
        ],
        first_billing_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 10 days ago
      })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('vencido')
      expect(result.label).toBe('Vencido')
      expect(result.unpaidCount).toBe(1)
      expect(result.overdueCount).toBeGreaterThan(0)
    })
  })

  describe('Em Atraso status', () => {
    it('should return em_atraso when has severely overdue installments (> 30 days)', () => {
      const client = createMockClient({
        installments_json: [
          createInstallment(1, 'pendente'),
        ],
        first_billing_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 40 days ago
      })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('em_atraso')
      expect(result.label).toBe('Em Atraso')
      expect(result.unpaidCount).toBe(1)
      expect(result.overdueCount).toBeGreaterThan(0)
    })
  })

  describe('Edge cases', () => {
    it('should handle mixed payment statuses correctly', () => {
      const client = createMockClient({
        installments_json: [
          createInstallment(1, 'confirmado'),
          createInstallment(2, 'pago'),
          createInstallment(3, 'pendente'),
        ],
        first_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 30 days in future
      })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('pendente')
      expect(result.unpaidCount).toBe(1)
    })

    it('should prioritize em_atraso over vencido', () => {
      const client = createMockClient({
        installments_json: [
          createInstallment(1, 'pendente'), // Will be 40 days overdue
          createInstallment(2, 'pendente'), // Will be 10 days overdue
        ],
        first_billing_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      })
      const result = getClientPaymentStatus(client)
      expect(result.status).toBe('em_atraso')
    })
  })
})
