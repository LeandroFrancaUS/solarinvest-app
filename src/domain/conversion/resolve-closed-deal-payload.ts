/**
 * src/domain/conversion/resolve-closed-deal-payload.ts
 *
 * CENTRAL RESOLVER — "Negócio Fechado" data consolidation.
 *
 * Converts all available data sources (client form, snapshot, energy profile)
 * into a single canonical ClosedDealResolvedPayload that downstream modules
 * (Carteira de Cliente, Gestão Financeira) consume without repeating
 * field-resolution logic.
 *
 * Priority chain per field:
 *   1. Top-level canonical field already persisted on the client record
 *   2. Snapshot value (leasingSnapshot > vendaSnapshot > vendaForm)
 *   3. Live form state (liveFormState)
 *   4. Legacy metadata fallback
 *   5. null
 *
 * Rules:
 *   • Pure function — no side-effects, no API calls.
 *   • Never returns a value-downgrade: does not replace a non-null with null.
 *   • Normalises strings (trim) and numbers (positive-finite only).
 */

import {
  resolveClientConsultant,
  type ClientForConsultantResolution,
  type ConsultantForResolution,
} from '../clients/consultant-resolution'
import {
  mapProposalDataToPortfolioFields,
  type SnapshotInput,
  type ClienteDadosInput,
} from '../../lib/domain/proposalPortfolioMapping'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ClosedDealContractType = 'LEASING' | 'VENDA'

/**
 * Canonical consolidated payload produced by the resolver.
 * One single structure feeds all dependent modules.
 */
export interface ClosedDealResolvedPayload {
  /** Numeric server-side client id (as string for uniformity). */
  clientId: string
  /** Proposal record id that originated this conversion, if known. */
  proposalId: string | null
  /** Contract type: LEASING or VENDA. */
  contractType: ClosedDealContractType | null

  // ── Consultant ──────────────────────────────────────────────────────────────
  consultantId: string | null
  consultantLabel: string | null

  // ── Identity ────────────────────────────────────────────────────────────────
  nome: string | null
  nomeRazao: string | null
  cpfCnpj: string | null
  documentType: 'CPF' | 'CNPJ' | null

  // ── Contact ─────────────────────────────────────────────────────────────────
  telefone: string | null
  telefoneSecundario: string | null
  email: string | null

  // ── Address ─────────────────────────────────────────────────────────────────
  cidade: string | null
  uf: string | null
  cep: string | null
  endereco: string | null
  bairro: string | null
  numero: string | null
  complemento: string | null

  // ── Energy infrastructure ────────────────────────────────────────────────────
  distribuidora: string | null
  ucGeradora: string | null
  ucBeneficiaria: string | null

  // ── Technical ───────────────────────────────────────────────────────────────
  tipoRede: string | null
  tipoInstalacao: string | null
  consumoKwhMes: number | null
  geracaoEstimadaKwhMes: number | null
  potenciaModuloWp: number | null
  numeroModulos: number | null
  potenciaInstaladaKwp: number | null
  areaUtilizadaM2: number | null

  // ── Commercial ──────────────────────────────────────────────────────────────
  tarifaCheia: number | null
  prazoMeses: number | null
  valorMercado: number | null
  desconto: number | null
  mensalidadeBase: number | null

  // ── Ownership ───────────────────────────────────────────────────────────────
  ownerUserId: string | null
  createdByUserId: string | null

  // ── Source metadata (for audit / reconciliation) ─────────────────────────────
  _sourceMeta: ClosedDealSourceMeta
}

export interface ClosedDealSourceMeta {
  source: 'closed_deal_conversion'
  hydratedAt: string
  hydratedVersion: '1'
  contractType: ClosedDealContractType | null
  sourceProposalId: string | null
  sourceClientId: string
}

// ─── Input ─────────────────────────────────────────────────────────────────────

/** Minimal client shape read from the App.tsx ClienteRegistro */
export interface ClientRegistroForConversion extends ClientForConsultantResolution {
  id?: string | number | null
  ownerUserId?: string | null
  createdByUserId?: string | null
}

