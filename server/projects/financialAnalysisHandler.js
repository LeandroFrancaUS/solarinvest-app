// server/projects/financialAnalysisHandler.js
// Handles GET|PUT /api/projects/:id/financial-analysis
//
// GET  → returns { project_id, contract_type, inputs_json, outputs_json, saved_at }
//         inputs_json / outputs_json are null when no snapshot has been saved yet.
// PUT  → upserts the snapshot; body: { inputs_json, outputs_json }
//
// No engine calculation happens here — the frontend computes outputs_json and
// sends it along with inputs_json.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'

const READ_ROLES  = ['role_admin', 'role_office', 'role_financeiro']
const WRITE_ROLES = ['role_admin', 'role_office']

function sendError(sendJson, status, code, message) {
  sendJson(status, { error: { code, message } })
}

function requireRole(actor, roles, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  if (!roles.includes(actorRole(actor))) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso não permitido para este perfil.')
    return false
  }
  return true
}

export async function handleProjectFinancialAnalysis(
  req,
  _res,
  { method, projectId, readJsonBody, sendJson },
) {
  if (!projectId) {
    sendError(sendJson, 400, 'MISSING_PROJECT_ID', 'projectId ausente.')
    return
  }

  const client = getDatabaseClient()
  const actor  = await resolveActor(req, client)

  // ── GET ────────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    if (!requireRole(actor, READ_ROLES, sendJson)) return

    const sql = createUserScopedSql(client, actor)

    // Fetch project to confirm it exists and get contract_type
    const projectRows = await sql`
      SELECT id, project_type
      FROM projects
      WHERE id = ${projectId}
      LIMIT 1
    `
    if (!projectRows.length) {
      sendError(sendJson, 404, 'PROJECT_NOT_FOUND', 'Projeto não encontrado.')
      return
    }
    const project = projectRows[0]

    // Fetch snapshot (may not exist yet)
    const snapshotRows = await sql`
      SELECT inputs_json, outputs_json, updated_at
      FROM project_financial_analysis_snapshots
      WHERE project_id = ${projectId}
      LIMIT 1
    `
    const snapshot = snapshotRows[0] ?? null

    sendJson(200, {
      data: {
        project_id:    projectId,
        contract_type: project.project_type,   // 'leasing' | 'venda'
        inputs_json:   snapshot?.inputs_json  ?? null,
        outputs_json:  snapshot?.outputs_json ?? null,
        saved_at:      snapshot?.updated_at   ?? null,
      },
    })
    return
  }

  // ── PUT ────────────────────────────────────────────────────────────────────
  if (method === 'PUT') {
    if (!requireRole(actor, WRITE_ROLES, sendJson)) return

    const body = await readJsonBody()
    if (!body || typeof body !== 'object') {
      sendError(sendJson, 400, 'INVALID_BODY', 'Corpo da requisição inválido.')
      return
    }

    const { inputs_json, outputs_json } = body

    const sql = createUserScopedSql(client, actor)

    // Confirm project exists
    const projectRows = await sql`
      SELECT id, project_type FROM projects WHERE id = ${projectId} LIMIT 1
    `
    if (!projectRows.length) {
      sendError(sendJson, 404, 'PROJECT_NOT_FOUND', 'Projeto não encontrado.')
      return
    }
    const project = projectRows[0]

    const rows = await sql`
      INSERT INTO project_financial_analysis_snapshots
        (project_id, inputs_json, outputs_json, updated_at)
      VALUES (
        ${projectId},
        ${inputs_json != null ? JSON.stringify(inputs_json) : null},
        ${outputs_json != null ? JSON.stringify(outputs_json) : null},
        now()
      )
      ON CONFLICT (project_id) DO UPDATE SET
        inputs_json  = EXCLUDED.inputs_json,
        outputs_json = EXCLUDED.outputs_json,
        updated_at   = now()
      RETURNING inputs_json, outputs_json, updated_at
    `
    const saved = rows[0]

    sendJson(200, {
      data: {
        project_id:    projectId,
        contract_type: project.project_type,
        inputs_json:   saved.inputs_json  ?? null,
        outputs_json:  saved.outputs_json ?? null,
        saved_at:      saved.updated_at   ?? null,
      },
    })
    return
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Método ${method} não permitido.`)
}
