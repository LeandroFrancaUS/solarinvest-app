/**
 * src/services/deals/convert-client-to-closed-deal.ts
 *
 * CLOSED-DEAL CONVERSION ORCHESTRATOR
 *
 * Single entry-point for "Negócio Fechado" conversion.
 * Orchestrates all hydration steps:
 *   1. Validate client eligibility (caller's responsibility — see closeProposalPipeline.ts)
 *   2. Resolve consolidated payload from all available data sources
 *   3. Mark client as converted in the portfolio (exportClientToPortfolio)
 *   4. Hydrate Carteira de Cliente tables (profile, contract, plan, usina)
 *   5. Create or reuse financial project (Gestão Financeira)
 *   6. Seed project finance profile
 *   7. Record audit metadata
 *
 * Design principles:
 *   • Idempotent: safe to call multiple times for the same client.
 *   • Defensive merge: server-side COALESCE preserves manual edits.
 *   • Never creates duplicate records (contract + project use upsert/from-plan APIs).
 *   • Non-critical steps (project finance) fail gracefully without blocking the conversion.
 *   • Logs every step with [closed-deal] prefix for easy debugging.
 *
 * Usage:
 * ```ts
 * const result = await convertClientToClosedDeal({
 *   clientId: 42,
 *   proposalId: 'abc-123',
 *   clienteDados: registro.dados,
 *   snapshot: registro.propostaSnapshot ?? {},
 *   consultants,
 *   ucBeneficiarias: [...],
 * })
 * if (!result.ok) { handleError(result.error) }
 * ```
 */

import {
  resolveClosedDealPayload,
  type ClosedDealResolvedPayload,
  type ClosedDealContractType,
  type ResolveClosedDealPayloadInput,
} from '../../domain/conversion/resolve-closed-deal-payload'
import {
  buildDestPayload,
  PORTFOLIO_PROFILE_FEED,
  PORTFOLIO_CONTRACT_FEED,
  PORTFOLIO_PLAN_FEED,
  PORTFOLIO_USINA_FEED,
  PROJECT_FINANCE_FEED,
} from '../../domain/conversion/closed-deal-field-map'
import {
  mergeResolvedIntoDependentRecord,
  type FieldPolicy,
  type MergePolicy,
} from '../../domain/conversion/merge-resolved-into-record'
import {
  exportClientToPortfolio,
  fetchPortfolioClient,
  patchPortfolioProfile,
  patchPortfolioContract,
  patchPortfolioPlan,
  patchPortfolioUsina,
} from '../clientPortfolioApi'
import { createProjectFromContract } from '../projectsApi'
import { fetchProjectFinance, saveProjectFinance } from '../../features/project-finance/api'
import type {
  ProjectFinanceFormState,
  ProjectFinanceTechnicalParams,
} from '../../features/project-finance/types'
import type { PortfolioClientRow } from '../../types/clientPortfolio'

// ─── Input / Output types ─────────────────────────────────────────────────────

export type ConvertClientInput = ResolveClosedDealPayloadInput

export interface ConversionStepResult {
  step: string
  ok: boolean
  created?: boolean
  skipped?: boolean
  error?: string
  fields?: string[]
}

export interface ConversionResult {
  /** True when the core conversion succeeded (portfolio export + profile/contract patches). */
  ok: boolean
  /** The resolved payload used for all hydration steps. */
  resolved: ClosedDealResolvedPayload
  /** Per-step results for debugging / diagnostics. */
  steps: ConversionStepResult[]
  /** Error message when ok=false. */
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map the canonical LEASING/VENDA enum to the DB contract_type string.
 *  Returns null when the contract type is unknown — callers must treat
 *  null as a fatal error and abort, not silently default. */
function toDbContractType(
  contractType: ClosedDealContractType | null,
): 'leasing' | 'sale' | null {
  if (contractType === 'VENDA') return 'sale'
  if (contractType === 'LEASING') return 'leasing'
  return null
}

/** Map the canonical LEASING/VENDA enum to the project finance contract_type string. */
function toProjectFinanceContractType(
  contractType: ClosedDealContractType | null,
): 'leasing' | 'venda' | null {
  if (contractType === 'VENDA') return 'venda'
  if (contractType === 'LEASING') return 'leasing'
  return null
}

function toStep(
  step: string,
  ok: boolean,
  extras: Partial<ConversionStepResult> = {},
): ConversionStepResult {
  return { step, ok, ...extras }
}

function nonempty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length > 0
}

/** Extract the subset of a portfolio row that maps to the given destination keys.
 *  Used to feed the defensive merge with the current persisted values. */
