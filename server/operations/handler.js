// server/operations/handler.js
// Handles /api/operations/* routes for the post-contract Operação domain.
//
// RBAC:
//   read  → role_admin | role_office (DIRETORIA) | role_operacao | role_suporte
//   write → role_admin | role_office (DIRETORIA) | role_operacao
//
// Permission checks now use the central permissionMap for consistency.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { hasPermission } from '../auth/permissionMap.js'
import {
  listServiceTickets,
  createServiceTicket,
  updateServiceTicket,
  listMaintenanceJobs,
  createMaintenanceJob,
  updateMaintenanceJob,
  listCleaningJobs,
  createCleaningJob,
  updateCleaningJob,
  listInsurancePolicies,
  createInsurancePolicy,
  updateInsurancePolicy,
  listOperationEvents,
  createOperationEvent,
  updateOperationEvent,
} from './repository.js'
import {
  isTicketPriority,
  isTicketStatus,
  isMaintenanceType,
  isMaintenanceStatus,
  isCleaningStatus,
  isInsuranceStatus,
  isOperationEventStatus,
  isOperationEventSourceType,
} from './operation-status-values.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

/** Read access: admin, DIRETORIA (office), operacao, suporte — via permissionMap. */
function requireReadAccess(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  if (!hasPermission(actor, 'operacao:read')) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso à operação não permitido para este perfil.')
    return false
  }
  return true
}

/** Write access: admin, DIRETORIA (office), operacao — via permissionMap. */
function requireWriteAccess(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  if (!hasPermission(actor, 'operacao:write')) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Escrita na operação requer perfil admin, office ou operacao.')
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

function parseClientId(raw) {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseFilters(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost')
  const client_id  = parseClientId(url.searchParams.get('client_id'))
  const project_id = url.searchParams.get('project_id') || null
  const status     = url.searchParams.get('status')     || null
  return { client_id, project_id, status }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tickets
// ─────────────────────────────────────────────────────────────────────────────

export async function handleTicketsList(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return
  if (method !== 'GET') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  try {
    const sql = await getScopedSql(actor)
    const filters = parseFilters(requestUrl)
    const data = await listServiceTickets(sql, filters)
    sendJson(200, { data })
  } catch (err) {
    console.error('[operations][tickets][list]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao listar chamados.' } })
  }
}

export async function handleTicketsCreate(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'POST') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  const clientId = parseClientId(body?.client_id)
  if (!clientId) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'client_id é obrigatório e deve ser um número válido.')
    return
  }

  if (body?.priority != null && !isTicketPriority(body.priority)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `priority inválida: "${body.priority}".`)
    return
  }

  if (body?.status != null && !isTicketStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  if (!body?.title || typeof body.title !== 'string' || !body.title.trim()) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'title é obrigatório.')
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await createServiceTicket(sql, { ...body, client_id: clientId })
    sendJson(201, { data: row })
  } catch (err) {
    console.error('[operations][tickets][create]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao criar chamado.' } })
  }
}

export async function handleTicketsPatch(req, res, { method, sendJson, body, id }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  if (body?.priority != null && !isTicketPriority(body.priority)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `priority inválida: "${body.priority}".`)
    return
  }

  if (body?.status != null && !isTicketStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await updateServiceTicket(sql, id, body ?? {})
    if (!row) { sendJson(404, { error: { code: 'NOT_FOUND', message: 'Chamado não encontrado.' } }); return }
    sendJson(200, { data: row })
  } catch (err) {
    console.error('[operations][tickets][patch]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar chamado.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance Jobs
// ─────────────────────────────────────────────────────────────────────────────

export async function handleMaintenanceList(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return
  if (method !== 'GET') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  try {
    const sql = await getScopedSql(actor)
    const filters = parseFilters(requestUrl)
    const data = await listMaintenanceJobs(sql, filters)
    sendJson(200, { data })
  } catch (err) {
    console.error('[operations][maintenance][list]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao listar manutenções.' } })
  }
}

export async function handleMaintenanceCreate(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'POST') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  const clientId = parseClientId(body?.client_id)
  if (!clientId) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'client_id é obrigatório e deve ser um número válido.')
    return
  }

  if (body?.maintenance_type != null && !isMaintenanceType(body.maintenance_type)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `maintenance_type inválido: "${body.maintenance_type}".`)
    return
  }

  if (body?.status != null && !isMaintenanceStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await createMaintenanceJob(sql, { ...body, client_id: clientId })
    sendJson(201, { data: row })
  } catch (err) {
    console.error('[operations][maintenance][create]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao criar manutenção.' } })
  }
}

