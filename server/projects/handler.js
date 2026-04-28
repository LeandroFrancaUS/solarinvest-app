// server/projects/handler.js
// Handles /api/projects/* HTTP routes.
// RBAC: read  → admin | office | financeiro
//       write → admin | office   (comercial and others denied)

import { randomUUID } from 'node:crypto'
import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import {
  findProjectById,
  findPvDataByProjectId,
  updateProject,
  updateProjectStatus,
  upsertPvData,
  listProjects,
  getProjectSummary,
} from './repository.js'
import {
  createOrReuseProjectFromContractId,
  createOrReuseProjectFromPlan,
} from './service.js'
import { isProjectStatus, isProjectType } from './planMapper.js'

// ─────────────────────────────────────────────────────────────────────────────
// Access helpers (mirrors server/client-portfolio/handler.js conventions)
// ─────────────────────────────────────────────────────────────────────────────

const READ_ROLES = ['role_admin', 'role_office', 'role_financeiro']
const WRITE_ROLES = ['role_admin', 'role_office']

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function requireRead(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  if (!READ_ROLES.includes(actorRole(actor))) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso a Projetos não permitido para este perfil.')
    return false
  }
  return true
}

function requireWrite(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  if (!WRITE_ROLES.includes(actorRole(actor))) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Operação de escrita em Projetos requer perfil admin ou office.')
    return false
  }
  return true
}

async function getScopedSql(actor) {
  const db = getDatabaseClient()
  if (!db?.sql) {
    const err = new Error('Database not configured')
    err.statusCode = 503
    throw err
  }
  return createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
}

