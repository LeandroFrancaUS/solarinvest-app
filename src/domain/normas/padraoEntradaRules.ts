export type TipoLigacaoNorma = 'MONOFASICO' | 'BIFASICO' | 'TRIFASICO'
export type NormComplianceStatus = 'OK' | 'WARNING' | 'FORA_DA_NORMA' | 'LIMITADO'

export type NormComplianceResult = {
  status: NormComplianceStatus
  uf: string
  tipoLigacao: TipoLigacaoNorma
  potenciaInversorKw: number
  message: string
  kwMaxPermitido?: number
  upgradeTo?: TipoLigacaoNorma
  kwMaxUpgrade?: number
  isProvisional?: boolean
}

type NormRule = {
  kwMax: number
  upgradeTo?: TipoLigacaoNorma
}

const RULES_BY_UF: Record<string, Record<TipoLigacaoNorma, NormRule>> = {
  DF: {
    MONOFASICO: { kwMax: 10, upgradeTo: 'BIFASICO' },
    BIFASICO: { kwMax: 15, upgradeTo: 'TRIFASICO' },
    TRIFASICO: { kwMax: 30 },
  },
  GO: {
    MONOFASICO: { kwMax: 12, upgradeTo: 'BIFASICO' },
    BIFASICO: { kwMax: 25, upgradeTo: 'TRIFASICO' },
    TRIFASICO: { kwMax: 75 },
  },
  TO: {
    MONOFASICO: { kwMax: 12, upgradeTo: 'BIFASICO' },
    BIFASICO: { kwMax: 26.3, upgradeTo: 'TRIFASICO' },
    TRIFASICO: { kwMax: 38 },
  },
}

const PROVISIONAL_UFS = new Set<string>([])

const normalizeUf = (uf?: string | null): string => (uf ?? '').trim().toUpperCase()
const DEBUG_NORMA = Boolean((globalThis as any)?.localStorage?.getItem?.('DEBUG_NORMA'))

const resolveUpgradeRule = (
  uf: string,
  upgradeTo?: TipoLigacaoNorma,
): NormRule | null => {
  if (!upgradeTo) return null
  const rules = RULES_BY_UF[uf]
  return rules?.[upgradeTo] ?? null
}

export const normalizeTipoLigacaoNorma = (tipo?: string | null): TipoLigacaoNorma | null => {
  const normalized = (tipo ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized.startsWith('mono')) return 'MONOFASICO'
  if (normalized.startsWith('bi')) return 'BIFASICO'
  if (normalized.startsWith('tri')) return 'TRIFASICO'
  return null
}

export type EvaluateNormComplianceInput = {
  uf?: string | null
  tipoLigacao?: TipoLigacaoNorma | null
  potenciaInversorKw?: number | null
}

export const evaluateNormCompliance = (
  input: EvaluateNormComplianceInput,
): NormComplianceResult | null => {
  const uf = normalizeUf(input.uf)
  const tipoLigacao = input.tipoLigacao ?? null
  const potencia = Number(input.potenciaInversorKw)

  if (DEBUG_NORMA && typeof window !== 'undefined') {
    console.log('[NORMA DEBUG]', {
      ufRaw: input.uf,
      uf,
      tipoLigacao,
      potenciaInversorKw: input.potenciaInversorKw,
      potenciaParsed: potencia,
      provisional: PROVISIONAL_UFS.has(uf),
      hasRulesForUf: Boolean(RULES_BY_UF[uf]),
      ruleForTipo: tipoLigacao ? RULES_BY_UF[uf]?.[tipoLigacao] : null,
    }) // DEBUG TEMP — remover depois de validar em GO
  }

  if (!uf || !tipoLigacao || !Number.isFinite(potencia) || potencia <= 0) {
    return null
  }

  if (PROVISIONAL_UFS.has(uf)) {
    return {
      status: 'WARNING',
      uf,
      tipoLigacao,
      potenciaInversorKw: potencia,
      message: 'Regra normativa provisória: valide com a distribuidora antes do envio.',
      isProvisional: true,
    }
  }

  const rules = RULES_BY_UF[uf]
  if (!rules) {
    return null
  }

  const rule = rules[tipoLigacao]
  if (!rule) {
    return null
  }

  const upgradeRule = resolveUpgradeRule(uf, rule.upgradeTo)
  const kwMaxUpgrade = upgradeRule?.kwMax

  if (potencia <= rule.kwMax) {
    return {
      status: 'OK',
      uf,
      tipoLigacao,
      potenciaInversorKw: potencia,
      message: `Potência dentro do limite para ${tipoLigacao.toLowerCase()} (${rule.kwMax} kW).`,
      kwMaxPermitido: rule.kwMax,
      upgradeTo: rule.upgradeTo,
      kwMaxUpgrade,
    }
  }

  if (!rule.upgradeTo) {
    return {
      status: 'LIMITADO',
      uf,
      tipoLigacao,
      potenciaInversorKw: potencia,
      message: `Potência excede o limite máximo permitido (${rule.kwMax} kW).`,
      kwMaxPermitido: rule.kwMax,
    }
  }

  if (kwMaxUpgrade && potencia > kwMaxUpgrade) {
    return {
      status: 'LIMITADO',
      uf,
      tipoLigacao,
      potenciaInversorKw: potencia,
      message: `Potência excede o limite máximo mesmo após upgrade (${kwMaxUpgrade} kW).`,
      kwMaxPermitido: rule.kwMax,
      upgradeTo: rule.upgradeTo,
      kwMaxUpgrade,
    }
  }

  return {
    status: 'FORA_DA_NORMA',
    uf,
    tipoLigacao,
    potenciaInversorKw: potencia,
    message: `Potência acima do limite para ${tipoLigacao.toLowerCase()} (${rule.kwMax} kW).`,
    kwMaxPermitido: rule.kwMax,
    upgradeTo: rule.upgradeTo,
    kwMaxUpgrade,
  }
}

export const formatTipoLigacaoLabel = (tipo: TipoLigacaoNorma): string => {
  switch (tipo) {
    case 'MONOFASICO':
      return 'Monofásico'
    case 'BIFASICO':
      return 'Bifásico'
    case 'TRIFASICO':
      return 'Trifásico'
    default:
      return tipo
  }
}
