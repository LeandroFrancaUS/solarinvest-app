/**
 * investmentMetrics.ts — Centralized pure financial engine
 *
 * Provides helpers for NPV, IRR, Payback (simple + discounted) and an
 * orchestrator `computeInvestmentMetrics`.
 *
 * Design principles:
 *  - All functions are pure and side-effect free.
 *  - Periodicities must match: callers pass the *periodic* rate that matches
 *    their cash-flow period (monthly rate for monthly flows, annual for annual).
 *  - When a metric cannot be determined (e.g. no sign change for IRR, horizon
 *    too short for payback), `null` is returned — never a fabricated number.
 *
 * Conventions adopted for the Análise Financeira:
 *  - VENDA:  single-period flow — t0: −investimento, t1: +(investimento+lucro)
 *    (i.e. the project cost goes out at t0; the contract proceeds come in at t1)
 *    TIR = lucro/investimento per period (mathematically equivalent to the
 *    simple ROI when the flow has exactly two periods).
 *  - LEASING: monthly flows — t0: −investimento, t1..tn: net monthly installments
 *  - Discount rate is annual; converted to monthly via (1+r)^(1/12)−1 when
 *    cash flows are monthly (periodsPerYear = 12).
 */

// ─── Rate conversion ──────────────────────────────────────────────────────────

/**
 * Converts an annual rate (expressed as a fraction, e.g. 0.12 for 12%) to the
 * equivalent periodic rate for the given number of periods per year.
 *
 * @param annualRate  Annual rate as a fraction (e.g. 0.12)
 * @param periodsPerYear  12 for monthly, 1 for annual
 */
export function toPeriodRate(annualRate: number, periodsPerYear: number): number {
  if (!Number.isFinite(annualRate) || !Number.isFinite(periodsPerYear) || periodsPerYear <= 0) {
    return 0
  }
  if (annualRate <= -1) return 0
  if (periodsPerYear === 1) return annualRate
  return Math.pow(1 + annualRate, 1 / periodsPerYear) - 1
}

/**
 * Converts an annual rate expressed as a percentage (e.g. 12 for 12%) to the
 * equivalent monthly rate as a fraction.
 */
export function toMonthlyRate(annualRatePct: number): number {
  if (!Number.isFinite(annualRatePct)) return 0
  return toPeriodRate(annualRatePct / 100, 12)
}

// ─── NPV ─────────────────────────────────────────────────────────────────────

/**
 * Computes the Net Present Value of a cash-flow series using the given
 * *periodic* discount rate.
 *
 * cashflows[0] is the cash flow at t=0 (typically a negative investment).
 * cashflows[k] is the cash flow at period k.
 *
 * Formula: NPV = Σ cashflows[t] / (1 + periodicRate)^t
 */
export function computeNPV(cashflows: number[], periodicRate: number): number {
  if (cashflows.length === 0) return 0
  if (!Number.isFinite(periodicRate)) return 0
  return cashflows.reduce((acc, cf, t) => {
    const denominator = Math.pow(1 + periodicRate, t)
    return acc + (cf ?? 0) / denominator
  }, 0)
}

// ─── IRR ─────────────────────────────────────────────────────────────────────

/**
 * Computes the Internal Rate of Return (IRR) of a cash-flow series using the
 * Newton-Raphson method with multiple starting guesses for robustness.
 *
 * Returns `null` when:
 *  - the flow has fewer than 2 entries,
 *  - there is no sign change (IRR is mathematically undefined),
 *  - the algorithm does not converge for any starting guess.
 *
 * @param cashflows  Series including the initial outlay at t=0.
 * @param guess      Primary initial guess for the periodic rate (default 0.1 = 10%).
 * @param maxIterations  Max Newton-Raphson iterations per guess (default 1000).
 * @param tolerance  Convergence tolerance (default 1e-7).
 */
export function computeIRR(
  cashflows: number[],
  guess = 0.1,
  maxIterations = 1000,
  tolerance = 1e-7,
): number | null {
  if (cashflows.length < 2) return null

  // Require at least one sign change for IRR to exist
  const hasPositive = cashflows.some((v) => v > 0)
  const hasNegative = cashflows.some((v) => v < 0)
  if (!hasPositive || !hasNegative) return null

  const tryNewtonRaphson = (startRate: number): number | null => {
    let rate = startRate
    for (let i = 0; i < maxIterations; i++) {
      if (rate <= -1) return null
      let npv = 0
      let dnpv = 0
      for (let t = 0; t < cashflows.length; t++) {
        const cf = cashflows[t] ?? 0
        const factor = Math.pow(1 + rate, t)
        if (!Number.isFinite(factor) || factor === 0) return null
        npv += cf / factor
        dnpv -= (t * cf) / (factor * (1 + rate))
      }
      if (dnpv === 0 || !Number.isFinite(dnpv)) return null
      const next = rate - npv / dnpv
      if (!Number.isFinite(next)) return null
      if (Math.abs(next - rate) < tolerance) {
        return Number.isFinite(next) ? next : null
      }
      rate = next
    }
    return null
  }

  // Try multiple starting guesses to improve convergence for low/high IRR scenarios
  const guesses = [guess, 0.01, 0.001, 0.3, -0.05]
  for (const startGuess of guesses) {
    const result = tryNewtonRaphson(startGuess)
    if (result !== null && Number.isFinite(result) && result > -1) {
      // Verify the result is actually a root (NPV ≈ 0)
      const check = computeNPV(cashflows, result)
      const cf0 = cashflows[0] ?? 0
      if (Math.abs(check) < 1 || (cf0 !== 0 && Math.abs(check) / Math.abs(cf0) < 1e-4)) {
        return result
      }
    }
  }
  return null
}

