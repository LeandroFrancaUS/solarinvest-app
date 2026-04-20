import { describe, it, expect } from 'vitest'
import {
  toPeriodRate,
  toMonthlyRate,
  computeNPV,
  computeIRR,
  computePayback,
  computeDiscountedPayback,
  computeInvestmentMetrics,
} from '../investmentMetrics'

// ─── toPeriodRate ─────────────────────────────────────────────────────────────

describe('toPeriodRate', () => {
  it('converts annual 12% to monthly correctly', () => {
    const monthly = toPeriodRate(0.12, 12)
    // (1.12)^(1/12) - 1
    expect(monthly).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 8)
  })

  it('annual rate with 1 period/year is unchanged', () => {
    expect(toPeriodRate(0.1, 1)).toBeCloseTo(0.1, 10)
  })

  it('returns 0 for invalid inputs', () => {
    expect(toPeriodRate(NaN, 12)).toBe(0)
    expect(toPeriodRate(0.1, 0)).toBe(0)
    expect(toPeriodRate(0.1, -1)).toBe(0)
  })

  it('returns 0 when annual rate <= -1', () => {
    expect(toPeriodRate(-1, 12)).toBe(0)
    expect(toPeriodRate(-2, 12)).toBe(0)
  })
})

// ─── toMonthlyRate ────────────────────────────────────────────────────────────

describe('toMonthlyRate', () => {
  it('converts 12% a.a. to correct monthly rate', () => {
    const expected = Math.pow(1.12, 1 / 12) - 1
    expect(toMonthlyRate(12)).toBeCloseTo(expected, 8)
  })

  it('converts 6% a.a. correctly', () => {
    expect(toMonthlyRate(6)).toBeCloseTo(Math.pow(1.06, 1 / 12) - 1, 8)
  })

  it('returns 0 for 0%', () => {
    expect(toMonthlyRate(0)).toBeCloseTo(0, 10)
  })

  it('returns 0 for non-finite input', () => {
    expect(toMonthlyRate(NaN)).toBe(0)
    expect(toMonthlyRate(Infinity)).toBe(0)
  })
})

// ─── computeNPV ──────────────────────────────────────────────────────────────

describe('computeNPV', () => {
  it('returns 0 for empty cash flows', () => {
    expect(computeNPV([], 0.01)).toBe(0)
  })

  it('computes NPV of a simple two-period flow', () => {
    // [-1000, 1100] at 10% per period: -1000 + 1100/1.1 = 0
    expect(computeNPV([-1000, 1100], 0.1)).toBeCloseTo(0, 6)
  })

  it('computes NPV with multiple periods', () => {
    // [-100, 30, 40, 50] at 5%/period
    const expected =
      -100 + 30 / 1.05 + 40 / Math.pow(1.05, 2) + 50 / Math.pow(1.05, 3)
    expect(computeNPV([-100, 30, 40, 50], 0.05)).toBeCloseTo(expected, 6)
  })

  it('at rate=0, NPV equals sum of cash flows', () => {
    const cfs = [-500, 100, 200, 300]
    const sum = cfs.reduce((a, b) => a + b, 0)
    expect(computeNPV(cfs, 0)).toBeCloseTo(sum, 6)
  })

  it('returns 0 for non-finite rate', () => {
    expect(computeNPV([-100, 150], NaN)).toBe(0)
  })

  it('VPL is negative when discounted returns do not cover investment', () => {
    // High discount rate makes future flows worth less
    const vpl = computeNPV([-1000, 500, 500], 0.5)
    expect(vpl).toBeLessThan(0)
  })
})

// ─── computeIRR ──────────────────────────────────────────────────────────────

describe('computeIRR', () => {
  it('returns null for a series with fewer than 2 entries', () => {
    expect(computeIRR([])).toBeNull()
    expect(computeIRR([-100])).toBeNull()
  })

  it('returns null when all cash flows are negative (no sign change)', () => {
    expect(computeIRR([-100, -50, -200])).toBeNull()
  })

  it('returns null when all cash flows are positive (no sign change)', () => {
    expect(computeIRR([100, 200, 300])).toBeNull()
  })

  it('computes IRR for a simple two-period project', () => {
    // [-1000, 1200]: IRR = 0.2 (20%)
    const irr = computeIRR([-1000, 1200])
    expect(irr).not.toBeNull()
    expect(irr!).toBeCloseTo(0.2, 4)
  })

  it('computes IRR for a multi-period project', () => {
    // [-100, 30, 40, 50] — known IRR ≈ 6.88%
    const irr = computeIRR([-100, 30, 40, 50])
    expect(irr).not.toBeNull()
    // Verify via NPV at that rate ≈ 0
    expect(computeNPV([-100, 30, 40, 50], irr!)).toBeCloseTo(0, 3)
  })

  it('NPV at computed IRR is approximately 0', () => {
    const cfs = [-10000, 2000, 3000, 4000, 3500]
    const irr = computeIRR(cfs)
    expect(irr).not.toBeNull()
    expect(computeNPV(cfs, irr!)).toBeCloseTo(0, 2)
  })

  it('returns a negative IRR for a below-breakeven project', () => {
    // Invest 1000, receive only 900 → negative return
    const irr = computeIRR([-1000, 900])
    expect(irr).not.toBeNull()
    expect(irr!).toBeLessThan(0)
  })

  it('handles leasing-style long monthly flow', () => {
    const capex = 30000
    const monthly = 600 // 60 months
    const cfs = [-capex, ...Array<number>(60).fill(monthly)]
    const irr = computeIRR(cfs)
    expect(irr).not.toBeNull()
    // Verify NPV ≈ 0 at the computed IRR
    expect(computeNPV(cfs, irr!)).toBeCloseTo(0, 1)
  })
})

