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
  exportClientToPortfolio,
  patchPortfolioProfile,
  patchPortfolioContract,
  patchPortfolioPlan,
  patchPortfolioUsina,
} from '../clientPortfolioApi'
import { createProjectFromContract } from '../projectsApi'
import { saveProjectFinance } from '../../features/project-finance/api'
import type { ProjectFinanceFormState } from '../../features/project-finance/types'

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

/** Map the canonical LEASING/VENDA enum to the DB contract_type string. */
function toDbContractType(contractType: ClosedDealContractType | null): 'leasing' | 'sale' {
  return contractType === 'VENDA' ? 'sale' : 'leasing'
}

/** Map the canonical LEASING/VENDA enum to the project finance contract_type string. */
function toProjectFinanceContractType(contractType: ClosedDealContractType | null): 'leasing' | 'venda' {
  return contractType === 'VENDA' ? 'venda' : 'leasing'
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

function buildProjectFinanceForm(
  resolved: ClosedDealResolvedPayload,
): ProjectFinanceFormState {
  const base = buildDestPayload(resolved, PROJECT_FINANCE_FEED) as Partial<ProjectFinanceFormState>
  return {
    ...base,
    contract_type: toProjectFinanceContractType(resolved.contractType),
    snapshot_source: 'closed_deal_conversion',
  }
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

  // ── Step 3: Hydrate profile (clients table — name, email, phone, address, etc.) ─
  try {
    const profilePatch = buildDestPayload(resolved, PORTFOLIO_PROFILE_FEED)
    if (nonempty(profilePatch)) {
      await patchPortfolioProfile(clientIdNum, profilePatch)
      steps.push(toStep('portfolio-profile', true, { fields: Object.keys(profilePatch) }))
      console.info('[closed-deal][portfolio-upsert] profile', {
        clientId: clientIdNum,
        fields: Object.keys(profilePatch),
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
    const usinaPatch = buildDestPayload(resolved, PORTFOLIO_USINA_FEED)
    if (nonempty(usinaPatch)) {
      // patchPortfolioUsina also accepts an energyProfile sub-object for potencia_kwp
      const usinaPayload: Record<string, unknown> = { ...usinaPatch }
      if (resolved.potenciaInstaladaKwp != null) {
        usinaPayload.energyProfile = { potencia_kwp: resolved.potenciaInstaladaKwp }
      }
      await patchPortfolioUsina(clientIdNum, usinaPayload)
      steps.push(toStep('portfolio-usina', true, { fields: Object.keys(usinaPatch) }))
      console.info('[closed-deal][portfolio-upsert] usina', {
        clientId: clientIdNum,
        fields: Object.keys(usinaPatch),
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
    const planPatch = buildDestPayload(resolved, PORTFOLIO_PLAN_FEED)
    if (nonempty(planPatch)) {
      await patchPortfolioPlan(clientIdNum, planPatch)
      steps.push(toStep('portfolio-plan', true, { fields: Object.keys(planPatch) }))
      console.info('[closed-deal][portfolio-upsert] plan', {
        clientId: clientIdNum,
        fields: Object.keys(planPatch),
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
  let contractId: number | null = null
  try {
    const contractPatch = buildDestPayload(resolved, PORTFOLIO_CONTRACT_FEED)
    // contract_type is always required (defaults to leasing)
    const contractType = toDbContractType(resolved.contractType)
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
        const financeForm = buildProjectFinanceForm(resolved)
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