function extractExistingForKeys(
  row: PortfolioClientRow | null,
  destKeys: string[],
): Record<string, unknown> {
  if (!row) return {}
  const existing: Record<string, unknown> = {}
  // PortfolioClientRow exposes most flat columns under their DB names already.
  // Read by name; missing keys simply remain undefined → treated as "empty" by
  // the merge helper.
  const source = row as unknown as Record<string, unknown>
  for (const key of destKeys) {
    if (key in source) existing[key] = source[key]
  }
  return existing
}

/** Build the seed payload for project_financial_profiles.
 *
 *  Adds two pieces that the field map cannot express:
 *    1. `client_id` (number) — the resolved payload encodes it as a string;
 *       coerce here so the API gets the right type.
 *    2. `technical_params_json.potencia_modulo_wp` — `potencia_modulo_wp` is
 *       not a top-level column on `project_financial_profiles` but the engine
 *       reads it from `technical_params_json`; seeding it here makes the
 *       Financeiro tab compute without further input.
 */
function buildProjectFinanceForm(
  resolved: ClosedDealResolvedPayload,
  existing: ProjectFinanceFormState | null,
): ProjectFinanceFormState {
  const base = buildDestPayload(resolved, PROJECT_FINANCE_FEED) as Partial<ProjectFinanceFormState>

  // Defensive merge: only seed fields that are still empty on the existing profile.
  const existingRecord = (existing ?? {}) as Record<string, unknown>
  const filtered = mergeResolvedIntoDependentRecord(
    existingRecord,
    base as Record<string, unknown>,
    'fillIfEmpty',
  ) as Partial<ProjectFinanceFormState>

  // client_id: resolved payload encodes it as string; profile column is number.
  const clientIdNum = Number(resolved.clientId)
  if (
    Number.isFinite(clientIdNum) &&
    clientIdNum > 0 &&
    (existing?.client_id == null)
  ) {
    filtered.client_id = clientIdNum
  }

  // technical_params_json: seed potencia_modulo_wp when the engine has nothing.
  const existingTech = existing?.technical_params_json ?? null
  if (resolved.potenciaModuloWp != null && existingTech?.potencia_modulo_wp == null) {
    const techParams: ProjectFinanceTechnicalParams = {
      ...(existingTech ?? {}),
      potencia_modulo_wp: resolved.potenciaModuloWp,
    }
    filtered.technical_params_json = techParams
  }

  const form: ProjectFinanceFormState = {
    ...filtered,
    snapshot_source: 'closed_deal_conversion',
  }

  // contract_type is required on the form; only set when known (caller already
  // aborted in the null case before we reach this point, but stay defensive).
  const projectContractType = toProjectFinanceContractType(resolved.contractType)
  if (projectContractType !== null && existing?.contract_type == null) {
    form.contract_type = projectContractType
  }

  return form
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Run the complete "Negócio Fechado" conversion for a single client.
 *
 * The caller is responsible for:
 *   • Validating proposal readiness (validateProposalReadinessForClosing)
 *   • Confirming with the user
 *   • Refreshing the client list after this resolves
 */
export async function convertClientToClosedDeal(
  input: ConvertClientInput,
): Promise<ConversionResult> {
  const clientIdNum = Number(input.clientId)
  const steps: ConversionStepResult[] = []

  // ── Step 1: Resolve consolidated payload ─────────────────────────────────────
  const resolved = resolveClosedDealPayload(input)

  console.info('[closed-deal][resolve] payload resolved', {
    clientId: resolved.clientId,
    proposalId: resolved.proposalId,
    contractType: resolved.contractType,
    consultantId: resolved.consultantId,
    nome: resolved.nome,
    cidade: resolved.cidade,
    uf: resolved.uf,
    distribuidora: resolved.distribuidora,
    ucGeradora: resolved.ucGeradora,
    potenciaInstaladaKwp: resolved.potenciaInstaladaKwp,
    geracaoEstimadaKwhMes: resolved.geracaoEstimadaKwhMes,
    prazoMeses: resolved.prazoMeses,
  })

  // ── Step 2: Export client to portfolio (idempotent — marks in_portfolio=true) ─
  try {
    await exportClientToPortfolio(clientIdNum)
    steps.push(toStep('portfolio-export', true))
    console.info('[closed-deal][portfolio-export] ok', { clientId: clientIdNum })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push(toStep('portfolio-export', false, { error: msg }))
    console.error('[closed-deal][portfolio-export] failed — aborting', { clientId: clientIdNum, error: msg })
    return { ok: false, resolved, steps, error: `Exportação para carteira falhou: ${msg}` }
  }

  // ── Step 2b: Fetch existing dependent record so the client-side merge can
  //            preserve manual edits (server-side COALESCE is the second line
  //            of defence; we filter here to avoid even sending the keys).
  let existingPortfolio: PortfolioClientRow | null = null
  try {
    existingPortfolio = await fetchPortfolioClient(clientIdNum)
  } catch (err) {
    // Non-fatal: defensive merge degrades to "fill all fields" and the
    // server-side COALESCE still preserves whatever is already there.
    console.warn('[closed-deal][portfolio-upsert] could not fetch existing portfolio — falling back to server-side COALESCE only', {
      clientId: clientIdNum,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // ── Step 3: Hydrate profile (clients table — name, email, phone, address, etc.) ─
  try {
    const profileRaw = buildDestPayload(resolved, PORTFOLIO_PROFILE_FEED)
    const profileExisting = extractExistingForKeys(
      existingPortfolio,
      PORTFOLIO_PROFILE_FEED.map((f) => f.destKey),
    )
    const profilePatch = mergeResolvedIntoDependentRecord(
      profileExisting,
      profileRaw,
      'fillIfEmpty',
    )
    if (nonempty(profilePatch)) {
      await patchPortfolioProfile(clientIdNum, profilePatch)
      steps.push(toStep('portfolio-profile', true, { fields: Object.keys(profilePatch) }))
      console.info('[closed-deal][portfolio-upsert] profile', {
        clientId: clientIdNum,
        fields: Object.keys(profilePatch),
        preserved: Object.keys(profileRaw).filter((k) => !(k in profilePatch)),
      })
    } else {
      steps.push(toStep('portfolio-profile', true, { skipped: true }))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push(toStep('portfolio-profile', false, { error: msg }))
    console.warn('[closed-deal][portfolio-upsert] profile failed (non-fatal)', { clientId: clientIdNum, error: msg })
    // Non-fatal: continue with remaining steps
  }

  // ── Step 4: Hydrate usina config ──────────────────────────────────────────────
  try {
    const usinaRaw = buildDestPayload(resolved, PORTFOLIO_USINA_FEED)
    const usinaExisting = extractExistingForKeys(
      existingPortfolio,
      PORTFOLIO_USINA_FEED.map((f) => f.destKey),
    )
    const usinaPatch = mergeResolvedIntoDependentRecord(
      usinaExisting,
      usinaRaw,
      'fillIfEmpty',
    )
    if (nonempty(usinaPatch)) {
      // patchPortfolioUsina also accepts an energyProfile sub-object for potencia_kwp
      const usinaPayload: Record<string, unknown> = { ...usinaPatch }
      if (
        resolved.potenciaInstaladaKwp != null &&
        existingPortfolio?.potencia_kwp == null
      ) {
        usinaPayload.energyProfile = { potencia_kwp: resolved.potenciaInstaladaKwp }
      }
      await patchPortfolioUsina(clientIdNum, usinaPayload)
      steps.push(toStep('portfolio-usina', true, { fields: Object.keys(usinaPatch) }))
      console.info('[closed-deal][portfolio-upsert] usina', {
        clientId: clientIdNum,
        fields: Object.keys(usinaPatch),
        preserved: Object.keys(usinaRaw).filter((k) => !(k in usinaPatch)),
      })
    } else {
      steps.push(toStep('portfolio-usina', true, { skipped: true }))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push(toStep('portfolio-usina', false, { error: msg }))
    console.warn('[closed-deal][portfolio-upsert] usina failed (non-fatal)', { clientId: clientIdNum, error: msg })
  }

  // ── Step 5: Hydrate energy profile (plan fields) ──────────────────────────────
  try {
    const planRaw = buildDestPayload(resolved, PORTFOLIO_PLAN_FEED)
    const planExisting = extractExistingForKeys(
      existingPortfolio,
      PORTFOLIO_PLAN_FEED.map((f) => f.destKey),
    )
    const planPatch = mergeResolvedIntoDependentRecord(
      planExisting,
      planRaw,
      'fillIfEmpty',
    )
    if (nonempty(planPatch)) {
      await patchPortfolioPlan(clientIdNum, planPatch)
      steps.push(toStep('portfolio-plan', true, { fields: Object.keys(planPatch) }))
      console.info('[closed-deal][portfolio-upsert] plan', {
        clientId: clientIdNum,
        fields: Object.keys(planPatch),
        preserved: Object.keys(planRaw).filter((k) => !(k in planPatch)),
      })
    } else {
      steps.push(toStep('portfolio-plan', true, { skipped: true }))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push(toStep('portfolio-plan', false, { error: msg }))
    console.warn('[closed-deal][portfolio-upsert] plan failed (non-fatal)', { clientId: clientIdNum, error: msg })
  }

  // ── Step 6: Upsert contract ───────────────────────────────────────────────────
  // Contract type is required for the project finance engine — refuse to
  // silently default to leasing when it is unknown.
  const contractType = toDbContractType(resolved.contractType)
  let contractId: number | null = null
  if (contractType === null) {
    const errMsg = 'Tipo de contrato (LEASING/VENDA) não pôde ser determinado a partir da proposta.'
    steps.push(toStep('portfolio-contract', false, { error: errMsg }))
    steps.push(toStep('financial-project', false, { skipped: true, error: errMsg }))
    steps.push(toStep('financial-profile', false, { skipped: true, error: errMsg }))
    console.error('[closed-deal][portfolio-upsert] contract aborted — unknown contract type', {
      clientId: clientIdNum,
      proposalId: resolved.proposalId,
    })
    console.info('[closed-deal][done]', {
      clientId: clientIdNum,
      proposalId: resolved.proposalId,
      contractType: null,
      stepsOk: steps.filter((s) => s.ok).map((s) => s.step),
      stepsFailed: steps.filter((s) => !s.ok).map((s) => s.step),
    })
    return { ok: false, resolved, steps, error: errMsg }
  }
  try {
    const contractRaw = buildDestPayload(resolved, PORTFOLIO_CONTRACT_FEED)
    // Build a "current" record for the contract from the portfolio row's
    // contract-related columns to drive defensive merge.
    const contractExisting = extractExistingForKeys(
      existingPortfolio,
      PORTFOLIO_CONTRACT_FEED.map((f) => f.destKey),
    )
    // For the contract, never overwrite an existing consultant_id — that is a
    // manual assignment and must not be downgraded. All other fields use
    // neverDowngradeToNull (already enforced globally by the merge helper).
    const perFieldPolicy: FieldPolicy = {}
    if (contractExisting.consultant_id != null) {
      perFieldPolicy.consultant_id = 'preserveManual'
    }
    const contractPolicy: MergePolicy = 'neverDowngradeToNull'
    const contractPatch = mergeResolvedIntoDependentRecord(
      contractExisting,
      contractRaw,
      contractPolicy,
      perFieldPolicy,
    )
    contractId = await patchPortfolioContract(clientIdNum, {
      ...contractPatch,
      contract_type: contractType,
    })
    steps.push(toStep('portfolio-contract', true, { fields: Object.keys(contractPatch) }))
    console.info('[closed-deal][portfolio-upsert] contract', {
      clientId: clientIdNum,
      contractId,
      contractType,
      fields: Object.keys(contractPatch),
      preserved: Object.keys(contractRaw).filter((k) => !(k in contractPatch)),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push(toStep('portfolio-contract', false, { error: msg }))
    console.warn('[closed-deal][portfolio-upsert] contract failed (non-fatal)', { clientId: clientIdNum, error: msg })
  }

  // ── Step 7: Create Gestão Financeira project from contract ───────────────────
  if (contractId != null) {
    try {
      const { project, created } = await createProjectFromContract(contractId)
      steps.push(toStep('financial-project', true, { created }))
      console.info('[closed-deal][financial-upsert] project', {
        clientId: clientIdNum,
        contractId,
        projectId: project.id,
        created,
      })

      // ── Step 8: Seed project finance profile ────────────────────────────────
      try {
        // Fetch existing profile so the seed only fills empty fields.
        let existingProfile: ProjectFinanceFormState | null = null
        try {
          const fin = await fetchProjectFinance(project.id)
          existingProfile = (fin?.profile ?? null) as ProjectFinanceFormState | null
        } catch {
          // Project is new → no profile yet → fall through with null.
          existingProfile = null
        }
        const financeForm = buildProjectFinanceForm(resolved, existingProfile)
        await saveProjectFinance(project.id, financeForm)
        steps.push(toStep('financial-profile', true, { fields: Object.keys(financeForm) }))
        console.info('[closed-deal][financial-upsert] project-finance seeded', {
          clientId: clientIdNum,
          projectId: project.id,
          contractType: resolved.contractType,
          fields: Object.keys(financeForm),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        steps.push(toStep('financial-profile', false, { error: msg }))
        console.warn('[closed-deal][financial-upsert] project-finance seed failed (non-fatal)', {
          clientId: clientIdNum,
          projectId: project.id,
          error: msg,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      steps.push(toStep('financial-project', false, { error: msg }))
      console.warn('[closed-deal][financial-upsert] project creation failed (non-fatal)', {
        clientId: clientIdNum,
        contractId,
        error: msg,
      })
    }
  } else {
    steps.push(toStep('financial-project', true, { skipped: true }))
    steps.push(toStep('financial-profile', true, { skipped: true }))
    console.info('[closed-deal][financial-upsert] skipped — no contractId', { clientId: clientIdNum })
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  const failedCritical = steps.find((s) => !s.ok && s.step === 'portfolio-export')

  console.info('[closed-deal][done]', {
    clientId: clientIdNum,
    proposalId: resolved.proposalId,
    contractType: resolved.contractType,
    stepsOk: steps.filter((s) => s.ok).map((s) => s.step),
    stepsFailed: steps.filter((s) => !s.ok).map((s) => s.step),
  })

  return {
    ok: failedCritical == null,
    resolved,
    steps,
  }
}
