/**
 * Address field normalization.
 */

const UF_MAP: Record<string, string> = {
  AC: 'AC', AL: 'AL', AP: 'AP', AM: 'AM', BA: 'BA',
  CE: 'CE', DF: 'DF', ES: 'ES', GO: 'GO', MA: 'MA',
  MT: 'MT', MS: 'MS', MG: 'MG', PA: 'PA', PB: 'PB',
  PR: 'PR', PE: 'PE', PI: 'PI', RJ: 'RJ', RN: 'RN',
  RS: 'RS', RO: 'RO', RR: 'RR', SC: 'SC', SP: 'SP',
  SE: 'SE', TO: 'TO',
}

export function normalizeUf(raw: string | null | undefined): string | null {
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  return UF_MAP[upper] ?? null
}

export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.trim().replace(/\s+/g, ' ') || null
}
