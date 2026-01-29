export type InstallType = 'telhado' | 'solo' | 'outros'
export type SystemType = 'ongrid' | 'hibrido' | 'offgrid'

const normalizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized || null
  }
  return null
}

export function normalizeInstallType(input: unknown): InstallType | null {
  const normalized = normalizeString(input)
  if (!normalized) return null

  if (normalized === 'telhado') return 'telhado'
  if (normalized === 'solo') return 'solo'
  if (normalized === 'outros' || normalized === 'outro') return 'outros'

  return null
}

export function normalizeSystemType(input: unknown): SystemType | null {
  const normalized = normalizeString(input)
  if (!normalized) return null

  if (normalized === 'ongrid' || normalized === 'on_grid' || normalized === 'on-grid') return 'ongrid'
  if (normalized === 'hibrido' || normalized === 'híbrido') return 'hibrido'
  if (normalized === 'offgrid' || normalized === 'off-grid' || normalized === 'off_grid') return 'offgrid'

  return null
}

export function getAutoEligibility(args: {
  installType: InstallType | null
  systemType: SystemType | null
  kwp: number | null
}): { eligible: boolean; reason?: string; reasonCode?: string } {
  const { installType, systemType, kwp } = args

  if (installType === 'solo' || installType === 'outros') {
    return {
      eligible: false,
      reason: 'Orçamento automático disponível apenas para instalação em telhado.',
      reasonCode: 'INSTALL_NOT_ELIGIBLE',
    }
  }

  if (systemType === 'hibrido' || systemType === 'offgrid') {
    return {
      eligible: false,
      reason: 'Orçamento automático disponível apenas para sistemas on-grid.',
      reasonCode: 'SYSTEM_NOT_ELIGIBLE',
    }
  }

  if (kwp !== null && Number.isFinite(kwp) && kwp > 90) {
    return {
      eligible: false,
      reason: 'Para sistemas acima de 90 kWp, o orçamento é realizado de forma personalizada.',
      reasonCode: 'KWP_LIMIT',
    }
  }

  if (!installType || !systemType) {
    return {
      eligible: false,
      reason: 'Selecione o tipo de instalação e o tipo de sistema para continuar.',
      reasonCode: 'MISSING_SELECTION',
    }
  }

  return { eligible: true }
}
