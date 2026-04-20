// src/utils/hydrateClientComputedFields.ts
// Pure utility that derives missing portfolio fields from a proposal's payload_json.
//
// RULES:
//   • Never overwrites a field that already has a non-null value.
//   • Does not call any API — returns an update object only.
//   • Uses only the engines already embedded in the proposal snapshot:
//       leasingSnapshot  (LeasingState stored inside payload_json)
//       vendaSnapshot    (VendaState stored inside payload_json)
//       vendaForm        (VendaForm stored inside payload_json)
//   • Default module power of 550 Wp is used only when no explicit value exists.

import type { PortfolioClientRow } from '../types/clientPortfolio'

// ─── Minimal typed subset of the fields we read from payload_json ─────────────
// We purposely avoid importing the full OrcamentoSnapshotData from App.tsx to
// prevent a circular dependency.  Only the fields relevant to auto-fill are typed.

interface LeasingDadosTecnicosSnap {
  potenciaInstaladaKwp?: number
  geracaoEstimadakWhMes?: number
  energiaContratadaKwhMes?: number
  potenciaPlacaWp?: number
  numeroModulos?: number
  tipoInstalacao?: string
  areaUtilM2?: number
}

interface LeasingSnap {
  dadosTecnicos?: LeasingDadosTecnicosSnap
  valorDeMercadoEstimado?: number
}

interface VendaConfiguracaoSnap {
  potencia_sistema_kwp?: number
  geracao_estimada_kwh_mes?: number
  potencia_modulo_wp?: number
  n_modulos?: number
  area_m2?: number
  tipo_instalacao?: string
  modelo_modulo?: string
  modelo_inversor?: string
}

interface VendaComposicaoSnap {
  venda_total?: number
}

interface VendaSnap {
  configuracao?: VendaConfiguracaoSnap
  composicao?: VendaComposicaoSnap
  parametros?: { consumo_kwh_mes?: number }
}

interface VendaFormSnap {
  potencia_instalada_kwp?: number
  geracao_estimada_kwh_mes?: number
  consumo_kwh_mes?: number
  capex_total?: number
}

interface PayloadJson {
  leasingSnapshot?: LeasingSnap
  vendaSnapshot?: VendaSnap
  vendaForm?: VendaFormSnap
  potenciaModulo?: number
  tipoInstalacao?: string
  kcKwhMes?: number
}

// ─── Result ──────────────────────────────────────────────────────────────────

/**
 * Fields that can be sent to PUT /api/clients/:id.
 *
 * • Top-level fields (system_kwp, potencia_modulo_wp, etc.) are accepted
 *   directly by the clients handler.
 * • energyProfile.potencia_kwp is persisted to client_energy_profile.
 * • metadata.autoFilled is the loop-guard flag.
 */