/** Extended clienteDados that includes consultorId */
export interface ClienteDadosForConversion extends ClienteDadosInput {
  consultorId?: string | null
  ownerUserId?: string | null
  createdByUserId?: string | null
}

export interface ResolveClosedDealPayloadInput {
  /** Server-side numeric client ID (required). */
  clientId: number | string
  /** ID of the proposal being converted. */
  proposalId?: string | null
  /** Canonical client data from the form (ClienteDados). */
  clienteDados: ClienteDadosForConversion
  /** Proposal snapshot (leasingSnapshot, vendaSnapshot, etc.). */
  snapshot: SnapshotInput
  /** Full list of consultants for ID → label resolution. */
  consultants?: ConsultantForResolution[]
  /** UC beneficiárias list (numeric codes). */
  ucBeneficiarias?: string[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function toPos(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Derive document type from the raw document string.
 * CPF: 11 digits, CNPJ: 14 digits.
 */
function deriveDocumentType(doc: string | null | undefined): 'CPF' | 'CNPJ' | null {
  if (!doc) return null
  const digits = doc.replace(/\D/g, '')
  if (digits.length === 11) return 'CPF'
  if (digits.length === 14) return 'CNPJ'
  return null
}

// ─── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve all available data sources into a single canonical payload.
 *
 * @example
 * ```ts
 * const payload = resolveClosedDealPayload({
 *   clientId: 42,
 *   proposalId: 'abc-123',
 *   clienteDados: registro.dados,
 *   snapshot: registro.propostaSnapshot ?? {},
 *   consultants,
 * })
 * ```
 */
export function resolveClosedDealPayload(
  input: ResolveClosedDealPayloadInput,
): ClosedDealResolvedPayload {
  const {
    clientId,
    proposalId = null,
    clienteDados,
    snapshot,
    consultants = [],
    ucBeneficiarias = [],
  } = input

  // ── 1. Use existing mapping to resolve proposal snapshot → portfolio tables ──
  const mapped = mapProposalDataToPortfolioFields(snapshot, clienteDados)

  // ── 2. Determine contract type ──────────────────────────────────────────────
  // Priority: mapped contract type (from snapshot/leasing detection) → activeTab fallback.
  // 'sale' in the mapping corresponds to VENDA; everything else defaults to LEASING.
  const isVenda = mapped.contract.contract_type === 'sale' || snapshot.activeTab === 'venda'
  const contractType: ClosedDealContractType = isVenda ? 'VENDA' : 'LEASING'

  // ── 3. Resolve consultant ──────────────────────────────────────────────────
  const rawConsultantId = toStr(clienteDados.consultorId)
  const clientForResolution: ClientForConsultantResolution = rawConsultantId != null
    ? { consultant_id: rawConsultantId }
    : {}
  const { consultantId, consultantNickname } = resolveClientConsultant({
    client: clientForResolution,
    consultants,
  })

  // ── 4. Resolve identity fields ─────────────────────────────────────────────
  const nome = toStr(mapped.clients.client_name) ?? toStr(clienteDados.nome)
  const nomeRazao = toStr(clienteDados.razaoSocial) ?? nome
  const cpfCnpjRaw =
    toStr(mapped.clients.client_document) ??
    toStr(clienteDados.cnpj) ??
    toStr(clienteDados.cpf) ??
    toStr(clienteDados.documento)
  const cpfCnpj = cpfCnpjRaw
  const documentType = deriveDocumentType(cpfCnpj)

  // ── 5. Contact ──────────────────────────────────────────────────────────────
  const telefone = toStr(mapped.clients.client_phone) ?? toStr(clienteDados.telefone)
  const email = toStr(mapped.clients.client_email) ?? toStr(clienteDados.email)

  // ── 6. Address ──────────────────────────────────────────────────────────────
  const cidade = toStr(mapped.clients.client_city) ?? toStr(clienteDados.cidade)
  const uf = toStr(mapped.clients.client_state) ?? toStr(clienteDados.uf)
  const cep = toStr(mapped.clients.client_cep) ?? toStr(clienteDados.cep)?.replace(/\D/g, '') ?? null
  const endereco = toStr(mapped.clients.client_address) ?? toStr(clienteDados.endereco)

  // ── 7. Energy infrastructure ────────────────────────────────────────────────
  const distribuidora = toStr(mapped.clients.distribuidora) ?? toStr(clienteDados.distribuidora)
  const ucGeradora = toStr(mapped.clients.uc) ?? toStr(clienteDados.ucGeradora) ?? toStr(clienteDados.uc)
  const ucBeneficiaria =
    toStr(mapped.clients.uc_beneficiaria) ??
    toStr(clienteDados.ucBeneficiaria) ??
    (ucBeneficiarias.length > 0 ? toStr(ucBeneficiarias[0]) : null)

  // ── 8. Technical ────────────────────────────────────────────────────────────
  const tipoRede =
    toStr(mapped.energyProfile.tipo_rede) ??
    toStr(snapshot.tipoRede)

  const tipoInstalacao =
    toStr(mapped.usinaConfig.tipo_instalacao) ??
    toStr(snapshot.tipoInstalacao)

  const consumoKwhMes =
    toPos(mapped.clients.consumption_kwh_month) ??
    toPos(snapshot.kcKwhMes)

  const geracaoEstimadaKwhMes = toPos(mapped.usinaConfig.geracao_estimada_kwh)

  const potenciaModuloWp = toPos(mapped.usinaConfig.potencia_modulo_wp) ?? toPos(snapshot.potenciaModulo)

  const numeroModulos = toPos(mapped.usinaConfig.numero_modulos) ?? null

  const potenciaInstaladaKwp = toPos(mapped.clients.system_kwp)

  const areaUtilizadaM2 = toPos(mapped.usinaConfig.area_instalacao_m2)

  // ── 9. Commercial ───────────────────────────────────────────────────────────
  const tarifaCheia =
    toPos(mapped.energyProfile.tarifa_atual) ??
    toPos(snapshot.tarifaCheia)

  const prazoMeses =
    toPos(mapped.clients.term_months) ??
    toPos(snapshot.prazoMeses)

  const valorMercado = toPos(mapped.usinaConfig.valordemercado)

  const desconto = toPos(mapped.energyProfile.desconto_percentual)

  const mensalidadeBase = toPos(mapped.energyProfile.mensalidade)

  // ── 10. Ownership ───────────────────────────────────────────────────────────
  const ownerUserId = toStr(clienteDados.ownerUserId)
  const createdByUserId = toStr(clienteDados.createdByUserId)

  // ── Assemble ────────────────────────────────────────────────────────────────
  return {
    clientId: String(clientId),
    proposalId: toStr(proposalId),
    contractType,

    consultantId,
    consultantLabel: consultantNickname,

    nome,
    nomeRazao,
    cpfCnpj,
    documentType,

    telefone,
    // telefoneSecundario is not present in the current ClienteDados model.
    // When the data model is extended to include a secondary phone field,
    // it should be sourced from clienteDados.telefoneSecundario or snapshot.
    telefoneSecundario: null,
    email,

    cidade,
    uf,
    cep,
    endereco,
    // bairro, numero, complemento are not present in the current ClienteDados model.
    // When the address model is extended, these should be sourced from
    // clienteDados or address sub-objects in the snapshot.
    bairro: null,
    numero: null,
    complemento: null,

    distribuidora,
    ucGeradora,
    ucBeneficiaria,

    tipoRede,
    tipoInstalacao,
    consumoKwhMes,
    geracaoEstimadaKwhMes,
    potenciaModuloWp,
    numeroModulos,
    potenciaInstaladaKwp,
    areaUtilizadaM2,

    tarifaCheia,
    prazoMeses,
    valorMercado,
    desconto,
    mensalidadeBase,

    ownerUserId,
    createdByUserId,

    _sourceMeta: {
      source: 'closed_deal_conversion',
      hydratedAt: new Date().toISOString(),
      hydratedVersion: '1',
      contractType,
      sourceProposalId: toStr(proposalId),
      sourceClientId: String(clientId),
    },
  }
}
