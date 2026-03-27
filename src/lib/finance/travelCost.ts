// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExemptRegion {
  cidade: string
  uf: string
}

export interface TravelCostConfig {
  exemptRegions: ExemptRegion[]
  /** Max km for tier 1 (inclusive). Default: 200. */
  faixa1MaxKm: number
  /** Cost for tier 1. Default: R$150. */
  faixa1Rs: number
  /** Max km for tier 2 (inclusive). Default: 320. */
  faixa2MaxKm: number
  /** Cost for tier 2. Default: R$250. */
  faixa2Rs: number
  /** Extra cost per km beyond tier 2 max. Default: R$0.80. */
  kmExcedenteRs: number
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_EXEMPT_REGIONS: ExemptRegion[] = [
  { cidade: 'Anápolis', uf: 'GO' },
  { cidade: 'Abadiânia', uf: 'GO' },
  { cidade: 'Terezópolis de Goiás', uf: 'GO' },
  { cidade: 'Goiânia', uf: 'GO' },
]

export const DEFAULT_TRAVEL_COST_CONFIG: TravelCostConfig = {
  exemptRegions: DEFAULT_EXEMPT_REGIONS,
  faixa1MaxKm: 200,
  faixa1Rs: 150,
  faixa2MaxKm: 320,
  faixa2Rs: 250,
  kmExcedenteRs: 0.8,
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Returns true if the given city/UF is in the exempt region list (no travel cost).
 * Comparison is case-insensitive.
 */
export function isExemptRegion(
  cidade: string,
  uf: string,
  exemptRegions: ExemptRegion[],
): boolean {
  const cidadeNorm = cidade.trim().toLowerCase()
  const ufNorm = uf.trim().toUpperCase()
  return exemptRegions.some(
    (r) =>
      r.cidade.trim().toLowerCase() === cidadeNorm &&
      r.uf.trim().toUpperCase() === ufNorm,
  )
}

/**
 * Calculates installer travel/displacement cost based on round-trip km.
 *
 * Formula:
 *   km <= faixa1MaxKm           → faixa1Rs
 *   faixa1MaxKm < km <= faixa2MaxKm → faixa2Rs
 *   km > faixa2MaxKm            → faixa2Rs + (km - faixa2MaxKm) * kmExcedenteRs
 *
 * Returns 0 if kmRoundTrip <= 0 (caller should use isExemptRegion for exempt check).
 */
export function calculateInstallerTravelCost(
  kmRoundTrip: number,
  config: TravelCostConfig,
): number {
  if (!Number.isFinite(kmRoundTrip) || kmRoundTrip <= 0) return 0
  if (kmRoundTrip <= config.faixa1MaxKm) return config.faixa1Rs
  if (kmRoundTrip <= config.faixa2MaxKm) return config.faixa2Rs
  return config.faixa2Rs + (kmRoundTrip - config.faixa2MaxKm) * config.kmExcedenteRs
}