export async function handleMaintenancePatch(req, res, { method, sendJson, body, id }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  if (body?.maintenance_type != null && !isMaintenanceType(body.maintenance_type)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `maintenance_type inválido: "${body.maintenance_type}".`)
    return
  }

  if (body?.status != null && !isMaintenanceStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await updateMaintenanceJob(sql, id, body ?? {})
    if (!row) { sendJson(404, { error: { code: 'NOT_FOUND', message: 'Manutenção não encontrada.' } }); return }
    sendJson(200, { data: row })
  } catch (err) {
    console.error('[operations][maintenance][patch]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar manutenção.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleaning Jobs
// ─────────────────────────────────────────────────────────────────────────────

export async function handleCleaningsList(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return
  if (method !== 'GET') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  try {
    const sql = await getScopedSql(actor)
    const filters = parseFilters(requestUrl)
    const data = await listCleaningJobs(sql, filters)
    sendJson(200, { data })
  } catch (err) {
    console.error('[operations][cleanings][list]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao listar limpezas.' } })
  }
}

export async function handleCleaningsCreate(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'POST') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  const clientId = parseClientId(body?.client_id)
  if (!clientId) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'client_id é obrigatório e deve ser um número válido.')
    return
  }

  if (body?.status != null && !isCleaningStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await createCleaningJob(sql, { ...body, client_id: clientId })
    sendJson(201, { data: row })
  } catch (err) {
    console.error('[operations][cleanings][create]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao criar limpeza.' } })
  }
}

export async function handleCleaningsPatch(req, res, { method, sendJson, body, id }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  if (body?.status != null && !isCleaningStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await updateCleaningJob(sql, id, body ?? {})
    if (!row) { sendJson(404, { error: { code: 'NOT_FOUND', message: 'Limpeza não encontrada.' } }); return }
    sendJson(200, { data: row })
  } catch (err) {
    console.error('[operations][cleanings][patch]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar limpeza.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Insurance Policies
// ─────────────────────────────────────────────────────────────────────────────

export async function handleInsuranceList(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return
  if (method !== 'GET') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  try {
    const sql = await getScopedSql(actor)
    const filters = parseFilters(requestUrl)
    const data = await listInsurancePolicies(sql, filters)
    sendJson(200, { data })
  } catch (err) {
    console.error('[operations][insurance][list]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao listar seguros.' } })
  }
}

export async function handleInsuranceCreate(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'POST') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  const clientId = parseClientId(body?.client_id)
  if (!clientId) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'client_id é obrigatório e deve ser um número válido.')
    return
  }

  if (body?.status != null && !isInsuranceStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await createInsurancePolicy(sql, { ...body, client_id: clientId })
    sendJson(201, { data: row })
  } catch (err) {
    console.error('[operations][insurance][create]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao criar seguro.' } })
  }
}

export async function handleInsurancePatch(req, res, { method, sendJson, body, id }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  if (body?.status != null && !isInsuranceStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await updateInsurancePolicy(sql, id, body ?? {})
    if (!row) { sendJson(404, { error: { code: 'NOT_FOUND', message: 'Seguro não encontrado.' } }); return }
    sendJson(200, { data: row })
  } catch (err) {
    console.error('[operations][insurance][patch]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar seguro.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation Events (Agenda)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleEventsList(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return
  if (method !== 'GET') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  try {
    const sql = await getScopedSql(actor)
    const filters = parseFilters(requestUrl)
    const data = await listOperationEvents(sql, filters)
    sendJson(200, { data })
  } catch (err) {
    console.error('[operations][events][list]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao listar eventos.' } })
  }
}

export async function handleEventsCreate(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'POST') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  if (!body?.title || typeof body.title !== 'string' || !body.title.trim()) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'title é obrigatório.')
    return
  }

  if (!body?.starts_at) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'starts_at é obrigatório.')
    return
  }

  if (body?.source_type != null && !isOperationEventSourceType(body.source_type)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `source_type inválido: "${body.source_type}".`)
    return
  }

  if (body?.status != null && !isOperationEventStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await createOperationEvent(sql, body)
    sendJson(201, { data: row })
  } catch (err) {
    console.error('[operations][events][create]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao criar evento.' } })
  }
}

export async function handleEventsPatch(req, res, { method, sendJson, body, id }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }

  if (body?.source_type != null && !isOperationEventSourceType(body.source_type)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `source_type inválido: "${body.source_type}".`)
    return
  }

  if (body?.status != null && !isOperationEventStatus(body.status)) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', `status inválido: "${body.status}".`)
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const row = await updateOperationEvent(sql, id, body ?? {})
    if (!row) { sendJson(404, { error: { code: 'NOT_FOUND', message: 'Evento não encontrado.' } }); return }
    sendJson(200, { data: row })
  } catch (err) {
    console.error('[operations][events][patch]', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar evento.' } })
  }
}