// ─── computePayback ──────────────────────────────────────────────────────────

describe('computePayback', () => {
  it('returns null for empty cash flows', () => {
    expect(computePayback([])).toBeNull()
  })

  it('returns null when investment never recovered', () => {
    expect(computePayback([-1000, 100, 200, 300])).toBeNull()
  })

  it('returns the correct period when investment is recovered', () => {
    // [-1000, 500, 600]: after t=0: −1000, t=1: −500, t=2: +100 → payback at period 3
    expect(computePayback([-1000, 500, 600])).toBe(3)
  })

  it('returns period 1 when initial flow is already non-negative', () => {
    expect(computePayback([0, 100])).toBe(1)
    expect(computePayback([500, -100])).toBe(1)
  })

  it('returns period 2 for a simple two-entry flow with recovery at t1', () => {
    // [-100, 110]: t0=−100, t1=10 → cumulative becomes 10 at index 1 → period 2
    expect(computePayback([-100, 110])).toBe(2)
  })

  it('payback is null for all-negative flow', () => {
    expect(computePayback([-100, -50, -30])).toBeNull()
  })

  it('returns correct payback for longer series', () => {
    const cfs = [-1000, ...Array<number>(12).fill(100)] // payback at month 11
    expect(computePayback(cfs)).toBe(11)
  })
})

// ─── computeDiscountedPayback ─────────────────────────────────────────────────

describe('computeDiscountedPayback', () => {
  it('returns null for empty cash flows', () => {
    expect(computeDiscountedPayback([], 0.01)).toBeNull()
  })

  it('returns null for non-finite rate', () => {
    expect(computeDiscountedPayback([-100, 150], NaN)).toBeNull()
  })

  it('is always >= simple payback (discounting delays recovery)', () => {
    const cfs = [-1000, 400, 400, 400, 400]
    const simple = computePayback(cfs)
    const discounted = computeDiscountedPayback(cfs, 0.05)
    if (simple !== null && discounted !== null) {
      expect(discounted).toBeGreaterThanOrEqual(simple)
    }
  })

  it('returns period when PV of flows covers investment', () => {
    // [-1000, 1100] at 5%: PV(t0) = -1000, PV(t1) = 1100/1.05 ≈ 1047 → cumsum > 0 at t=1 → period 2
    const pb = computeDiscountedPayback([-1000, 1100], 0.05)
    expect(pb).toBe(2)
  })

  it('returns null when discount makes flows never cover investment', () => {
    // Very high discount rate kills future cash flows
    const pb = computeDiscountedPayback([-1000, 500, 500], 10)
    expect(pb).toBeNull()
  })

  it('at rate 0 equals simple payback', () => {
    const cfs = [-1000, 300, 400, 400]
    expect(computeDiscountedPayback(cfs, 0)).toBe(computePayback(cfs))
  })
})

// ─── computeInvestmentMetrics ─────────────────────────────────────────────────

