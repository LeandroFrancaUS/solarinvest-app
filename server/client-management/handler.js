// server/client-management/handler.js
// Route handlers for /api/client-management/* and /api/dashboard/portfolio/*
// RBAC: only role_admin, role_office, role_financeiro are allowed.
// role_comercial and unauthenticated users are rejected.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { ensureClientManagementSchema } from './schema.js'
import {
  listManagedClients,
  getClientManagementDetail,
  upsertLifecycle,
  createContract,
  updateContract,
  listContracts,
  upsertProjectStatus,
  upsertBillingProfile,
  listInstallments,
  updateInstallment,
  listNotes,
  createNote,
  listReminders,
  createReminder,
  updateReminder,
  getPortfolioSummary,
  getPortfolioUpcomingBillings,
  getPortfolioStatusBreakdown,
  getPortfolioAlerts,
} from './repository.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(sendJson, status, code, message) {
  sendJson(status, { error: { code, message } })
}

async function getDb(sendJson) {
  const db = getDatabaseClient()
  if (!db) {
    sendJson(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' } })
    return null
  }
  // Idempotent: creates client-management tables if migrations have not been
  // applied yet.  After the first successful run it is a synchronous no-op.
  await ensureClientManagementSchema()
  return db
}

function sqlForActor(db, actor) {
  return createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
}

/**
 * Require admin, office, or financeiro.
 * Comercial is explicitly denied — this page is post-conversion operational only.
 */
function requireClientManagementAuth(actor) {
  if (!actor?.userId) {
    const err = new Error('Login required')
    err.statusCode = 401
    throw err
  }
  if (!actor.isAdmin && !actor.isOffice && !actor.isFinanceiro) {
    const err = new Error('Access forbidden: Gestão de Clientes requires admin, office or financeiro role')
    err.statusCode = 403
    throw err
  }
}

function handleAuthError(sendJson, err) {
  if (err?.statusCode === 401) return sendError(sendJson, 401, 'UNAUTHENTICATED', err.message)
  if (err?.statusCode === 403) return sendError(sendJson, 403, 'FORBIDDEN', err.message)
  return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Unexpected authentication error')
}

function parseIntParam(val, fallback) {
  const n = parseInt(val, 10)
  return Number.isFinite(n) ? n : fallback
}

// ─── GET /api/client-management ──────────────────────────────────────────────

export async function handleListManagedClients(req, res, ctx) {
  const { sendJson: rawSendJson, requestUrl } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  const q = requestUrl.searchParams
  try {
    const userSql = sqlForActor(db, actor)
    const result = await listManagedClients(userSql, {
      search: q.get('search') ?? undefined,
      lifecycleStatus: q.get('lifecycle_status') ?? undefined,
      contractStatus: q.get('contract_status') ?? undefined,
      modalidade: q.get('modalidade') ?? undefined,
      page: parseIntParam(q.get('page'), 1),
      limit: parseIntParam(q.get('limit'), 30),
    })
    return sendJson(200, result)
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[client-management][list] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to list managed clients')
  }
}

// ─── GET /api/client-management/:clientId ────────────────────────────────────

export async function handleGetClientDetail(req, res, ctx) {
  const { clientId, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  try {
    const userSql = sqlForActor(db, actor)
    const detail = await getClientManagementDetail(userSql, clientId)
    if (!detail) return sendError(sendJson, 404, 'NOT_FOUND', 'Client not found')
    return sendJson(200, { data: detail })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[client-management][detail] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to get client detail')
  }
}

// ─── PATCH /api/client-management/:clientId/lifecycle ────────────────────────

export async function handlePatchLifecycle(req, res, ctx) {
  const { clientId, readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
    if (actor.isFinanceiro && !actor.isAdmin) return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role for lifecycle writes')
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  let body
  try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }

  try {
    const userSql = sqlForActor(db, actor)
    const result = await upsertLifecycle(userSql, clientId, body)
    return sendJson(200, { data: result })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[client-management][lifecycle] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update lifecycle')
  }
}

// ─── GET /api/client-management/:clientId/contracts ──────────────────────────
// ─── POST /api/client-management/:clientId/contracts ─────────────────────────

export async function handleContractsRequest(req, res, ctx) {
  const { method, clientId, readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  if (method === 'GET') {
    try {
      const userSql = sqlForActor(db, actor)
      const contracts = await listContracts(userSql, clientId)
      return sendJson(200, { data: contracts })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][contracts] GET error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to list contracts')
    }
  }

  if (method === 'POST') {
    if (actor.isFinanceiro && !actor.isAdmin) return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
    let body
    try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }

    try {
      const userSql = sqlForActor(db, actor)
      const contract = await createContract(userSql, clientId, body)
      return sendJson(201, { data: contract })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][contracts] POST error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to create contract')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}

// ─── PATCH /api/client-management/:clientId/contracts/:contractId ─────────────

export async function handlePatchContract(req, res, ctx) {
  const { clientId, contractId, readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
    if (actor.isFinanceiro && !actor.isAdmin) return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  let body
  try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }

  try {
    const userSql = sqlForActor(db, actor)
    const updated = await updateContract(userSql, contractId, clientId, body)
    if (!updated) return sendError(sendJson, 404, 'NOT_FOUND', 'Contract not found')
    return sendJson(200, { data: updated })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[client-management][contracts] PATCH error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update contract')
  }
}

// ─── PATCH /api/client-management/:clientId/project ──────────────────────────

export async function handlePatchProject(req, res, ctx) {
  const { clientId, readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
    if (actor.isFinanceiro && !actor.isAdmin) return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  let body
  try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }

  try {
    const userSql = sqlForActor(db, actor)
    const result = await upsertProjectStatus(userSql, clientId, body)
    return sendJson(200, { data: result })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[client-management][project] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update project status')
  }
}

// ─── PATCH /api/client-management/:clientId/billing ──────────────────────────

export async function handlePatchBilling(req, res, ctx) {
  const { clientId, readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  let body
  try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }

  try {
    const userSql = sqlForActor(db, actor)
    const result = await upsertBillingProfile(userSql, clientId, body)
    return sendJson(200, { data: result })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[client-management][billing] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update billing profile')
  }
}

// ─── GET/PATCH /api/client-management/:clientId/installments ─────────────────

export async function handleInstallmentsRequest(req, res, ctx) {
  const { method, clientId, installmentId, readJsonBody, sendJson: rawSendJson, requestUrl } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  if (method === 'GET') {
    const q = requestUrl.searchParams
    try {
      const userSql = sqlForActor(db, actor)
      const installments = await listInstallments(userSql, clientId, {
        status: q.get('status') ?? undefined,
        limit: parseIntParam(q.get('limit'), 60),
        offset: parseIntParam(q.get('offset'), 0),
      })
      return sendJson(200, { data: installments })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][installments] GET error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to list installments')
    }
  }

  if (method === 'PATCH' && installmentId) {
    let body
    try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }
    try {
      const userSql = sqlForActor(db, actor)
      const result = await updateInstallment(userSql, installmentId, clientId, body)
      if (!result) return sendError(sendJson, 404, 'NOT_FOUND', 'Installment not found')
      return sendJson(200, { data: result })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][installments] PATCH error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update installment')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}

// ─── GET/POST /api/client-management/:clientId/notes ─────────────────────────

export async function handleNotesRequest(req, res, ctx) {
  const { method, clientId, readJsonBody, sendJson: rawSendJson, requestUrl } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  if (method === 'GET') {
    const q = requestUrl.searchParams
    try {
      const userSql = sqlForActor(db, actor)
      const notes = await listNotes(userSql, clientId, {
        limit: parseIntParam(q.get('limit'), 50),
        offset: parseIntParam(q.get('offset'), 0),
      })
      return sendJson(200, { data: notes })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][notes] GET error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to list notes')
    }
  }

  if (method === 'POST') {
    let body
    try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }
    if (!body?.content) return sendError(sendJson, 422, 'VALIDATION_ERROR', 'content is required')

    try {
      const userSql = sqlForActor(db, actor)
      const note = await createNote(userSql, clientId, {
        ...body,
        created_by_user_id: actor.userId,
      })
      return sendJson(201, { data: note })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][notes] POST error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to create note')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}

// ─── GET/POST /api/client-management/:clientId/reminders ─────────────────────
// ─── PATCH /api/client-management/:clientId/reminders/:reminderId ────────────

export async function handleRemindersRequest(req, res, ctx) {
  const { method, clientId, reminderId, readJsonBody, sendJson: rawSendJson, requestUrl } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  if (method === 'GET') {
    const q = requestUrl.searchParams
    try {
      const userSql = sqlForActor(db, actor)
      const reminders = await listReminders(userSql, clientId, {
        status: q.get('status') ?? undefined,
      })
      return sendJson(200, { data: reminders })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][reminders] GET error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to list reminders')
    }
  }

  if (method === 'POST') {
    let body
    try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }
    if (!body?.title) return sendError(sendJson, 422, 'VALIDATION_ERROR', 'title is required')
    if (!body?.due_at) return sendError(sendJson, 422, 'VALIDATION_ERROR', 'due_at is required')

    try {
      const userSql = sqlForActor(db, actor)
      const reminder = await createReminder(userSql, clientId, {
        ...body,
        assigned_to_user_id: body.assigned_to_user_id ?? actor.userId,
      })
      return sendJson(201, { data: reminder })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][reminders] POST error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to create reminder')
    }
  }

  if (method === 'PATCH' && reminderId) {
    let body
    try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }
    try {
      const userSql = sqlForActor(db, actor)
      const result = await updateReminder(userSql, reminderId, clientId, body)
      if (!result) return sendError(sendJson, 404, 'NOT_FOUND', 'Reminder not found')
      return sendJson(200, { data: result })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
      console.error('[client-management][reminders] PATCH error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update reminder')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}

// ─── Dashboard portfolio endpoints ────────────────────────────────────────────

export async function handlePortfolioSummary(req, res, ctx) {
  const { sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  try {
    const userSql = sqlForActor(db, actor)
    const summary = await getPortfolioSummary(userSql)
    return sendJson(200, { data: summary })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[dashboard/portfolio][summary] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to get portfolio summary')
  }
}

export async function handlePortfolioUpcomingBillings(req, res, ctx) {
  const { sendJson: rawSendJson, requestUrl } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  try {
    const q = requestUrl.searchParams
    const userSql = sqlForActor(db, actor)
    const billings = await getPortfolioUpcomingBillings(userSql, {
      days: parseIntParam(q.get('days'), 30),
    })
    return sendJson(200, { data: billings })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[dashboard/portfolio][upcoming-billings] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to get upcoming billings')
  }
}

export async function handlePortfolioStatusBreakdown(req, res, ctx) {
  const { sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  try {
    const userSql = sqlForActor(db, actor)
    const breakdown = await getPortfolioStatusBreakdown(userSql)
    return sendJson(200, { data: breakdown })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[dashboard/portfolio][status-breakdown] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to get status breakdown')
  }
}

export async function handlePortfolioAlerts(req, res, ctx) {
  const { sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = await getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientManagementAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  try {
    const userSql = sqlForActor(db, actor)
    const alerts = await getPortfolioAlerts(userSql)
    return sendJson(200, { data: alerts })
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) return handleAuthError(sendJson, err)
    console.error('[dashboard/portfolio][alerts] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to get portfolio alerts')
  }
}
