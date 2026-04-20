// src/utils/__tests__/financialProjectCalcs.test.ts
// Unit tests for the pure calculation helpers in FinancialManagementPage:
//   computeItemExpectedTotal, computeProjectTotals
//
// We replicate the helpers here (same logic) so the tests don't need to
// import from a React component file.

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Replicated helpers (must stay in sync with the ones in FinancialManagementPage.tsx)
// ─────────────────────────────────────────────────────────────────────────────

interface Item {
  id: string
  nature: 'expense' | 'income'
  item_name?: string | null
  category?: string | null
  expected_amount?: number | null
  expected_quantity?: number | null
  expected_total?: number | null
  value_mode?: string
}

function computeItemExpectedTotal(item: Item): number {
  if (item.expected_total != null) return item.expected_total
  if (item.expected_amount != null && item.expected_quantity != null) {
    return item.expected_amount * item.expected_quantity
  }
  return item.expected_amount ?? 0
}

interface ProjectTotals {
  expectedCost: number
  expectedRevenue: number
  saldoPrevisto: number
  margem: number | null
  roi: number | null
  payback: number | null
}

function computeProjectTotals(items: Item[], proposalType?: string): ProjectTotals {
  let expectedCost = 0
  let expectedRevenue = 0
  let monthlyRevenue: number | null = null

  for (const item of items) {
    const total = computeItemExpectedTotal(item)
    if (item.nature === 'expense') {
      expectedCost += total
    } else {
      expectedRevenue += total
      if (
        proposalType === 'leasing' &&
        monthlyRevenue == null &&
        (item.item_name?.toLowerCase().includes('mensalidade') ||
          item.category?.toLowerCase().includes('mensalidade'))
      ) {
        monthlyRevenue = item.expected_amount ?? null
      }
    }
  }

  const saldoPrevisto = expectedRevenue - expectedCost
  const margem = expectedRevenue > 0 ? (saldoPrevisto / expectedRevenue) * 100 : null
  const roi = expectedCost > 0 ? (saldoPrevisto / expectedCost) * 100 : null
  const payback =
    proposalType === 'leasing' && monthlyRevenue != null && monthlyRevenue > 0
      ? expectedCost / monthlyRevenue
      : expectedCost > 0 && expectedRevenue > 0
        ? expectedCost / (expectedRevenue / Math.max(items.length, 1))
        : null

  return { expectedCost, expectedRevenue, saldoPrevisto, margem, roi, payback }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'test-id',
    nature: 'expense',
    item_name: 'Item',
    category: 'cat',
    expected_amount: null,
    expected_quantity: null,
    expected_total: null,
    ...overrides,
  }
}

describe('computeItemExpectedTotal', () => {
  it('returns expected_total when set (even if amount and qty are also set)', () => {
    const item = makeItem({ expected_total: 1000, expected_amount: 200, expected_quantity: 3 })
    expect(computeItemExpectedTotal(item)).toBe(1000)
  })

  it('returns amount × quantity when both set and total is null', () => {
    const item = makeItem({ expected_amount: 150, expected_quantity: 4 })
    expect(computeItemExpectedTotal(item)).toBe(600)
  })

  it('returns expected_amount when quantity is null and total is null', () => {
    const item = makeItem({ expected_amount: 500 })
    expect(computeItemExpectedTotal(item)).toBe(500)
  })

  it('returns 0 when all values are null', () => {
    const item = makeItem({})
    expect(computeItemExpectedTotal(item)).toBe(0)
  })

  it('handles zero quantity correctly', () => {
    const item = makeItem({ expected_amount: 100, expected_quantity: 0 })
    expect(computeItemExpectedTotal(item)).toBe(0)
  })
})

describe('computeProjectTotals', () => {
  it('sums costs and revenues from items', () => {
    const items: Item[] = [
      makeItem({ nature: 'expense', expected_total: 10000 }),
      makeItem({ nature: 'expense', expected_amount: 500, expected_quantity: 2 }),
      makeItem({ nature: 'income', expected_total: 15000 }),
    ]
    const totals = computeProjectTotals(items)
    expect(totals.expectedCost).toBe(11000)
    expect(totals.expectedRevenue).toBe(15000)
    expect(totals.saldoPrevisto).toBe(4000)
  })

  it('computes margem correctly when revenue > 0', () => {
    const items: Item[] = [
      makeItem({ nature: 'expense', expected_total: 8000 }),
      makeItem({ nature: 'income', expected_total: 10000 }),
    ]
    const { margem } = computeProjectTotals(items)
    // margem = (10000 - 8000) / 10000 * 100 = 20%
    expect(margem).toBeCloseTo(20, 5)
  })

  it('margem is null when revenue is 0', () => {
    const items: Item[] = [makeItem({ nature: 'expense', expected_total: 5000 })]
    const { margem } = computeProjectTotals(items)
    expect(margem).toBeNull()
  })

  it('computes roi correctly', () => {
    const items: Item[] = [
      makeItem({ nature: 'expense', expected_total: 10000 }),
      makeItem({ nature: 'income', expected_total: 13000 }),
    ]
    const { roi } = computeProjectTotals(items)
    // roi = (13000 - 10000) / 10000 * 100 = 30%
    expect(roi).toBeCloseTo(30, 5)
  })

  it('roi is null when cost is 0', () => {
    const items: Item[] = [makeItem({ nature: 'income', expected_total: 5000 })]
    const { roi } = computeProjectTotals(items)
    expect(roi).toBeNull()
  })

  it('computes leasing payback from mensalidade item', () => {
    const items: Item[] = [
      makeItem({ nature: 'expense', expected_total: 24000 }), // CAPEX
      makeItem({ nature: 'income', item_name: 'Mensalidade', expected_amount: 1000, expected_total: 12000 }),
    ]
    const { payback } = computeProjectTotals(items, 'leasing')
    // payback = 24000 / 1000 = 24 months
    expect(payback).toBeCloseTo(24, 5)
  })

  it('saldo previsto is negative when costs exceed revenues', () => {
    const items: Item[] = [
      makeItem({ nature: 'expense', expected_total: 20000 }),
      makeItem({ nature: 'income', expected_total: 15000 }),
    ]
    const { saldoPrevisto } = computeProjectTotals(items)
    expect(saldoPrevisto).toBe(-5000)
  })

  it('returns all zeros for empty items array', () => {
    const totals = computeProjectTotals([])
    expect(totals.expectedCost).toBe(0)
    expect(totals.expectedRevenue).toBe(0)
    expect(totals.saldoPrevisto).toBe(0)
    expect(totals.margem).toBeNull()
    expect(totals.roi).toBeNull()
    expect(totals.payback).toBeNull()
  })
})
