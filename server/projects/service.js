// server/projects/service.js
// Orchestrator for project lifecycle operations. All methods are idempotent
// by design so that repeated requests (retries, duplicate clicks, backfill
// re-runs) NEVER duplicate a project.

import {
  findProjectByPlanId,
  insertProject,
  getPlanSnapshotFromContract,
  seedPvDataFromClient,
} from './repository.js'
import { buildNewProjectFields } from './planMapper.js'

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
