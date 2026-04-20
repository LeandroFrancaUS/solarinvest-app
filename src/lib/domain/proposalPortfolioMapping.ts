/**
 * src/lib/domain/proposalPortfolioMapping.ts
 *
 * PROPOSAL → PORTFOLIO MAPPING
 *
 * Single-responsibility module that converts an OrcamentoSnapshotData
 * (proposal form state) + ClienteDados (client registration data) into
 * a normalized `ProposalPortfolioPayload` ready to be persisted to the
 * canonical tables:
 *
 *   clients                — registration + energy basics
 *   client_usina_config    — technical / usina fields
 *   client_contracts       — contract type + term
 *   client_energy_profile  — energy profile details
 *   client_billing_profile — billing defaults
 *
 * Rules:
 *   • Pure function — no side effects, no API calls.
 *   • Priority chain for each field: leasingSnapshot > vendaSnapshot > vendaForm > top-level
 *   • Never overwrites with null when a value is already present.
 *   • Returns null per group when no data can be derived for that group.
 */

// ─── Minimal typed subsets (no circular deps) ────────────────────────────────

interface LeasingDadosTecnicos {
  potenciaInstaladaKwp?: number
  geracaoEstimadakWhMes?: number
  energiaContratadaKwhMes?: number
  potenciaPlacaWp?: number
  numeroModulos?: number
  tipoInstalacao?: string
  areaUtilM2?: number
}

interface LeasingProjecaoMensalidade {
  mensalidade?: number
}

interface LeasingSnapshotMinimal {
  prazoContratualMeses?: number
  energiaContratadaKwhMes?: number
  descontoContratual?: number
  tarifaInicial?: number
  valorDeMercadoEstimado?: number
  dadosTecnicos?: LeasingDadosTecnicos
  projecao?: {
    mensalidadesAno?: LeasingProjecaoMensalidade[]
  }
  contrato?: {
    inversoresFV?: string
  }
}

interface VendaConfiguracao {
  potencia_sistema_kwp?: number
  geracao_estimada_kwh_mes?: number
  potencia_modulo_wp?: number
  n_modulos?: number
  area_m2?: number
  tipo_instalacao?: string
  modelo_modulo?: string
  modelo_inversor?: string
}

interface VendaComposicao {
  venda_total?: number
  desconto_percentual?: number
}

interface VendaParametros {
  consumo_kwh_mes?: number
  tarifa_r_kwh?: number
}

interface VendaSnapshotMinimal {
  configuracao?: VendaConfiguracao
  composicao?: VendaComposicao
  parametros?: VendaParametros
  potenciaCalculadaKwp?: number
  financiamento?: { prazoMeses?: number }
}

interface VendaFormMinimal {
  potencia_sistema_kwp?: number
  geracao_estimada_kwh_mes?: number
  consumo_kwh_mes?: number
  capex_total?: number
}

/** Minimal snapshot interface (no import of the large App.tsx types) */
export interface SnapshotInput {
  activeTab?: string
  leasingSnapshot?: LeasingSnapshotMinimal
  vendaSnapshot?: VendaSnapshotMinimal
  vendaForm?: VendaFormMinimal
  kcKwhMes?: number
  prazoMeses?: number
  tarifaCheia?: number
  potenciaModulo?: number
  tipoInstalacao?: string
  tipoRede?: string
}

/** Subset of ClienteDados needed for mapping */
export interface ClienteDadosInput {
  nome?: string
  documento?: string
  email?: string
  telefone?: string
  cep?: string
  cidade?: string
  uf?: string
  endereco?: string
  distribuidora?: string
  uc?: string
  indicacaoNome?: string
  temIndicacao?: boolean
  diaVencimento?: string
}

// ─── Output types ─────────────────────────────────────────────────────────────

/** Normalized fields destined for the `clients` table */
export interface ClientsPayload {
  client_name?: string
  client_document?: string
  client_email?: string
  client_phone?: string
  client_cep?: string
  client_city?: string
  client_state?: string
  client_address?: string
  distribuidora?: string
  uc?: string
  consumption_kwh_month?: number
  system_kwp?: number
  term_months?: number
}

/** Normalized fields destined for `client_usina_config` */
export interface UsinaConfigPayload {
  potencia_modulo_wp?: number
  numero_modulos?: number
  tipo_instalacao?: string
  area_instalacao_m2?: number
  geracao_estimada_kwh?: number
  modelo_modulo?: string
  modelo_inversor?: string
  valordemercado?: number
}

/** Normalized fields destined for `client_contracts` */
export interface ContractPayload {
  contract_type?: 'leasing' | 'sale'
  contractual_term_months?: number
  buyout_amount_reference?: number
}

/** Normalized fields destined for `client_energy_profile` */
export interface EnergyProfilePayload {
  kwh_contratado?: number
  potencia_kwp?: number
  tipo_rede?: string
  tarifa_atual?: number
  desconto_percentual?: number
  mensalidade?: number
  indicacao?: string
  prazo_meses?: number
}

