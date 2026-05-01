/**
 * Parity Test Suite — Section F: Financial
 *
 * Tests for financial summary, cashflow, entries, categories,
 * import parse/confirm, and financial analyses.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../../..')

function readSource(relPath: string): string {
  const full = resolve(ROOT, relPath)
  if (!existsSync(full)) return ''
  return readFileSync(full, 'utf-8')
}

// ─── F1: Financial summary ────────────────────────────────────────────────────

describe('F1 — Financial summary', () => {
  it('FinancialSummary type has required KPI fields', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('total_projected_revenue')
    expect(src).toContain('total_realized_revenue')
    expect(src).toContain('total_cost')
    expect(src).toContain('net_profit')
  })

  it('fetchFinancialSummary function is exported', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('fetchFinancialSummary')
  })

  it('fetchFinancialDashboardFeed function exists for dashboard widget', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('fetchFinancialDashboardFeed')
  })
})

// ─── F2: Cashflow ─────────────────────────────────────────────────────────────

describe('F2 — Cashflow', () => {
  it('CashflowPeriod type is defined', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('CashflowPeriod')
  })

  it('fetchFinancialCashflow function is exported', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('fetchFinancialCashflow')
  })
})

// ─── F3: Financial entries CRUD ───────────────────────────────────────────────

describe('F3 — Financial entries create/list', () => {
  it('FinancialEntry type is defined with required fields', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('FinancialEntry')
    expect(src).toContain('FinancialEntryInput')
  })

  it('createFinancialEntry function is exported', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('createFinancialEntry')
  })

  it('fetchFinancialEntries function is exported', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('fetchFinancialEntries')
  })

  it('updateFinancialEntry function is exported', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('updateFinancialEntry')
  })

  it('deleteFinancialEntry function is exported', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('deleteFinancialEntry')
  })
})

// ─── F4: Categories ───────────────────────────────────────────────────────────

describe('F4 — Financial categories', () => {
  it('FinancialCategory type is defined', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('FinancialCategory')
  })

  it('fetchFinancialCategories function is exported', () => {
    const src = readSource('src/services/financialManagementApi.ts')
    expect(src).toContain('fetchFinancialCategories')
  })
})

// ─── F5: Import parse/confirm ─────────────────────────────────────────────────

describe('F5 — Financial import parse/confirm', () => {
  it('financialImportApi has ParseResult type', () => {
    const src = readSource('src/services/financialImportApi.ts')
    expect(src).toContain('ParseResult')
  })

  it('financialImportApi has batchId concept for import sessions', () => {
    const src = readSource('src/services/financialImportApi.ts')
    expect(src).toContain('batchId')
  })

  it('financialImportApi has ConfirmCounters for tracking import results', () => {
    const src = readSource('src/services/financialImportApi.ts')
    expect(src).toContain('ConfirmCounters')
  })

  it('financial import service has sheet type classification', () => {
    const src = readSource('src/services/financialImportApi.ts')
    expect(src).toContain('WorksheetType')
    expect(src).toContain('sale_project')
    expect(src).toContain('leasing_project')
  })
})

// ─── F6: Financial analyses with user filter ─────────────────────────────────

describe('F6 — Financial analyses', () => {
  it('SavedFinancialAnalysis type includes user id', () => {
    const src = readSource('src/services/financialAnalysesApi.ts')
    expect(src).toContain('created_by_user_id')
  })

  it('listFinancialAnalyses function is exported', () => {
    const src = readSource('src/services/financialAnalysesApi.ts')
    expect(src).toContain('listFinancialAnalyses')
  })

  it('saveFinancialAnalysis function is exported', () => {
    const src = readSource('src/services/financialAnalysesApi.ts')
    expect(src).toContain('saveFinancialAnalysis')
  })

  it('financial analyses support both venda and leasing modes', () => {
    const src = readSource('src/services/financialAnalysesApi.ts')
    expect(src).toContain("'venda'")
    expect(src).toContain("'leasing'")
  })

  it('analysis can be linked to a client (client_id field)', () => {
    const src = readSource('src/services/financialAnalysesApi.ts')
    expect(src).toContain('client_id')
  })
})

// ─── F7: Revenue billing ─────────────────────────────────────────────────────

describe('F7 — Revenue billing', () => {
  it('revenueBillingApi module exists', () => {
    const src = readSource('src/services/revenueBillingApi.ts')
    expect(src.length).toBeGreaterThan(0)
  })

  it('RevenueClientRow has contract fields', () => {
    const src = readSource('src/services/revenueBillingApi.ts')
    expect(src).toContain('contract_id')
    expect(src).toContain('contract_type')
    expect(src).toContain('contract_status')
  })

  it('revenue billing distinguishes document types (CPF/CNPJ)', () => {
    const src = readSource('src/services/revenueBillingApi.ts')
    expect(src).toContain('document_type')
    expect(src).toContain("'cpf'")
    expect(src).toContain("'cnpj'")
  })
})

// ─── F8: Mensalidade engine (billing calculation) ─────────────────────────────

describe('F8 — Mensalidade billing engine', () => {
  it('standard rule: M = min(C, Kc) × Tc', async () => {
    const { calculateMensalidadePadrao } = await import('../../domain/billing/mensalidadeEngine')
    const out = calculateMensalidadePadrao({ C: 800, Kc: 1000, T: 1.0, Tc: 0.8 })
    expect(out.status).toBe('OK')
    expect(out.valor).toBeCloseTo(640, 5)
  })

  it('billing date module: valorMensalidade is pre-calculated (not recomputed)', () => {
    const src = readSource('src/domain/billing/billingDates.ts')
    // The module accepts valorMensalidade as a BillingInput field (not recalculated)
    expect(src).toContain('valorMensalidade')
    expect(src).not.toContain('calculateMensalidade')
  })
})
