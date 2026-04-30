// server/projects/service.js
// Orchestrator for project lifecycle operations. All methods are idempotent
// by design so that repeated requests (retries, duplicate clicks, backfill
// re-runs) NEVER duplicate a project.

import crypto from 'node:crypto'
import {
  findProjectByPlanId,
  insertProject,
  getPlanSnapshotFromContract,
  seedPvDataFromClient,
} from './repository.js'
import { buildNewProjectFields, isProjectType } from './planMapper.js'

/** Prefix used for plan_id on standalone projects (no contract required). */
export const STANDALONE_PLAN_PREFIX = 'standalone:'

/**
 * Creates a project for the given plan snapshot, or returns the existing
 * project linked to the same plan_id (identified either explicitly or derived
 * from the contract).
 *
 * Idempotency guarantees:
 *   • If a non-deleted project already exists with that plan_id → it is returned as-is.
 *   • The DB-level UNIQUE index on projects.plan_id also defends against races.
 *
 * @param {Object} sql — user-scoped sql function (from createUserScopedSql)
 * @param {Object} snapshot — normalised plan snapshot (see planMapper.js)
 * @param {Object} [options]
 * @param {string|null} [options.userId] — actor userId for audit columns
 * @returns {Promise<{ project: Object, created: boolean }>}
 */
export async function createOrReuseProjectFromPlan(sql, snapshot, options = {}) {
  const userId = options.userId ?? null

  // Validate + normalise input (throws with `validationErrors` on invalid plan).
  const fields = buildNewProjectFields(snapshot)

  // Fast path: already exists.
  const existing = await findProjectByPlanId(sql, fields.plan_id)
  if (existing) {
    return { project: existing, created: false }
  }

  // Slow path: create. The DB UNIQUE(plan_id) index protects us from racing.
  try {
    const project = await insertProject(sql, fields, userId)
    // Seed PV data once (no-op if it already exists).
    await seedPvDataFromClient(sql, project.id, project.client_id)
    return { project, created: true }
  } catch (err) {
    // Race collision with a concurrent create → re-fetch and return existing.
    if (err?.code === '23505') {
      const existing2 = await findProjectByPlanId(sql, fields.plan_id)
      if (existing2) return { project: existing2, created: false }
    }
    throw err
  }
}

/**
 * Creates (or reuses) a project from a client_contracts row id. This is the
 * canonical entry point from the plan-effectivation hook: the UI/service
 * layer that transitions a contract into the "active" state calls this
 * function, which takes care of snapshotting and idempotency.
 */
export async function createOrReuseProjectFromContractId(sql, contractId, options = {}) {
  const snapshot = await getPlanSnapshotFromContract(sql, contractId)
  if (!snapshot) {
    const err = new Error(`Contrato ${contractId} não encontrado ou cliente inativo.`)
    err.code = 'CONTRACT_NOT_FOUND'
    throw err
  }
  return createOrReuseProjectFromPlan(sql, snapshot, options)
}

/**
 * Creates a standalone project for an existing client — no contract required.
 * Each call generates a new unique plan_id (`standalone:<uuid>`) so multiple
 * standalone projects can coexist for the same client.
 *
 * @param {Object} sql — user-scoped sql function (from createUserScopedSql)
 * @param {Object} params
 * @param {number} params.clientId — existing client id (must exist in DB)
 * @param {string} params.projectType — 'leasing' | 'venda'
 * @param {Object} [options]
 * @param {string|null} [options.userId] — actor userId for audit columns
 * @returns {Promise<{ project: Object, created: boolean }>}
 */
export async function createStandaloneProject(sql, { clientId, projectType }, options = {}) {
  const userId = options.userId ?? null

  if (!Number.isFinite(Number(clientId)) || Number(clientId) <= 0) {
    const err = new Error('clientId inválido.')
    err.code = 'INVALID_CLIENT_ID'
    throw err
  }
  if (!isProjectType(projectType)) {
    const err = new Error('projectType deve ser "leasing" ou "venda".')
    err.code = 'INVALID_PROJECT_TYPE'
    throw err
  }

  // Verify the client exists and is not deleted.
  const clientRows = await sql`
    SELECT
      id,
      client_name,
      client_document AS cpf_cnpj,
      client_city     AS city,
      client_state    AS state
    FROM clients
    WHERE id = ${Number(clientId)}
      AND deleted_at IS NULL
    LIMIT 1
  `
  const clientRow = clientRows[0]
  if (!clientRow) {
    const err = new Error(`Cliente ${clientId} não encontrado ou inativo.`)
    err.code = 'CLIENT_NOT_FOUND'
    throw err
  }

  const planId = `${STANDALONE_PLAN_PREFIX}${crypto.randomUUID()}`

  const textOrNull = (v) => {
    if (v == null) return null
    const t = String(v).trim()
    return t.length ? t : null
  }

  const fields = {
    client_id: Number(clientId),
    plan_id: planId,
    contract_id: null,
    proposal_id: null,
    project_type: projectType,
    status: 'Aguardando',
    client_name_snapshot: textOrNull(clientRow.client_name),
    cpf_cnpj_snapshot: textOrNull(clientRow.cpf_cnpj),
    city_snapshot: textOrNull(clientRow.city),
    state_snapshot: textOrNull(clientRow.state),
  }

  const project = await insertProject(sql, fields, userId)
  // Seed PV data from client's existing energy profile (no-op if nothing exists).
  await seedPvDataFromClient(sql, project.id, project.client_id)
  return { project, created: true }
}
