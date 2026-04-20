/**
 * src/lib/services/closeProposalPipeline.ts
 *
 * CLOSE PROPOSAL PIPELINE — Single-entry pipeline for "Fechar Negócio".
 *
 * Responsibilities:
 *   1. Validate that all required fields are present and valid (gate).
 *   2. Map proposal snapshot → canonical portfolio payload.
 *   3. Log diagnostic information for every step.
 *   4. Return a structured result for the caller to act on.
 *
 * What this module does NOT do:
 *   • It does not make API calls (pure logic + callbacks).
 *   • It does not mutate React state.
 *   • It does not depend on App.tsx types (uses minimal interface subsets).
 *
 * Usage example (in App.tsx):
 *   const result = validateProposalReadinessForClosing(registro)
 *   if (!result.ok) { setClientReadinessErrors(result.issues); return }
 *   const payload = mapProposalDataToPortfolioFields(registro.propostaSnapshot, registro.dados)
 *   await exportClientToPortfolio(clientId)
 *   await runAutoFillForClient(client)  // immediate usina hydration
 */

import {
  validateClientReadinessForContract,
  type ClientReadinessInput,
  type ValidationIssue,
} from '../validation/clientReadiness'
import {
  mapProposalDataToPortfolioFields,
  type SnapshotInput,
  type ClienteDadosInput,
  type ProposalPortfolioPayload,
} from '../domain/proposalPortfolioMapping'

// ─── Input types ─────────────────────────────────────────────────────────────

/** Minimal client registration fields needed for closing validation */
export interface ClosingClienteDados extends ClienteDadosInput {
  nome?: string
  documento?: string
  email?: string
  telefone?: string
  cep?: string
  uc?: string
  distribuidora?: string
}

