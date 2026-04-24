// src/domain/billing/mensalidadeEngine.ts
//
// Pure module that calculates the monthly fee (`valorMensalidade`) for a
// client based on the contractual energy parameters.
//
// Two rules are supported:
//
// 1) Standard rule (most clients, including all outside Goiás):
//      M = min(C, Kc) × Tc
//    or, when only the full tariff and the discount are known:
//      M = min(C, Kc) × T × (1 − desconto)
//
// 2) GO with SolarInvest titularidade rule:
//      M = Kc × Tc + max(0; Kr − (Kc + C)) × T + E
//
// Where:
//   C        consumo do cliente (kWh)
//   Kc       energia contratada / créditos contratados (kWh)
//   Kr       créditos reais / geração real (kWh)
//   T        tarifa cheia (R$/kWh)
//   Tc       tarifa com desconto (R$/kWh)
//   desconto fração de desconto (0..1) — usada quando Tc não está disponível
//   E       custos extras fixos (R$)

export type MensalidadeRule = 'PADRAO' | 'GO_SOLARINVEST'

export type MensalidadeStatus = 'OK' | 'DADOS_INSUFICIENTES'

export interface MensalidadeInput {
  /** Consumo mensal do cliente em kWh. */
  C: number | null
  /** Energia contratada (Kc) em kWh. */
  Kc: number | null
  /** Tarifa cheia (R$/kWh). */
  T: number | null
  /**
   * Tarifa com desconto (R$/kWh). Quando ausente é derivada de
   * `T × (1 − desconto)`.
   */
  Tc?: number | null
  /**
   * Desconto como fração entre 0 e 1 (ex.: 0.2 para 20%). Aceita também
   * percentuais (ex.: 20). Usado apenas quando `Tc` não foi informada.
   */
  desconto?: number | null
  /** Créditos reais (Kr) em kWh — usado pela regra GO/SolarInvest. */
  Kr?: number | null
  /** Custos extras fixos (R$) — usado pela regra GO/SolarInvest. */
  E?: number | null
}

export interface MensalidadeOutput {
  status: MensalidadeStatus
  rule: MensalidadeRule
  /** Valor mensal calculado (R$). `null` quando faltam dados. */
  valor: number | null
  /** Lista dos campos faltantes quando status = `DADOS_INSUFICIENTES`. */
  faltantes?: string[]
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isNonNegativeFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Resolve the discounted tariff (`Tc`). When `Tc` is provided, it wins.
 * Otherwise it is derived from `T × (1 − desconto)` where `desconto` is
 * accepted both as a fraction (0..1) and as a percentage (>1, e.g. 20).
 */
function resolveTc(input: MensalidadeInput): number | null {
  if (isPositiveFinite(input.Tc)) return input.Tc
  if (!isPositiveFinite(input.T)) return null

  const raw = input.desconto
  if (raw == null || !Number.isFinite(raw)) return input.T

  const fraction = raw > 1 ? raw / 100 : raw
  if (fraction < 0 || fraction >= 1) return input.T
  return input.T * (1 - fraction)
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/**
 * Standard monthly fee:  M = min(C, Kc) × Tc
 */
export function calculateMensalidadePadrao(input: MensalidadeInput): MensalidadeOutput {
  const faltantes: string[] = []
  if (!isPositiveFinite(input.C)) faltantes.push('C')
  if (!isPositiveFinite(input.Kc)) faltantes.push('Kc')

  const tc = resolveTc(input)
  if (!isPositiveFinite(tc)) faltantes.push('Tc/T')

  if (faltantes.length > 0) {
    return { status: 'DADOS_INSUFICIENTES', rule: 'PADRAO', valor: null, faltantes }
  }

  const valor = Math.min(input.C as number, input.Kc as number) * (tc as number)
  return { status: 'OK', rule: 'PADRAO', valor }
}

/**
 * GO with SolarInvest titularidade monthly fee:
 *   M = Kc × Tc + max(0; Kr − (Kc + C)) × T + E
 */
export function calculateMensalidadeGoSolarInvest(input: MensalidadeInput): MensalidadeOutput {
  const faltantes: string[] = []
  if (!isPositiveFinite(input.Kc)) faltantes.push('Kc')
  if (!isPositiveFinite(input.T)) faltantes.push('T')
  if (!isNonNegativeFinite(input.C)) faltantes.push('C')
  if (!isNonNegativeFinite(input.Kr)) faltantes.push('Kr')

  const tc = resolveTc(input)
  if (!isPositiveFinite(tc)) faltantes.push('Tc/T')

  if (faltantes.length > 0) {
    return { status: 'DADOS_INSUFICIENTES', rule: 'GO_SOLARINVEST', valor: null, faltantes }
  }

  const Kc = input.Kc as number
  const Kr = input.Kr as number
  const C = input.C as number
  const T = input.T as number
  const E = isNonNegativeFinite(input.E) ? input.E : 0

  const piso = Kc * (tc as number)
  const excedente = Math.max(0, Kr - (Kc + C)) * T
  const valor = piso + excedente + E

  return { status: 'OK', rule: 'GO_SOLARINVEST', valor }
}

/**
 * Dispatcher: picks the correct rule based on the
 * `isContratanteTitular` flag.
 *
 * - `isContratanteTitular = true`  → standard rule (cliente é titular).
 * - `isContratanteTitular = false` → GO with SolarInvest titularidade.
 */
export function calculateMensalidade(
  input: MensalidadeInput,
  isContratanteTitular: boolean,
): MensalidadeOutput {
  return isContratanteTitular
    ? calculateMensalidadePadrao(input)
    : calculateMensalidadeGoSolarInvest(input)
}
