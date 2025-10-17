export type DensityMode = 'compact' | 'cozy' | 'comfortable'

export const DENSITY_STORAGE_KEY = 'solarinvest:density-mode'
export const DEFAULT_DENSITY: DensityMode = 'compact'

export const isDensityMode = (value: unknown): value is DensityMode =>
  value === 'compact' || value === 'cozy' || value === 'comfortable'
