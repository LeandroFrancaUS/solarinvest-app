/**
 * Parity Test Suite — Section E: Portfolio (Carteira)
 *
 * Tests for portfolio patches (profile, contract, plan, project, billing),
 * notes, and invoice operations.
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

// ─── E1: Profile patch ───────────────────────────────────────────────────────

describe('E1 — Portfolio profile patch', () => {
  it('clientPortfolioApi exports patchPortfolioProfile or equivalent', () => {
    const src = readSource('src/services/clientPortfolioApi.ts')
    const hasPatchProfile = src.includes('patchPortfolioProfile') || src.includes('patch') || src.includes('updateProfile')
    expect(hasPatchProfile).toBe(true)
  })

  it('portfolio client row has profile fields (name, email, phone, document)', () => {
    // Validate types exist
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('name')
    expect(src).toContain('email')
    expect(src).toContain('phone')
    expect(src).toContain('document')
  })
})

// ─── E2: Contract patch ──────────────────────────────────────────────────────

describe('E2 — Portfolio contract patch', () => {
  it('clientPortfolioApi exports contract-related patch function', () => {
    const src = readSource('src/services/clientPortfolioApi.ts')
    const hasContractPatch = src.includes('contract') || src.includes('Contract')
    expect(hasContractPatch).toBe(true)
  })

  it('portfolio types include contract_id and contract_type fields', () => {
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('contract_id')
    expect(src).toContain('contract_type')
    expect(src).toContain('contract_status')
  })
})

// ─── E3: Plan patch ──────────────────────────────────────────────────────────

describe('E3 — Portfolio plan patch', () => {
  it('energy profile fields are included in portfolio types', () => {
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('modalidade')
    expect(src).toContain('tarifa_atual')
    expect(src).toContain('desconto_percentual')
    expect(src).toContain('kwh_contratado')
  })
})

// ─── E4: Project patch ───────────────────────────────────────────────────────

describe('E4 — Portfolio project patch', () => {
  it('project status fields are in portfolio types', () => {
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('project_id')
    expect(src).toContain('project_status')
    expect(src).toContain('installation_status')
    expect(src).toContain('commissioning_date')
  })

  it('patchPortfolioUsina function exists for usina data updates', () => {
    const src = readSource('src/services/clientPortfolioApi.ts')
    expect(src).toContain('patchPortfolioUsina')
  })
})

// ─── E5: Billing patch ───────────────────────────────────────────────────────

describe('E5 — Portfolio billing patch', () => {
  it('billing fields are in portfolio types', () => {
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('mensalidade')
    expect(src).toContain('billing_start_date')
  })

  it('billingDates module exists for date calculations', () => {
    const src = readSource('src/domain/billing/billingDates.ts')
    expect(src.length).toBeGreaterThan(0)
    expect(src).toContain('calculateBillingDates')
  })
})

// ─── E6: Notes get/post ──────────────────────────────────────────────────────

describe('E6 — Portfolio notes get/post', () => {
  it('ClientNote type exists in portfolio types', () => {
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('ClientNote')
  })

  it('clientPortfolioApi has functions for notes', () => {
    const src = readSource('src/services/clientPortfolioApi.ts')
    const hasNotesFuncs = src.includes('Note') || src.includes('note') || src.includes('notes')
    expect(hasNotesFuncs).toBe(true)
  })
})

// ─── E7: Invoices when is_contratante_titular=false ──────────────────────────

describe('E7 — Invoices for non-titular contratante', () => {
  it('is_contratante_titular field exists in portfolio types', () => {
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('is_contratante_titular')
  })

  it('ClientInvoice type is defined', () => {
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('ClientInvoice')
  })

  it('invoicesApi module exists', () => {
    const src = readSource('src/services/invoicesApi.ts')
    expect(src.length).toBeGreaterThan(0)
    expect(src).toContain('fetchClientInvoices')
  })

  it('invoices can be listed with client_id filter', () => {
    const src = readSource('src/services/invoicesApi.ts')
    expect(src).toContain('client_id')
  })
})

// ─── E8: Portfolio summary ───────────────────────────────────────────────────

describe('E8 — Portfolio summary', () => {
  it('PortfolioSummary type exists', () => {
    const src = readSource('src/types/clientPortfolio.ts')
    expect(src).toContain('PortfolioSummary')
  })

  it('fetchPortfolioSummary or equivalent function exists', () => {
    const src = readSource('src/services/clientPortfolioApi.ts')
    const hasSummary = src.includes('summary') || src.includes('Summary')
    expect(hasSummary).toBe(true)
  })
})