export interface ClientAutoFillUpdate {
  system_kwp?: number
  potencia_modulo_wp?: number
  numero_modulos?: number
  area_instalacao_m2?: number
  geracao_estimada_kwh?: number
  tipo_instalacao?: string
  modelo_modulo?: string
  modelo_inversor?: string
  valordemercado?: number
  energyProfile?: { potencia_kwp?: number }
  metadata: Record<string, unknown>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPos(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function toStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Compute which portfolio fields are missing and can be derived from the
 * linked proposal's `payload_json`.
 *
 * Returns `null` when:
 *   - The client already has `metadata.autoFilled = true` (loop guard), OR
 *   - No fields need to be filled (all relevant fields are already set).
 *
 * Otherwise returns a `ClientAutoFillUpdate` object ready to be sent to
 * `PUT /api/clients/:id`.
 */
export function hydrateClientComputedFields(
  client: PortfolioClientRow,
  payloadJson?: Record<string, unknown> | null,
): ClientAutoFillUpdate | null {
  // ── Loop guard ──────────────────────────────────────────────────────────────
  const meta: Record<string, unknown> =
    client.metadata && typeof client.metadata === 'object' ? { ...client.metadata } : {}
  if (meta.autoFilled === true) {
    return null
  }

  // ── Extract source data ─────────────────────────────────────────────────────
  const snap = (payloadJson ?? {}) as PayloadJson
  const leasing = snap.leasingSnapshot?.dadosTecnicos
  const vendaConf = snap.vendaSnapshot?.configuracao
  const vendaComp = snap.vendaSnapshot?.composicao
  const vendaF = snap.vendaForm

  // ── Derive values (priority: leasingSnapshot > vendaSnapshot > vendaForm) ───

  // system_kwp / potencia_kwp
  const potKwp =
    toPos(leasing?.potenciaInstaladaKwp) ??
    toPos(vendaConf?.potencia_sistema_kwp) ??
    toPos(vendaF?.potencia_instalada_kwp)

  // potencia_modulo_wp — only use the 550 Wp default for internal calculation;
  // only persist it when there is an explicit source or a system kWp to derive from
  const potModuloRaw =
    toPos(snap.potenciaModulo) ??
    toPos(leasing?.potenciaPlacaWp) ??
    toPos(vendaConf?.potencia_modulo_wp)
  // Use 550 Wp as a calculation-only fallback when we have a system kWp to work with
  const DEFAULT_MODULE_WP = 550
  const potModulo = potModuloRaw ?? (potKwp != null ? DEFAULT_MODULE_WP : null)

  // numero_modulos
  const nModulosRaw =
    toPos(leasing?.numeroModulos) ??
    toPos(vendaConf?.n_modulos) ??
    (potKwp != null && potModulo != null ? Math.round((potKwp * 1000) / potModulo) : null)

  // area_instalacao_m2 (2.2 m² per module)
  const areaRaw =
    toPos(leasing?.areaUtilM2) ??
    toPos(vendaConf?.area_m2) ??
    (nModulosRaw != null ? Math.round(nModulosRaw * 2.2 * 100) / 100 : null)

  // geracao_estimada_kwh
  const geracaoRaw =
    toPos(leasing?.geracaoEstimadakWhMes) ??
    toPos(vendaConf?.geracao_estimada_kwh_mes) ??
    toPos(vendaF?.geracao_estimada_kwh_mes) ??
    toPos(snap.kcKwhMes) ??
    toPos(snap.vendaSnapshot?.parametros?.consumo_kwh_mes) ??
    toPos(client.consumption_kwh_month)

  // tipo_instalacao
  const tipoInstRaw =
    toStr(leasing?.tipoInstalacao) ??
    toStr(vendaConf?.tipo_instalacao) ??
    toStr(snap.tipoInstalacao)

  // modelo_modulo / modelo_inversor
  const modeloModRaw = toStr(vendaConf?.modelo_modulo)
  const modeloInvRaw = toStr(vendaConf?.modelo_inversor)

  // valordemercado (sistema fotovoltaico)
  const valorSistemaRaw =
    toPos(vendaComp?.venda_total) ??
    toPos(snap.leasingSnapshot?.valorDeMercadoEstimado) ??
    toPos(vendaF?.capex_total)

  // ── Build update — only fill fields that are currently null/undefined ───────
  const update: Partial<ClientAutoFillUpdate> = {}
  let hasFilled = false

  const setIfMissing = <K extends keyof ClientAutoFillUpdate>(
    currentVal: unknown,
    key: K,
    newVal: ClientAutoFillUpdate[K] | null,
    origin: string,
  ) => {
    if (
      (currentVal === null || currentVal === undefined) &&
      newVal !== null &&
      newVal !== undefined
    ) {
      (update as Record<string, unknown>)[key] = newVal
      hasFilled = true
      console.info(`[auto-fill] clientId=${client.id} campo=${key} origem=${origin}`)
    }
  }

  setIfMissing(client.system_kwp, 'system_kwp', potKwp, 'payload_json')

  // potencia_kwp goes to energyProfile (the API handles this sub-object)
  if (client.potencia_kwp == null && potKwp != null) {
    update.energyProfile = { potencia_kwp: potKwp }
    hasFilled = true
    console.info(`[auto-fill] clientId=${client.id} campo=potencia_kwp origem=payload_json`)
  }

  setIfMissing(client.potencia_modulo_wp, 'potencia_modulo_wp', potModuloRaw ?? (potKwp != null ? DEFAULT_MODULE_WP : null), 'payload_json')
  setIfMissing(client.numero_modulos, 'numero_modulos', nModulosRaw, 'payload_json')
  setIfMissing(client.area_instalacao_m2, 'area_instalacao_m2', areaRaw, 'payload_json')
  setIfMissing(client.geracao_estimada_kwh, 'geracao_estimada_kwh', geracaoRaw, 'payload_json')

  if (tipoInstRaw) setIfMissing(client.tipo_instalacao, 'tipo_instalacao', tipoInstRaw, 'payload_json')
  if (modeloModRaw) setIfMissing(client.modelo_modulo, 'modelo_modulo', modeloModRaw, 'payload_json')
  if (modeloInvRaw) setIfMissing(client.modelo_inversor, 'modelo_inversor', modeloInvRaw, 'payload_json')

  setIfMissing(client.valordemercado, 'valordemercado', valorSistemaRaw, 'engine')

  if (!hasFilled) {
    return null
  }

  // Mark as auto-filled to prevent future re-runs
  meta.autoFilled = true
  update.metadata = meta

  return update as ClientAutoFillUpdate
}