/** Full input to the pipeline */
export interface ProposalClosingInput {
  proposalId?: string | null
  clientId?: number | null
  snapshot: SnapshotInput
  clienteDados: ClosingClienteDados
  /** UC beneficiárias (numero strings) for multi-UC validation */
  ucBeneficiarias?: (string | null | undefined)[]
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ProposalReadinessResult {
  /** True when there are no ERROR-severity issues (warnings are non-blocking) */
  ok: boolean
  /** All validation issues (errors + warnings) */
  issues: ValidationIssue[]
  /** Convenience: only error-severity issues */
  errors: ValidationIssue[]
  /** Convenience: only warning-severity issues */
  warnings: ValidationIssue[]
}

export interface ProposalClosingResult {
  /** Whether the pipeline completed successfully */
  ok: boolean
  /** Validation result */
  readiness: ProposalReadinessResult
  /** Normalized payload that was (or would be) persisted */
  payload: ProposalPortfolioPayload | null
  /** Diagnostic log entries produced during the run */
  log: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveSystemKwp(snapshot: SnapshotInput): number | null {
  const ldt = snapshot.leasingSnapshot?.dadosTecnicos
  const vConf = snapshot.vendaSnapshot?.configuracao
  const vForm = snapshot.vendaForm
  const candidates = [
    ldt?.potenciaInstaladaKwp,
    vConf?.potencia_sistema_kwp,
    vForm?.potencia_sistema_kwp,
    snapshot.vendaSnapshot?.potenciaCalculadaKwp,
  ]
  for (const c of candidates) {
    const n = Number(c ?? 0)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function resolveGeracaoKwh(snapshot: SnapshotInput): number | null {
  const ldt = snapshot.leasingSnapshot?.dadosTecnicos
  const vConf = snapshot.vendaSnapshot?.configuracao
  const vForm = snapshot.vendaForm
  const candidates = [
    ldt?.geracaoEstimadakWhMes,
    vConf?.geracao_estimada_kwh_mes,
    vForm?.geracao_estimada_kwh_mes,
  ]
  for (const c of candidates) {
    const n = Number(c ?? 0)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function resolvePrazoMeses(snapshot: SnapshotInput): number | null {
  const candidates = [
    snapshot.prazoMeses,
    snapshot.leasingSnapshot?.prazoContratualMeses,
    snapshot.vendaSnapshot?.financiamento?.prazoMeses,
  ]
  for (const c of candidates) {
    const n = Number(c ?? 0)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

// ─── Core validation ─────────────────────────────────────────────────────────

/**
 * Run the full proposal readiness check before allowing "Fechar Negócio".
 *
 * Validates:
 *   • CEP (error — blocks)
 *   • CPF/CNPJ (error — blocks)
 *   • Phone (error — blocks)
 *   • Email (error — blocks)
 *   • UC geradora (error — blocks)
 *   • UC beneficiárias (error — blocks when present)
 *   • Distribuidora (warning — non-blocking)
 *   • Potência do sistema / kWp (warning — non-blocking)
 *   • Geração estimada (warning — non-blocking)
 *   • Prazo contratual (warning — non-blocking)
 */
export function validateProposalReadinessForClosing(
  input: ProposalClosingInput,
): ProposalReadinessResult {
  const { snapshot, clienteDados, ucBeneficiarias, proposalId } = input

  const systemKwp = resolveSystemKwp(snapshot)
  const geracaoKwh = resolveGeracaoKwh(snapshot)
  const prazoMeses = resolvePrazoMeses(snapshot)

  const readinessInput: ClientReadinessInput = {
    cep: clienteDados.cep,
    document: clienteDados.documento,
    phone: clienteDados.telefone,
    email: clienteDados.email,
    ucGeradora: clienteDados.uc,
    ucBeneficiarias: ucBeneficiarias ?? [],
    distribuidora: clienteDados.distribuidora,
    systemKwp,
    geracaoEstimadaKwh: geracaoKwh,
    prazoMeses,
  }

  const result = validateClientReadinessForContract(readinessInput)

  console.info('[closing] validating proposal readiness', {
    proposalId,
    clienteNome: clienteDados.nome,
    ok: result.ok,
    issues: result.issues.map((i) => `${i.severity}:${i.field}`),
    systemKwp,
    geracaoKwh,
    prazoMeses,
  })

  return {
    ok: result.ok,
    issues: result.issues,
    errors: result.issues.filter((i) => i.severity === 'error'),
    warnings: result.issues.filter((i) => i.severity === 'warning'),
  }
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

/**
 * Run the full "Fechar Negócio" pipeline:
 *
 *   1. Validate readiness — abort on errors.
 *   2. Map proposal → portfolio fields.
 *   3. Log all diagnostic info.
 *   4. Return a structured result.
 *
 * The caller is responsible for the actual API calls (export + patch),
 * using the `payload` in the returned result.
 *
 * @example
 * ```ts
 * const result = closeProposalAndHydrateClientPortfolio(input)
 * if (!result.ok) {
 *   setClientReadinessErrors(result.readiness.errors)
 *   return
 * }
 * await exportClientToPortfolio(clientId)
 * await patchPortfolioUsina(clientId, result.payload!.usinaConfig)
 * await patchPortfolioContract(clientId, result.payload!.contract)
 * ```
 */
export function closeProposalAndHydrateClientPortfolio(
  input: ProposalClosingInput,
): ProposalClosingResult {
  const log: string[] = []
  const { proposalId, clientId, snapshot, clienteDados } = input

  const tag = `[closing] proposalId=${proposalId ?? 'none'} clientId=${clientId ?? 'none'}`
  const logStep = (step: number, msg: string) => log.push(`${tag} step=${step} ${msg}`)

  // Step 1 — Validate readiness ───────────────────────────────────────────────
  logStep(1, 'validate_readiness')
  const readiness = validateProposalReadinessForClosing(input)

  if (!readiness.ok) {
    logStep(1, `BLOCKED issues=${readiness.errors.map((e) => e.field).join(',')}`)
    return { ok: false, readiness, payload: null, log }
  }

  if (readiness.warnings.length > 0) {
    logStep(1, `warnings=${readiness.warnings.map((w) => w.field).join(',')}`)
  }

  // Step 2 — Map proposal → portfolio fields ──────────────────────────────────
  logStep(2, 'mapping_proposal_to_portfolio')

  const payload = mapProposalDataToPortfolioFields(snapshot, clienteDados)

  // Table name → payload group map for logging and tablesPopulated derivation
  const tablePayloadMap: Record<string, Record<string, unknown>> = {
    clients: payload.clients,
    client_usina_config: payload.usinaConfig,
    client_contracts: payload.contract,
    client_energy_profile: payload.energyProfile,
    client_billing_profile: payload.billingProfile,
  }
  const logNames: Record<string, string> = {
    clients: 'mapping_clients',
    client_usina_config: 'mapping_usina',
    client_contracts: 'mapping_contract',
    client_energy_profile: 'mapping_energy_profile',
    client_billing_profile: 'mapping_billing',
  }
  for (const [table, group] of Object.entries(tablePayloadMap)) {
    logStep(2, `${logNames[table]} fields=${Object.keys(group).join(',')}`)
  }

  // Step 3 — Log engine results ───────────────────────────────────────────────
  logStep(3, `engine_results systemKwp=${payload.clients.system_kwp ?? 'null'} geracaoKwh=${payload.usinaConfig.geracao_estimada_kwh ?? 'null'} valorMercado=${payload.usinaConfig.valordemercado ?? 'null'}`)

  if (clienteDados.nome) {
    console.info('[closing] mapping proposal -> clients', {
      proposalId,
      clientId,
      fields: Object.keys(payload.clients),
    })
  }

  console.info('[closing] mapping proposal -> usina', {
    proposalId,
    clientId,
    fields: Object.keys(payload.usinaConfig),
    systemKwp: payload.clients.system_kwp,
    geracaoKwh: payload.usinaConfig.geracao_estimada_kwh,
  })

  console.info('[closing] mapping engine result -> contract', {
    proposalId,
    clientId,
    contractType: payload.contract.contract_type,
    termMonths: payload.contract.contractual_term_months,
    valorMercado: payload.usinaConfig.valordemercado,
  })

  logStep(4, 'hydration_complete')

  console.info('[closing] hydration complete', {
    proposalId,
    clientId,
    clientName: clienteDados.nome,
    tablesPopulated: Object.entries(tablePayloadMap)
      .filter(([, group]) => Object.keys(group).length > 0)
      .map(([table]) => table),
  })

  return { ok: true, readiness, payload, log }
}