describe('computeInvestmentMetrics', () => {
  it('computes all metrics for a monthly leasing flow', () => {
    const capex = 30000
    const monthly = 650
    const months = 60
    const cfs = [-capex, ...Array<number>(months).fill(monthly)]

    const result = computeInvestmentMetrics({
      cashflows: cfs,
      discountRateAnnualPct: 12,
      periodsPerYear: 12,
    })

    expect(result.tirPeriodic).not.toBeNull()
    expect(result.tirAnual).not.toBeNull()
    expect(result.payback).not.toBeNull()
    expect(result.vpl).not.toBeNull()
    // paybackDescontado may be null when the NPV itself is negative (discount rate too high)
    // At 12% a.a. the discounted flows may not fully recover capex within 60 months
  })

  it('VPL is null when no discount rate provided', () => {
    const result = computeInvestmentMetrics({
      cashflows: [-1000, 400, 400, 400],
      periodsPerYear: 12,
    })
    expect(result.vpl).toBeNull()
    expect(result.paybackDescontado).toBeNull()
  })

  it('VPL is null when discount rate is 0', () => {
    const result = computeInvestmentMetrics({
      cashflows: [-1000, 400, 400, 400],
      discountRateAnnualPct: 0,
      periodsPerYear: 12,
    })
    expect(result.vpl).toBeNull()
    expect(result.paybackDescontado).toBeNull()
  })

  it('tirAnual = (1 + tirPeriodic)^periodsPerYear - 1', () => {
    const cfs = [-10000, 2500, 2500, 2500, 2500, 3000]
    const result = computeInvestmentMetrics({ cashflows: cfs, periodsPerYear: 12 })
    if (result.tirPeriodic !== null && result.tirAnual !== null) {
      expect(result.tirAnual).toBeCloseTo(
        Math.pow(1 + result.tirPeriodic, 12) - 1,
        8,
      )
    }
  })

  it('venda single-period: TIR = lucro/investimento per period', () => {
    const inv = 25000
    const lucro = 5000
    const cfs = [-inv, inv + lucro]
    const result = computeInvestmentMetrics({ cashflows: cfs, periodsPerYear: 12 })
    // For a 2-entry flow: TIR = (25000+5000)/25000 - 1 = 0.2 per period
    expect(result.tirPeriodic).not.toBeNull()
    expect(result.tirPeriodic!).toBeCloseTo(lucro / inv, 4)
  })

  it('annual flows use annual rate directly (periodsPerYear=1)', () => {
    const inv = 10000
    const annual = 3000
    const cfs = [-inv, annual, annual, annual, annual]
    const result = computeInvestmentMetrics({
      cashflows: cfs,
      discountRateAnnualPct: 10,
      periodsPerYear: 1,
    })
    // Periodic rate should be 10%/year directly (not monthly)
    const expectedNPV = computeNPV(cfs, 0.1)
    expect(result.vpl).toBeCloseTo(expectedNPV, 4)
  })

  it('TIR is null for all-positive cash flows', () => {
    const result = computeInvestmentMetrics({
      cashflows: [100, 200, 300],
      periodsPerYear: 12,
    })
    expect(result.tirPeriodic).toBeNull()
    expect(result.tirAnual).toBeNull()
  })

  it('TIR is null for all-negative cash flows', () => {
    const result = computeInvestmentMetrics({
      cashflows: [-100, -200, -300],
      periodsPerYear: 12,
    })
    expect(result.tirPeriodic).toBeNull()
    expect(result.tirAnual).toBeNull()
  })

  it('payback is null when investment is never recovered', () => {
    const result = computeInvestmentMetrics({
      cashflows: [-10000, 100, 100, 100],
      periodsPerYear: 12,
    })
    expect(result.payback).toBeNull()
  })

  it('handles zero investment gracefully (no sign change)', () => {
    const result = computeInvestmentMetrics({
      cashflows: [0, 100, 200],
      periodsPerYear: 12,
    })
    // No sign change (no negative value) → TIR null
    expect(result.tirPeriodic).toBeNull()
  })

  it('handles fractional cash flow values', () => {
    const cfs = [-1234.56, 456.78, 789.12, 123.45]
    const result = computeInvestmentMetrics({
      cashflows: cfs,
      discountRateAnnualPct: 8,
      periodsPerYear: 12,
    })
    expect(result.vpl).not.toBeNull()
    expect(Number.isFinite(result.vpl!)).toBe(true)
  })

  it('short horizon — 2 periods', () => {
    const result = computeInvestmentMetrics({
      cashflows: [-1000, 1200],
      discountRateAnnualPct: 10,
      periodsPerYear: 12,
    })
    expect(result.tirPeriodic).not.toBeNull()
    expect(result.payback).toBe(2)
  })

  it('long horizon — 360 months', () => {
    // capex=24000, monthly=100: 24000/100=240 months to recover → within 360 months
    const monthly = 100
    const cfs = [-24000, ...Array<number>(360).fill(monthly)]
    const result = computeInvestmentMetrics({
      cashflows: cfs,
      discountRateAnnualPct: 8,
      periodsPerYear: 12,
    })
    expect(result.tirPeriodic).not.toBeNull()
    expect(result.payback).not.toBeNull()
    expect(result.vpl).not.toBeNull()
    expect(Number.isFinite(result.vpl!)).toBe(true)
  })

  // ─── Leasing with growing installments ───────────────────────────────────

  it('leasing with annually-adjusted monthly installments', () => {
    const inv = 40000
    const baseMonthly = 800
    const inflacao = 0.07
    const years = 10
    const months = years * 12
    const cfs: number[] = [-inv]
    for (let m = 0; m < months; m++) {
      const yearIndex = Math.floor(m / 12)
      cfs.push(baseMonthly * Math.pow(1 + inflacao, yearIndex))
    }
    const result = computeInvestmentMetrics({
      cashflows: cfs,
      discountRateAnnualPct: 10,
      periodsPerYear: 12,
    })
    expect(result.tirPeriodic).not.toBeNull()
    expect(result.payback).not.toBeNull()
    expect(result.vpl).not.toBeNull()
  })
})