/** Normalized fields destined for `client_billing_profile` */
export interface BillingProfilePayload {
  due_day?: number
}

/**
 * Complete normalized payload produced from a proposal snapshot.
 * Each group corresponds to a canonical table.
 * A group is null when no mappable data exists for it.
 */
export interface ProposalPortfolioPayload {
  /** Fields for the `clients` table */
  clients: ClientsPayload
  /** Fields for `client_usina_config` */
  usinaConfig: UsinaConfigPayload
  /** Fields for `client_contracts` */
  contract: ContractPayload
  /** Fields for `client_energy_profile` */
  energyProfile: EnergyProfilePayload
  /** Fields for `client_billing_profile` */
  billingProfile: BillingProfilePayload
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPos(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function toStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return undefined
}

function first<T>(...candidates: Array<T | undefined | null>): T | undefined {
  for (const c of candidates) {
    if (c !== undefined && c !== null) return c
  }
  return undefined
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Convert a proposal snapshot + client registration data into the normalized
 * `ProposalPortfolioPayload` that maps directly to canonical DB tables.
 *
 * This is the single authoritative mapping function used by the
 * `closeProposalAndHydrateClientPortfolio` pipeline.
 */
export function mapProposalDataToPortfolioFields(
  snapshot: SnapshotInput,
  cliente: ClienteDadosInput,
): ProposalPortfolioPayload {
  const leasing = snapshot.leasingSnapshot
  const ldt = leasing?.dadosTecnicos
  const venda = snapshot.vendaSnapshot
  const vConf = venda?.configuracao
  const vComp = venda?.composicao
  const vParam = venda?.parametros
  const vForm = snapshot.vendaForm

  // ── Derive contract type from activeTab ──────────────────────────────────
  const contractType: 'leasing' | 'sale' =
    snapshot.activeTab === 'venda' ? 'sale' : 'leasing'

  // ── system_kwp ────────────────────────────────────────────────────────────
  const systemKwp = first(
    toPos(ldt?.potenciaInstaladaKwp),
    toPos(vConf?.potencia_sistema_kwp),
    toPos(vForm?.potencia_sistema_kwp),
    toPos(venda?.potenciaCalculadaKwp),
  )

  // ── consumption_kwh_month ─────────────────────────────────────────────────
  const consumptionKwh = first(
    toPos(snapshot.kcKwhMes),
    toPos(vParam?.consumo_kwh_mes),
    toPos(vForm?.consumo_kwh_mes),
    toPos(leasing?.energiaContratadaKwhMes),
    toPos(ldt?.energiaContratadaKwhMes),
  )

  // ── term_months ───────────────────────────────────────────────────────────
  const termMonths = first(
    toPos(snapshot.prazoMeses),
    toPos(leasing?.prazoContratualMeses),
    toPos(venda?.financiamento?.prazoMeses),
  )

  // ── potencia_modulo_wp ────────────────────────────────────────────────────
  const potenciaModulo = first(
    toPos(ldt?.potenciaPlacaWp),
    toPos(vConf?.potencia_modulo_wp),
    toPos(snapshot.potenciaModulo),
  )

  // ── numero_modulos ────────────────────────────────────────────────────────
  const numeroModulos = first(
    toPos(ldt?.numeroModulos),
    toPos(vConf?.n_modulos),
  )

  // ── area_instalacao_m2 ────────────────────────────────────────────────────
  const areaM2 = first(
    toPos(ldt?.areaUtilM2),
    toPos(vConf?.area_m2),
  )

  // ── geracao_estimada_kwh ──────────────────────────────────────────────────
  const geracaoKwh = first(
    toPos(ldt?.geracaoEstimadakWhMes),
    toPos(vConf?.geracao_estimada_kwh_mes),
    toPos(vForm?.geracao_estimada_kwh_mes),
  )

  // ── tipo_instalacao ───────────────────────────────────────────────────────
  const tipoInstalacao = first(
    toStr(ldt?.tipoInstalacao),
    toStr(vConf?.tipo_instalacao),
    toStr(snapshot.tipoInstalacao),
  )

  // ── modelo_modulo / modelo_inversor ───────────────────────────────────────
  const modeloModulo = toStr(vConf?.modelo_modulo)
  const modeloInversor = first(
    toStr(vConf?.modelo_inversor),
    toStr(leasing?.contrato?.inversoresFV),
  )

  // ── valordemercado ────────────────────────────────────────────────────────
  const valorMercado = first(
    toPos(vComp?.venda_total),
    toPos(leasing?.valorDeMercadoEstimado),
    toPos(vForm?.capex_total),
  )

  // ── energy profile fields ─────────────────────────────────────────────────
  const kwhContratado = first(
    toPos(ldt?.energiaContratadaKwhMes),
    toPos(leasing?.energiaContratadaKwhMes),
  )

  const tarifaAtual = first(
    toPos(snapshot.tarifaCheia),
    toPos(vParam?.tarifa_r_kwh),
    toPos(leasing?.tarifaInicial),
  )

  const descontoPercentual = first(
    toPos(vComp?.desconto_percentual),
    toPos(leasing?.descontoContratual),
  )

  const mensalidadeFirst = leasing?.projecao?.mensalidadesAno?.[0]?.mensalidade
  const mensalidade = toPos(mensalidadeFirst)

  const indicacao = toStr(cliente.indicacaoNome)
    ?? (cliente.temIndicacao ? '' : undefined)

  const prazoMeses = first(
    toPos(snapshot.prazoMeses),
    toPos(leasing?.prazoContratualMeses),
  )

  // ── due_day ───────────────────────────────────────────────────────────────
  const dueDayRaw = Number(cliente.diaVencimento ?? '')
  const dueDay = Number.isFinite(dueDayRaw) && dueDayRaw > 0 ? dueDayRaw : undefined

  // ─────────────────────────────────────────────────────────────────────────
  // Assemble payload groups
  // ─────────────────────────────────────────────────────────────────────────

  const clientsPayload: ClientsPayload = {}
  if (toStr(cliente.nome)) clientsPayload.client_name = cliente.nome!.trim()
  if (toStr(cliente.documento)) clientsPayload.client_document = cliente.documento!.trim()
  if (toStr(cliente.email)) clientsPayload.client_email = cliente.email!.trim()
  if (toStr(cliente.telefone)) clientsPayload.client_phone = cliente.telefone!.trim()
  if (toStr(cliente.cep)) clientsPayload.client_cep = cliente.cep!.replace(/\D/g, '')
  if (toStr(cliente.cidade)) clientsPayload.client_city = cliente.cidade!.trim()
  if (toStr(cliente.uf)) clientsPayload.client_state = cliente.uf!.trim()
  if (toStr(cliente.endereco)) clientsPayload.client_address = cliente.endereco!.trim()
  if (toStr(cliente.distribuidora)) clientsPayload.distribuidora = cliente.distribuidora!.trim()
  if (toStr(cliente.uc)) clientsPayload.uc = cliente.uc!.trim()
  if (consumptionKwh !== undefined) clientsPayload.consumption_kwh_month = consumptionKwh
  if (systemKwp !== undefined) clientsPayload.system_kwp = systemKwp
  if (termMonths !== undefined) clientsPayload.term_months = termMonths

  const usinaPayload: UsinaConfigPayload = {}
  if (potenciaModulo !== undefined) usinaPayload.potencia_modulo_wp = potenciaModulo
  if (numeroModulos !== undefined) usinaPayload.numero_modulos = numeroModulos
  if (tipoInstalacao !== undefined) usinaPayload.tipo_instalacao = tipoInstalacao
  if (areaM2 !== undefined) usinaPayload.area_instalacao_m2 = areaM2
  if (geracaoKwh !== undefined) usinaPayload.geracao_estimada_kwh = geracaoKwh
  if (modeloModulo !== undefined) usinaPayload.modelo_modulo = modeloModulo
  if (modeloInversor !== undefined) usinaPayload.modelo_inversor = modeloInversor
  if (valorMercado !== undefined) usinaPayload.valordemercado = valorMercado

  const contractPayload: ContractPayload = { contract_type: contractType }
  if (termMonths !== undefined) contractPayload.contractual_term_months = termMonths
  if (valorMercado !== undefined) contractPayload.buyout_amount_reference = valorMercado

  const energyProfilePayload: EnergyProfilePayload = {}
  if (kwhContratado !== undefined) energyProfilePayload.kwh_contratado = kwhContratado
  if (systemKwp !== undefined) energyProfilePayload.potencia_kwp = systemKwp
  if (toStr(snapshot.tipoRede)) energyProfilePayload.tipo_rede = snapshot.tipoRede!.trim()
  if (tarifaAtual !== undefined) energyProfilePayload.tarifa_atual = tarifaAtual
  if (descontoPercentual !== undefined) energyProfilePayload.desconto_percentual = descontoPercentual
  if (mensalidade !== undefined) energyProfilePayload.mensalidade = mensalidade
  if (indicacao !== undefined) energyProfilePayload.indicacao = indicacao
  if (prazoMeses !== undefined) energyProfilePayload.prazo_meses = prazoMeses

  const billingPayload: BillingProfilePayload = {}
  if (dueDay !== undefined) billingPayload.due_day = dueDay

  return {
    clients: clientsPayload,
    usinaConfig: usinaPayload,
    contract: contractPayload,
    energyProfile: energyProfilePayload,
    billingProfile: billingPayload,
  }
}
