// src/utils/financialProjectCalcs.ts
// Pure calculation helpers for the Gestão Financeira per-project view.
// No side effects — safe to import from both React components and tests.

export interface FinancialItemForCalc {
  nature: 'expense' | 'income'
  item_name?: string | null
  category?: string | null
  expected_amount?: number | null
  expected_quantity?: number | null
  expected_total?: number | null
}

/**
 * Returns the effective expected total for a single item.
 * Priority: expected_total > (amount × quantity) > amount > 0
 */
export function computeItemExpectedTotal(item: FinancialItemForCalc): number {
  if (item.expected_total != null) return item.expected_total
  if (item.expected_amount != null && item.expected_quantity != null) {
    return item.expected_amount * item.expected_quantity
  }
  return item.expected_amount ?? 0
}

export interface ProjectTotals {
  expectedCost: number
  expectedRevenue: number
  saldoPrevisto: number
  margem: number | null
  roi: number | null
  /**
   * Payback in months.
   * - leasing: investmentCost / monthlyFee (from first mensalidade item).
   * - venda/buyout: null — payment structures vary too much to estimate reliably
   *   from item data alone; the UI shows "Dados insuficientes" instead.
   */
  payback: number | null
}

/**
 * Aggregates item-level totals into project-level indicators.
 * @param items     The financial items for the project.
 * @param proposalType  'leasing' | 'venda' | 'buyout' (or any string)
 */
export function computeProjectTotals(
  items: FinancialItemForCalc[],
  proposalType?: string | null,
): ProjectTotals {
  let expectedCost = 0
  let expectedRevenue = 0
  let monthlyFee: number | null = null

  for (const item of items) {
    const total = computeItemExpectedTotal(item)
    if (item.nature === 'expense') {
      expectedCost += total
    } else {
      expectedRevenue += total
      // For leasing payback: find the first mensalidade income item
      if (
        proposalType === 'leasing' &&
        monthlyFee == null &&
        (item.item_name?.toLowerCase().includes('mensalidade') ||
          item.category?.toLowerCase().includes('mensalidade'))
      ) {
        monthlyFee = item.expected_amount ?? null
      }
    }
  }

  const saldoPrevisto = expectedRevenue - expectedCost
  const margem = expectedRevenue > 0 ? (saldoPrevisto / expectedRevenue) * 100 : null
  const roi = expectedCost > 0 ? (saldoPrevisto / expectedCost) * 100 : null

  let payback: number | null = null
  if (proposalType === 'leasing' && monthlyFee != null && monthlyFee > 0) {
    payback = expectedCost / monthlyFee
  }
  // For venda/buyout we do not attempt a payback estimate from item data alone

  return { expectedCost, expectedRevenue, saldoPrevisto, margem, roi, payback }
}
