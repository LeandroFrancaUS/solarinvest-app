/**
 * Pure proposal-state helper functions and constants.
 * Extracted from App.tsx to reduce its size.
 *
 * Rules:
 * - No React imports here (pure functions / constants only)
 * - No side effects on module load
 * - No business-logic duplication
 */

import type { OrcamentoSnapshotData } from '../../types/orcamentoTypes'
import type {
  PrintableProposalProps,
  PrintableProposalTipo,
} from '../../types/printableProposal'
import { normalizeTipoBasico } from '../../types/tipoBasico'
import type { TipoClienteTUSD } from '../../lib/finance/tusd'
import { normalizeNumbers } from '../../utils/formatters'
import { persistWithFallback } from '../clientes/clienteHelpers'
import type { ProposalRow, UpdateProposalInput } from '../../lib/api/proposalsApi'

// ---------------------------------------------------------------------------
// OrcamentoSalvo type
// ---------------------------------------------------------------------------

export type OrcamentoSalvo = {
  id: string
  criadoEm: string
  clienteId?: string
  clienteNome: string
  clienteCidade: string
  clienteUf: string
  clienteDocumento?: string
  clienteUc?: string
  dados: PrintableProposalProps
  snapshot?: OrcamentoSnapshotData
  /** Display name of the consultant who owns this proposal (server-loaded, privileged views only) */
  ownerName?: string
  /** Stack user id of the owner (server-loaded, privileged views only) */
  ownerUserId?: string
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

export const BUDGETS_STORAGE_KEY = 'solarinvest-orcamentos'
export const PROPOSAL_SERVER_ID_MAP_STORAGE_KEY = 'solarinvest-proposal-server-id-map'

// ---------------------------------------------------------------------------
// ID generation constants
// ---------------------------------------------------------------------------

export const BUDGET_ID_PREFIXES: Record<PrintableProposalTipo, string> = {
  VENDA_DIRETA: 'SLRINVST-VND-',
  LEASING: 'SLRINVST-LSE-',
}
export const DEFAULT_BUDGET_ID_PREFIX = BUDGET_ID_PREFIXES.LEASING
export const BUDGET_ID_SUFFIX_LENGTH = 8
export const BUDGET_ID_MAX_ATTEMPTS = 1000

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// ---------------------------------------------------------------------------
// ID generators
// ---------------------------------------------------------------------------

export const generateBudgetId = (
  existingIds: Set<string> = new Set(),
  tipoProposta: PrintableProposalTipo = 'LEASING',
): string => {
  let attempts = 0

  while (attempts < BUDGET_ID_MAX_ATTEMPTS) {
    attempts += 1
    const randomNumber = Math.floor(Math.random() * 10 ** BUDGET_ID_SUFFIX_LENGTH)
    const suffix = randomNumber.toString().padStart(BUDGET_ID_SUFFIX_LENGTH, '0')
    const prefix = BUDGET_ID_PREFIXES[tipoProposta] ?? DEFAULT_BUDGET_ID_PREFIX
    const candidate = `${prefix}${suffix}`

    if (!existingIds.has(candidate)) {
      return candidate
    }
  }

  throw new Error('Não foi possível gerar um código de orçamento único.')
}

export const createDraftBudgetId = () =>
  `DRAFT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

// ---------------------------------------------------------------------------
// Server → local mapping
// ---------------------------------------------------------------------------

/**
 * Maps a server-side ProposalRow (from /api/proposals) to the local OrcamentoSalvo format.
 *
 * The server stores the complete OrcamentoSnapshotData (raw form state) as payload_json.
 * We use it as both:
 *   - `snapshot`: used by carregarOrcamentoParaEdicao to reload the form for editing
 *   - `dados`   : used by the listing page to read client metadata (nome, cidade, uc, etc.)
 *                 and by carregarOrcamentoSalvo to determine proposal type
 *
 * The double cast (as unknown as …) is intentional: payload_json is typed as
 * Record<string,unknown> at the API boundary but is guaranteed to be an
 * OrcamentoSnapshotData object written by the auto-save path.
 */
export function serverProposalToOrcamento(row: ProposalRow): OrcamentoSalvo {
  // payload_json is always an OrcamentoSnapshotData written by the auto-save path.
  const snapshot = row.payload_json as unknown as OrcamentoSnapshotData
  const tipoProposta: PrintableProposalTipo =
    row.proposal_type === 'venda' ? 'VENDA_DIRETA' : 'LEASING'
  // Merge tipoProposta into the snapshot so that carregarOrcamentoSalvo can
  // determine the tab type without needing the full PrintableProposalProps.
  const dados = {
    ...(snapshot ?? {}),
    tipoProposta,
  } as unknown as PrintableProposalProps
  const ownerName = row.owner_display_name ?? row.owner_email ?? row.owner_user_id
  const ownerUserId = row.owner_user_id
  // Prefer proposal_code (e.g. "SLRINVST-LSE-12345678") as the local id so
  // it follows the established naming convention.  Fall back to the server
  // UUID only when no code was stored.
  const proposalId = row.proposal_code ?? row.id
  return {
    id: proposalId,
    criadoEm: row.created_at,
    clienteNome: row.client_name ?? snapshot?.cliente?.nome ?? '',
    clienteCidade: row.client_city ?? snapshot?.cliente?.cidade ?? '',
    clienteUf: row.client_state ?? snapshot?.cliente?.uf ?? '',
    ...(row.client_document ?? snapshot?.cliente?.documento
      ? { clienteDocumento: row.client_document ?? snapshot?.cliente?.documento ?? '' }
      : {}),
    ...(snapshot?.cliente?.uc ? { clienteUc: snapshot.cliente.uc } : {}),
    ...(ownerName != null ? { ownerName } : {}),
    ...(ownerUserId != null ? { ownerUserId } : {}),
    dados,
    ...(snapshot != null ? { snapshot } : {}),
  }
}

// ---------------------------------------------------------------------------
// TUSD normalization
// ---------------------------------------------------------------------------

export const normalizeTusdTipoClienteValue = (value: unknown): TipoClienteTUSD => {
  const normalized = normalizeTipoBasico(typeof value === 'string' ? value : null)
  return normalized || 'residencial'
}

// ---------------------------------------------------------------------------
// Snapshot field resolvers
// ---------------------------------------------------------------------------

export const toFiniteNonNegativeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed)) return null
  return parsed >= 0 ? parsed : null
}

export const resolveConsumptionFromSnapshot = (
  snapshot: OrcamentoSnapshotData | null,
): number | null => {
  if (!snapshot) return null
  const legacyPageShared = (snapshot.pageShared as { kcKwhMes?: unknown } | undefined)?.kcKwhMes
  const parametrosConsumo = (
    snapshot as unknown as { parametros?: { consumo_kwh_mes?: unknown } }
  ).parametros?.consumo_kwh_mes
  const vendaParametrosConsumo = (
    snapshot.vendaSnapshot as { parametros?: { consumo_kwh_mes?: unknown } } | undefined
  )?.parametros?.consumo_kwh_mes
  const candidates = [
    snapshot.kcKwhMes,
    legacyPageShared,
    parametrosConsumo,
    snapshot.leasingSnapshot?.energiaContratadaKwhMes,
    snapshot.vendaForm?.consumo_kwh_mes,
    vendaParametrosConsumo,
  ]
  for (const candidate of candidates) {
    const parsed = toFiniteNonNegativeNumber(candidate)
    if (parsed !== null) return parsed
  }
  return null
}

export const resolveSystemKwpFromSnapshot = (
  snapshot: OrcamentoSnapshotData | null,
): number | null => {
  if (!snapshot) return null
  return (
    toFiniteNonNegativeNumber(
      snapshot.leasingSnapshot?.dadosTecnicos?.potenciaInstaladaKwp,
    ) ??
    toFiniteNonNegativeNumber(snapshot.vendaForm?.potencia_instalada_kwp) ??
    toFiniteNonNegativeNumber(
      (snapshot.vendaSnapshot as { potenciaCalculadaKwp?: unknown } | undefined)
        ?.potenciaCalculadaKwp,
    ) ??
    null
  )
}

export const resolveTermMonthsFromSnapshot = (
  snapshot: OrcamentoSnapshotData | null,
): number | null => {
  if (!snapshot) return null
  return (
    toFiniteNonNegativeNumber(snapshot.leasingSnapshot?.prazoContratualMeses) ??
    toFiniteNonNegativeNumber(snapshot.prazoMeses) ??
    toFiniteNonNegativeNumber(
      (
        snapshot.vendaSnapshot as
          | { financiamento?: { prazoMeses?: unknown } }
          | undefined
      )?.financiamento?.prazoMeses,
    ) ??
    null
  )
}

// ---------------------------------------------------------------------------
// Local storage persistence helpers
// ---------------------------------------------------------------------------

export const persistBudgetsToLocalStorage = (
  registros: OrcamentoSalvo[],
): { persisted: OrcamentoSalvo[]; droppedCount: number } =>
  persistWithFallback(BUDGETS_STORAGE_KEY, registros, {
    serialize: (items) => JSON.stringify(items),
    reduce: (items) => items.slice(0, -1),
  })

export const alertPrunedBudgets = (droppedCount: number) => {
  if (typeof window === 'undefined' || droppedCount === 0) {
    return
  }

  const mensagem =
    droppedCount === 1
      ? 'O armazenamento local estava cheio. O orçamento mais antigo foi removido para salvar a versão atual.'
      : `O armazenamento local estava cheio. ${droppedCount} orçamentos antigos foram removidos para salvar a versão atual.`

  window.alert(mensagem)
}

// ---------------------------------------------------------------------------
// Proposal upsert payload builder (pure function — no useCallback)
// ---------------------------------------------------------------------------

export function buildProposalUpsertPayload(
  snapshot: OrcamentoSnapshotData,
): UpdateProposalInput {
  const clienteSnapshot = snapshot.cliente ?? {}
  const resolvedConsumption = resolveConsumptionFromSnapshot(snapshot)
  const resolvedSystemKwp = resolveSystemKwpFromSnapshot(snapshot)
  const resolvedTermMonths = resolveTermMonthsFromSnapshot(snapshot)
  const clientCepDigits = normalizeNumbers(clienteSnapshot.cep ?? '').slice(0, 8)
  const ucBeneficiaria = snapshot.ucBeneficiarias
    ?.map((item) => item.numero?.trim())
    .filter((item): item is string => Boolean(item))
    .join(', ')

  return {
    payload_json: snapshot as unknown as Record<string, unknown>,
    ...(clienteSnapshot.nome?.trim() ? { client_name: clienteSnapshot.nome.trim() } : {}),
    ...(clienteSnapshot.documento?.trim()
      ? { client_document: normalizeNumbers(clienteSnapshot.documento) }
      : {}),
    ...(clienteSnapshot.cidade?.trim() ? { client_city: clienteSnapshot.cidade.trim() } : {}),
    ...(clienteSnapshot.uf?.trim() ? { client_state: clienteSnapshot.uf.trim() } : {}),
    ...(clienteSnapshot.telefone?.trim()
      ? { client_phone: clienteSnapshot.telefone.trim() }
      : {}),
    ...(clienteSnapshot.email?.trim() ? { client_email: clienteSnapshot.email.trim() } : {}),
    ...(clientCepDigits ? { client_cep: clientCepDigits } : {}),
    ...(typeof resolvedConsumption === 'number'
      ? { consumption_kwh_month: resolvedConsumption }
      : {}),
    ...(typeof resolvedSystemKwp === 'number' ? { system_kwp: resolvedSystemKwp } : {}),
    ...(typeof resolvedTermMonths === 'number'
      ? { term_months: Math.round(resolvedTermMonths) }
      : {}),
    ...(ucBeneficiaria ? { uc_beneficiaria: ucBeneficiaria } : {}),
  }
}
