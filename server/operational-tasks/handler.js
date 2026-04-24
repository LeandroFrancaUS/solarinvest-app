// server/operational-tasks/handler.js
// Handles /api/operational-tasks routes for operational dashboard task management.
// RBAC: read → admin|office|financeiro; write → admin|office|financeiro.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import {
  listOperationalTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  logActivity,
  getActivityHistory,
  getNotificationPreferences,
  upsertNotificationPreferences,
} from './repository.js'

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function requireReadAccess(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  const role = actorRole(actor)
  if (!['role_admin', 'role_office', 'role_financeiro'].includes(role)) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso ao dashboard operacional não permitido.')
    return false
  }
  return true
}

function requireWriteAccess(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  const role = actorRole(actor)
  if (!['role_admin', 'role_office', 'role_financeiro'].includes(role)) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Operação de escrita no dashboard requer perfil adequado.')
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
  const role = actorRole(actor)
  return createUserScopedSql(db.sql, { userId: actor.userId, role })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/operational-tasks
// List operational tasks with optional filters
// ─────────────────────────────────────────────────────────────────────────────
export async function handleOperationalTasksListRequest(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const url = new URL(requestUrl, 'http://localhost')
  const filters = {
    clientId: url.searchParams.get('client_id') ? parseInt(url.searchParams.get('client_id'), 10) : undefined,
    type: url.searchParams.get('type') || undefined,
    status: url.searchParams.get('status') || undefined,
    priority: url.searchParams.get('priority') || undefined,
    responsibleUserId: url.searchParams.get('responsible_user_id') || undefined,
    scheduledBefore: url.searchParams.get('scheduled_before') || undefined,
    scheduledAfter: url.searchParams.get('scheduled_after') || undefined,
    limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit'), 10) : 1000,
  }

  try {
    const sql = await getScopedSql(actor)
    const tasks = await listOperationalTasks(sql, filters)
    sendJson(200, { data: tasks })
  } catch (err) {
    console.error('[operational-tasks][list] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao listar tarefas.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/operational-tasks
// Create a new operational task
// ─────────────────────────────────────────────────────────────────────────────
export async function handleOperationalTasksCreateRequest(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'POST') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const { type, title, priority, client_id, client_name, proposal_id, project_id, status, scheduled_for, responsible_user_id, notes, metadata } = body || {}

  if (!type || !title) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'Tipo e título são obrigatórios.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const task = await createTask(sql, body, actor.userId)

    // Log activity
    await logActivity(sql, {
      entity_type: 'task',
      entity_id: String(task.id),
      action: 'created',
      performed_by: actor.userId,
      performed_by_name: actor.userName,
      metadata: { type, title, priority, status },
    })

    sendJson(201, { data: task })
  } catch (err) {
    console.error('[operational-tasks][create] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao criar tarefa.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/operational-tasks/:taskId
// Update an operational task
// ─────────────────────────────────────────────────────────────────────────────
export async function handleOperationalTasksUpdateRequest(req, res, { method, taskId, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  if (!taskId || !Number.isFinite(taskId) || taskId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'ID de tarefa inválido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const task = await updateTask(sql, taskId, body || {}, actor.userId)
    if (!task) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada.' } })
      return
    }

    // Log activity
    const action = body.status ? 'status_changed' : 'updated'
    await logActivity(sql, {
      entity_type: 'task',
      entity_id: String(task.id),
      action,
      performed_by: actor.userId,
      performed_by_name: actor.userName,
      metadata: body,
    })

    sendJson(200, { data: task })
  } catch (err) {
    console.error('[operational-tasks][update] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar tarefa.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/operational-tasks/:taskId
// Delete a task
// ─────────────────────────────────────────────────────────────────────────────
export async function handleOperationalTasksDeleteRequest(req, res, { method, taskId, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'DELETE') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  if (!taskId || !Number.isFinite(taskId) || taskId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'ID de tarefa inválido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const deleted = await deleteTask(sql, taskId)
    if (!deleted) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada.' } })
      return
    }

    // Log activity
    await logActivity(sql, {
      entity_type: 'task',
      entity_id: String(taskId),
      action: 'deleted',
      performed_by: actor.userId,
      performed_by_name: actor.userName,
    })

    sendJson(200, { data: { success: true } })
  } catch (err) {
    console.error('[operational-tasks][delete] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao deletar tarefa.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/operational-tasks/:taskId/history
// Get activity history for a task
// ─────────────────────────────────────────────────────────────────────────────
export async function handleTaskHistoryRequest(req, res, { method, taskId, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  if (!taskId || !Number.isFinite(taskId) || taskId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'ID de tarefa inválido.' } })
    return
  }

  const url = new URL(requestUrl, 'http://localhost')
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit'), 10) : 50

  try {
    const sql = await getScopedSql(actor)
    const history = await getActivityHistory(sql, 'task', String(taskId), limit)
    sendJson(200, { data: history })
  } catch (err) {
    console.error('[operational-tasks][history] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao buscar histórico.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/notification-preferences
// Get notification preferences for current user
// ─────────────────────────────────────────────────────────────────────────────
export async function handleNotificationPreferencesGetRequest(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const prefs = await getNotificationPreferences(sql, actor.userId)
    sendJson(200, { data: prefs })
  } catch (err) {
    console.error('[dashboard][notification-prefs][get] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao buscar preferências.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dashboard/notification-preferences
// Update notification preferences for current user
// ─────────────────────────────────────────────────────────────────────────────
export async function handleNotificationPreferencesUpdateRequest(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'POST') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const prefs = await upsertNotificationPreferences(sql, actor.userId, body || {})
    sendJson(200, { data: prefs })
  } catch (err) {
    console.error('[dashboard][notification-prefs][update] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar preferências.' } })
  }
}