// ─── Payback ─────────────────────────────────────────────────────────────────

/**
 * Computes the simple payback period: the first period index t (1-based) at
 * which the cumulative cash flow (starting from cashflows[0]) reaches or
 * exceeds zero.
 *
 * cashflows[0] must be the initial investment (typically negative).
 *
 * Returns `null` if the investment is never recovered within the series.
 */
export function computePayback(cashflows: number[]): number | null {
  if (cashflows.length === 0) return null
  let accumulated = 0
  for (let t = 0; t < cashflows.length; t++) {
    accumulated += cashflows[t] ?? 0
    if (accumulated >= 0) {
      return t + 1 // 1-based period index
    }
  }
  return null
}

/**
 * Computes the discounted payback period: the first period t (1-based) at
 * which the sum of discounted cash flows (at the given periodic rate) >= 0.
 *
 * cashflows[0] is the investment outlay at t=0.
 *
 * Returns `null` if the investment is never recovered within the series.
 */
export function computeDiscountedPayback(
  cashflows: number[],
  periodicRate: number,
): number | null {
  if (cashflows.length === 0 || !Number.isFinite(periodicRate)) return null
  let accumulated = 0
  for (let t = 0; t < cashflows.length; t++) {
    const pv = (cashflows[t] ?? 0) / Math.pow(1 + periodicRate, t)
    accumulated += pv
    if (accumulated >= 0) {
      return t + 1 // 1-based period index
    }
  }
  return null
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export interface InvestmentMetricsInput {
  /**
   * Complete cash-flow series.
   * cashflows[0] = investment outlay (typically negative).
   * cashflows[1..n] = periodic inflows.
   */
  cashflows: number[]

  /**
   * Annual discount rate as a percentage (e.g. 10 for 10% a.a.).
   * When null or undefined, VPL and payback descontado are not computed.
   */
  discountRateAnnualPct?: number | null

  /**
   * Number of cash-flow periods per year.
   * 12 = monthly flows, 1 = annual flows.
   * Used to convert the annual discount rate to the correct periodic rate.
   */
  periodsPerYear: number
}

export interface InvestmentMetricsOutput {
  /** Net Present Value in the same currency unit as the cash flows, or null when no discount rate was provided. */
  vpl: number | null
  /** Internal Rate of Return as a periodic rate fraction, or null when IRR is mathematically undefined. */
  tirPeriodic: number | null
  /** IRR expressed as an annual rate fraction via (1+tirPeriodic)^periodsPerYear − 1, or null. */
  tirAnual: number | null
  /** Simple payback period (1-based period index), or null if never recovered. */
  payback: number | null
  /** Discounted payback period (1-based period index), or null when no discount rate or never recovered. */
  paybackDescontado: number | null
}

/**
 * Computes all investment metrics (VPL, TIR, Payback, Payback descontado) from a
 * cash-flow series.
 *
 * The periodic discount rate is derived from `discountRateAnnualPct` and
 * `periodsPerYear`.  When `discountRateAnnualPct` is not provided (or is zero),
 * VPL and payback descontado will be `null`.
 */
export function computeInvestmentMetrics(
  input: InvestmentMetricsInput,
): InvestmentMetricsOutput {
  const { cashflows, discountRateAnnualPct, periodsPerYear } = input

  const hasDiscountRate =
    discountRateAnnualPct != null &&
    Number.isFinite(discountRateAnnualPct) &&
    discountRateAnnualPct > 0

  const periodicRate = hasDiscountRate
    ? toPeriodRate((discountRateAnnualPct as number) / 100, periodsPerYear)
    : 0

  const vpl = hasDiscountRate ? computeNPV(cashflows, periodicRate) : null

  const tirPeriodic = computeIRR(cashflows)
  const tirAnual =
    tirPeriodic !== null
      ? Math.pow(1 + tirPeriodic, periodsPerYear) - 1
      : null

  const payback = computePayback(cashflows)

  const paybackDescontado = hasDiscountRate
    ? computeDiscountedPayback(cashflows, periodicRate)
    : null

  return { vpl, tirPeriodic, tirAnual, payback, paybackDescontado }
}
