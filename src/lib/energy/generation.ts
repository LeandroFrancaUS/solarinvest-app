import { IRRADIACAO_FALLBACK } from '../../utils/irradiacao'

export function kwpFromWpQty(wp?: number | null, qty?: number | null): number | null {
  if (!Number.isFinite(wp) || !Number.isFinite(qty)) {
    return null
  }
  const placaWp = Number(wp)
  const quantidade = Number(qty)
  if (placaWp <= 0 || quantidade <= 0) {
    return null
  }
  const potencia = (placaWp * quantidade) / 1000
  return Number.isFinite(potencia) && potencia > 0 ? potencia : null
}

export function estimateMonthlyKWh(
  potencia_kWp: number,
  params: { hsp: number; pr: number },
): number {
  if (!Number.isFinite(potencia_kWp) || potencia_kWp <= 0) {
    return 0
  }
  const hsp = Number.isFinite(params.hsp) ? Math.max(0, params.hsp) : 0
  const pr = Number.isFinite(params.pr) ? Math.max(0, params.pr) : 0
  if (hsp <= 0 || pr <= 0) {
    return 0
  }
  const estimativa = potencia_kWp * hsp * DEFAULT_DIAS_MES * pr
  if (!Number.isFinite(estimativa) || estimativa <= 0) {
    return 0
  }
  return Math.round(estimativa)
}

export interface GenerationInputs {
  potencia_instalada_kwp: number
  irradiacao_kwh_m2_dia?: number
  performance_ratio?: number
  dias_mes?: number
}

export const DEFAULT_PERFORMANCE_RATIO = 0.8
export const DEFAULT_DIAS_MES = 30

export function normalizePerformanceRatio(value?: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  const resolved = value ?? 0
  if (resolved <= 0) {
    return 0
  }
  if (resolved >= 1.5) {
    return resolved / 100
  }
  return resolved
}

export function estimateMonthlyGenerationKWh({
  potencia_instalada_kwp,
  irradiacao_kwh_m2_dia = IRRADIACAO_FALLBACK,
  performance_ratio = DEFAULT_PERFORMANCE_RATIO,
  dias_mes = DEFAULT_DIAS_MES,
}: GenerationInputs): number {
  if (!Number.isFinite(potencia_instalada_kwp) || potencia_instalada_kwp <= 0) {
    return 0
  }

  const irradiacao = Number.isFinite(irradiacao_kwh_m2_dia) ? Math.max(0, irradiacao_kwh_m2_dia) : 0
  if (irradiacao <= 0) {
    return 0
  }

  const ratio = normalizePerformanceRatio(performance_ratio)
  if (ratio <= 0) {
    return 0
  }

  const dias = Number.isFinite(dias_mes) ? Math.max(0, dias_mes) : 0
  if (dias <= 0) {
    return 0
  }

  const fatorGeracao = irradiacao * ratio * dias
  if (!Number.isFinite(fatorGeracao) || fatorGeracao <= 0) {
    return 0
  }

  const geracao = potencia_instalada_kwp * fatorGeracao
  if (!Number.isFinite(geracao) || geracao <= 0) {
    return 0
  }

  return Math.round(geracao)
}