// Common error logger.
function logError(scope, err, extra = {}) {
  console.error(`[projects][${scope}] error`, {
    ...extra,
    code: err?.code ?? null,
    detail: err?.detail ?? null,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects
// ─────────────────────────────────────────────────────────────────────────────
export async function handleProjectsList(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireRead(actor, sendJson)) return
  if (method !== 'GET') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const url = new URL(requestUrl, 'http://localhost')
    const qp = url.searchParams

    const projectTypeRaw = qp.get('project_type')
    const statusRaw = qp.get('status')
    const searchRaw = qp.get('search')

    if (projectTypeRaw && !isProjectType(projectTypeRaw)) {
      sendError(sendJson, 400, 'INVALID_PROJECT_TYPE', 'project_type deve ser "leasing" ou "venda".')
      return
    }
    if (statusRaw && !isProjectStatus(statusRaw)) {
      sendError(
        sendJson,
        400,
        'INVALID_STATUS',
        'status deve ser "Aguardando", "Em andamento" ou "Concluído".',
      )
      return
    }

    const filters = {
      project_type: projectTypeRaw || undefined,
      status: statusRaw || undefined,
      client_id: qp.get('client_id') ? Number(qp.get('client_id')) : undefined,
      search: searchRaw?.trim() || undefined,
      limit: qp.get('limit') ? Number(qp.get('limit')) : undefined,
      offset: qp.get('offset') ? Number(qp.get('offset')) : undefined,
      order_by: qp.get('order_by') || undefined,
      order_dir: qp.get('order_dir') || undefined,
    }

    const result = await listProjects(sql, filters)
    sendJson(200, { data: result.rows, meta: { total: result.total, limit: result.limit, offset: result.offset } })
  } catch (err) {
    logError('list', err)
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao listar projetos.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects/summary
// ─────────────────────────────────────────────────────────────────────────────
export async function handleProjectsSummary(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireRead(actor, sendJson)) return
  if (method !== 'GET') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }
  try {
    const sql = await getScopedSql(actor)
    const data = await getProjectSummary(sql)
    sendJson(200, { data })
  } catch (err) {
    logError('summary', err)
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao agregar resumo de projetos.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects/:id
// PATCH /api/projects/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function handleProjectById(req, res, { method, projectId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)

  if (method === 'GET') {
    if (!requireRead(actor, sendJson)) return
    try {
      const sql = await getScopedSql(actor)
      const project = await findProjectById(sql, projectId)
      if (!project) {
        sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
        return
      }
      const pv_data = await findPvDataByProjectId(sql, projectId)
      sendJson(200, { data: { ...project, pv_data } })
    } catch (err) {
      logError('get', err, { projectId })
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao carregar projeto.')
    }
    return
  }

  if (method === 'PATCH') {
    if (!requireWrite(actor, sendJson)) return
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      sendError(sendJson, 400, 'INVALID_JSON', 'JSON inválido na requisição.')
      return
    }
    if (!body || typeof body !== 'object') {
      sendError(sendJson, 400, 'INVALID_BODY', 'Corpo da requisição inválido.')
      return
    }
    try {
      const sql = await getScopedSql(actor)
      const updated = await updateProject(sql, projectId, body, actor?.userId ?? null)
      if (!updated) {
        sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
        return
      }
      sendJson(200, { data: updated })
    } catch (err) {
      logError('patch', err, { projectId })
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao atualizar projeto.')
    }
    return
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/projects/:id/status
// ─────────────────────────────────────────────────────────────────────────────
export async function handleProjectStatus(req, res, { method, projectId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWrite(actor, sendJson)) return
  if (method !== 'PATCH') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendError(sendJson, 400, 'INVALID_JSON', 'JSON inválido na requisição.')
    return
  }
  const status = body?.status
  if (!isProjectStatus(status)) {
    sendError(
      sendJson,
      400,
      'INVALID_STATUS',
      'status deve ser "Aguardando", "Em andamento" ou "Concluído".',
    )
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const updated = await updateProjectStatus(sql, projectId, status, actor?.userId ?? null)
    if (!updated) {
      sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
      return
    }
    sendJson(200, { data: updated })
  } catch (err) {
    logError('patch-status', err, { projectId })
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao atualizar status do projeto.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/projects/:id/pv-data
// ─────────────────────────────────────────────────────────────────────────────
export async function handleProjectPvData(req, res, { method, projectId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWrite(actor, sendJson)) return
  if (method !== 'PATCH') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendError(sendJson, 400, 'INVALID_JSON', 'JSON inválido na requisição.')
    return
  }
  if (!body || typeof body !== 'object') {
    sendError(sendJson, 400, 'INVALID_BODY', 'Corpo da requisição inválido.')
    return
  }

  try {
    const sql = await getScopedSql(actor)
    // Ensure the project exists and is visible to the actor under RLS.
    const project = await findProjectById(sql, projectId)
    if (!project) {
      sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
      return
    }
    const row = await upsertPvData(sql, projectId, body)
    sendJson(200, { data: row })
  } catch (err) {
    logError('pv-data', err, { projectId })
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao atualizar dados da usina do projeto.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projects/from-analise
// ─────────────────────────────────────────────────────────────────────────────
// Creates (or reuses) a project from an Análise Financeira result. Unlike the
// from-plan endpoint (which requires a signed contract), this endpoint accepts
// a minimal snapshot from the financial analysis simulation. It is idempotent
// when the caller provides the same analise_id on repeated requests.
//
// Required body fields:
//   client_id    – BIGINT, must reference an existing client
//   project_type – "leasing" | "venda"
//
// Optional body fields:
//   analise_id   – stable key for idempotency (any string; suggested: UUID)
//   client_name  – snapshot of client name
//   cpf_cnpj     – snapshot of client document
//   city         – snapshot of client city
//   state        – snapshot of client state
export async function handleProjectFromAnalise(req, res, { method, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWrite(actor, sendJson)) return
  if (method !== 'POST') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendError(sendJson, 400, 'INVALID_JSON', 'JSON inválido na requisição.')
    return
  }
  if (!body || typeof body !== 'object') {
    sendError(sendJson, 400, 'INVALID_BODY', 'Corpo da requisição inválido.')
    return
  }

  const clientId = body.client_id != null ? Number(body.client_id) : null
  if (!clientId || !Number.isFinite(clientId) || clientId <= 0) {
    sendError(
      sendJson,
      400,
      'MISSING_CLIENT_ID',
      'client_id é obrigatório para criar projeto a partir da Análise Financeira.',
    )
    return
  }

  const projectType = body.project_type
  if (!isProjectType(projectType)) {
    sendError(sendJson, 400, 'INVALID_PROJECT_TYPE', 'project_type deve ser "leasing" ou "venda".')
    return
  }

  // Derive a stable plan_id from the caller-supplied analise_id (idempotency
  // key), or generate a random one when not supplied. The prefix "analise:"
  // distinguishes these records from contract-based projects ("contract:<id>").
  const analiseId =
    typeof body.analise_id === 'string' && body.analise_id.trim()
      ? body.analise_id.trim()
      : randomUUID()
  const planId = `analise:${analiseId}`

  const snapshot = {
    client_id: clientId,
    plan_id: planId,
    contract_id: null,
    proposal_id: null,
    // project_type doubles as contract_type — planMapper handles both 'leasing'
    // and 'venda' directly (same values).
    contract_type: projectType,
    client_name: typeof body.client_name === 'string' ? body.client_name : null,
    cpf_cnpj: typeof body.cpf_cnpj === 'string' ? body.cpf_cnpj : null,
    city: typeof body.city === 'string' ? body.city : null,
    state: typeof body.state === 'string' ? body.state : null,
  }

  try {
    const sql = await getScopedSql(actor)
    const result = await createOrReuseProjectFromPlan(sql, snapshot, { userId: actor?.userId ?? null })
    sendJson(result.created ? 201 : 200, { data: result.project, meta: { created: result.created } })
  } catch (err) {
    if (err?.code === 'INVALID_PLAN' || err?.validationErrors) {
      sendJson(422, {
        error: {
          code: 'INVALID_PLAN',
          message: err.message,
          details: err.validationErrors ?? null,
        },
      })
      return
    }
    logError('from-analise', err, { clientId, projectType })
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao criar projeto a partir da Análise Financeira.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projects/from-plan/:planId
// ─────────────────────────────────────────────────────────────────────────────
// planId is either a raw contract_id (numeric) or the canonical "contract:<id>"
// key. Either way we resolve through the contract, so effectivation hooks can
// pass whichever value they have handy.
export async function handleProjectFromPlan(req, res, { method, planId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWrite(actor, sendJson)) return
  if (method !== 'POST') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  // Optional body with override snapshot (rarely used — mainly for tests and
  // migrations that already assembled a full snapshot).
  let body = null
  try {
    body = await readJsonBody(req)
  } catch {
    body = null
  }

  try {
    const sql = await getScopedSql(actor)

    let result
    if (body && body.snapshot) {
      result = await createOrReuseProjectFromPlan(sql, body.snapshot, { userId: actor?.userId ?? null })
    } else {
      const raw = String(planId ?? '').trim()
      const contractId = raw.startsWith('contract:') ? Number(raw.slice('contract:'.length)) : Number(raw)
      if (!Number.isFinite(contractId) || contractId <= 0) {
        sendError(sendJson, 400, 'INVALID_PLAN_ID', 'planId inválido. Informe um contract_id numérico ou "contract:<id>".')
        return
      }
      result = await createOrReuseProjectFromContractId(sql, contractId, { userId: actor?.userId ?? null })
    }

    sendJson(result.created ? 201 : 200, { data: result.project, meta: { created: result.created } })
  } catch (err) {
    if (err?.code === 'CONTRACT_NOT_FOUND') {
      sendError(sendJson, 404, 'CONTRACT_NOT_FOUND', err.message)
      return
    }
    if (err?.code === 'INVALID_PLAN' || err?.validationErrors) {
      sendJson(422, {
        error: {
          code: 'INVALID_PLAN',
          message: err.message,
          details: err.validationErrors ?? null,
        },
      })
      return
    }
    logError('from-plan', err, { planId })
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao criar projeto a partir do plano.')
  }
}


