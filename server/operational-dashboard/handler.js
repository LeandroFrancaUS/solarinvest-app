// server/operational-dashboard/handler.js
// Handles /api/operational-dashboard routes.
// RBAC: read → admin|office|financeiro; write → admin|office|financeiro.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import {
  listOperationalTasks,
  getOperationalTaskById,
  createOperationalTask,
  updateOperationalTask,
  deleteOperationalTask,
  getOperationalKpiSummary,
} from './repository.js'

const READ_ROLES = ['role_admin', 'role_office', 'role_financeiro']
const WRITE_ROLES = ['role_admin', 'role_office', 'role_financeiro']

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function requireAccess(actor, sendJson, roles) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  const role = actorRole(actor)
  if (!roles.includes(role)) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Sem permissão para este recurso.')
    return false
  }
  return true
}

async function getScopedSql(actor) {
  const db = getDatabaseClient()
  const role = actorRole(actor)
  return createUserScopedSql(db.sql, { userId: actor.userId, role })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/operational-dashboard/kpi
// ─────────────────────────────────────────────────────────────────────────────
export async function handleOpDashboardKpi(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson, READ_ROLES)) return

  if (method !== 'GET') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const summary = await getOperationalKpiSummary(sql)
    sendJson(200, { data: summary })
  } catch (err) {
    console.error('[op-dashboard][kpi] error', err)
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao buscar KPIs.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/operational-dashboard/tasks
// ─────────────────────────────────────────────────────────────────────────────
export async function handleOpDashboardTasksList(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson, READ_ROLES)) return

  if (method !== 'GET') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  const url = new URL(requestUrl, 'http://localhost')
  const filters = {
    status: url.searchParams.get('status') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    priority: url.searchParams.get('priority') ?? undefined,
    clientId: url.searchParams.get('clientId') ?? undefined,
  }

  try {
    const sql = await getScopedSql(actor)
    const tasks = await listOperationalTasks(sql, filters)
    sendJson(200, { data: tasks })
  } catch (err) {
    console.error('[op-dashboard][tasks:list] error', err)
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao listar tarefas.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/operational-dashboard/tasks
// ─────────────────────────────────────────────────────────────────────────────
export async function handleOpDashboardTasksCreate(req, res, { method, sendJson, readJsonBody }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson, WRITE_ROLES)) return

  if (method !== 'POST') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendError(sendJson, 400, 'INVALID_BODY', 'Corpo da requisição inválido.')
    return
  }

  if (!body.type || !body.title) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'Campos obrigatórios: type, title.')
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const task = await createOperationalTask(sql, body)
    sendJson(201, { data: task })
  } catch (err) {
    console.error('[op-dashboard][tasks:create] error', err)
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao criar tarefa.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET|PATCH|DELETE /api/operational-dashboard/tasks/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function handleOpDashboardTaskById(req, res, { method, taskId, sendJson, readJsonBody }) {
  const actor = await resolveActor(req)

  if (method === 'GET') {
    if (!requireAccess(actor, sendJson, READ_ROLES)) return
    try {
      const sql = await getScopedSql(actor)
      const task = await getOperationalTaskById(sql, taskId)
      if (!task) { sendError(sendJson, 404, 'NOT_FOUND', 'Tarefa não encontrada.'); return }
      sendJson(200, { data: task })
    } catch (err) {
      console.error('[op-dashboard][tasks:get] error', err)
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao buscar tarefa.')
    }
    return
  }

  if (method === 'PATCH') {
    if (!requireAccess(actor, sendJson, WRITE_ROLES)) return
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      sendError(sendJson, 400, 'INVALID_BODY', 'Corpo da requisição inválido.')
      return
    }
    try {
      const sql = await getScopedSql(actor)
      const task = await updateOperationalTask(sql, taskId, body)
      if (!task) { sendError(sendJson, 404, 'NOT_FOUND', 'Tarefa não encontrada.'); return }
      sendJson(200, { data: task })
    } catch (err) {
      console.error('[op-dashboard][tasks:update] error', err)
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao atualizar tarefa.')
    }
    return
  }

  if (method === 'DELETE') {
    if (!requireAccess(actor, sendJson, WRITE_ROLES)) return
    try {
      const sql = await getScopedSql(actor)
      const deleted = await deleteOperationalTask(sql, taskId)
      if (!deleted) { sendError(sendJson, 404, 'NOT_FOUND', 'Tarefa não encontrada.'); return }
      sendJson(200, { data: { success: true } })
    } catch (err) {
      console.error('[op-dashboard][tasks:delete] error', err)
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao excluir tarefa.')
    }
    return
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
}
