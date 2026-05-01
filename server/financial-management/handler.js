// server/financial-management/handler.js
// Handles /api/financial-management/* routes.
// RBAC: read → ADMIN | DIRETORIA (indicadores:read).

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { hasPermission } from '../auth/permissionMap.js'
import {
  listFinancialCategories,
  createFinancialCategory,
  listFinancialEntries,
  getFinancialEntryById,
  createFinancialEntry,
  updateFinancialEntry,
  deleteFinancialEntry,
  getFinancialSummary,
  listFinancialProjects,
  getFinancialCashflow,
} from './repository.js'

// ─────────────────────────────────────────────────────────────────────────────
// Access helpers
// ─────────────────────────────────────────────────────────────────────────────

function requireAccess(actor, sendJson) {
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária.' } })
    return false
  }

  if (!hasPermission(actor, 'indicadores:read')) {
    // Legacy fallback: page_financial_management stack permission
    const perms = actor.permissions ?? []
    if (perms.includes('page_financial_management') || perms.includes('page:financial_management')) {
      return true
    }
    sendJson(403, {
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso à Gestão Financeira requer permissão de admin, diretoria ou page_financial_management.',
      },
    })
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

function getUserId(actor) {
  return actor?.userId ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/summary
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialSummary(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const data = await getFinancialSummary(sql, { from, to })
  sendJson(200, { data })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/projects
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialProjects(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const data = await listFinancialProjects(sql, { from, to })
  sendJson(200, { data })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/cashflow
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialCashflow(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const data = await getFinancialCashflow(sql, { from, to })
  sendJson(200, { data })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/financial-management/entries
// GET/PUT/DELETE /api/financial-management/entries/:id
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialEntries(req, res, { method, sendJson, requestUrl, body }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const pathParts = url.pathname.replace('/api/financial-management/entries', '').split('/').filter(Boolean)
  const entryId = pathParts[0] ?? null

  // ── List entries ──────────────────────────────────────────────────────────
  if (method === 'GET' && !entryId) {
    const from = url.searchParams.get('from') ?? undefined
    const to = url.searchParams.get('to') ?? undefined
    const data = await listFinancialEntries(sql, { from, to })
    sendJson(200, { data })
    return
  }

  // ── Get single entry ──────────────────────────────────────────────────────
  if (method === 'GET' && entryId) {
    const row = await getFinancialEntryById(sql, entryId)
    if (!row) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Lançamento não encontrado.' } })
      return
    }
    sendJson(200, { data: row })
    return
  }

  // ── Create entry ──────────────────────────────────────────────────────────
  if (method === 'POST' && !entryId) {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    if (!body.entry_type || !['income', 'expense'].includes(body.entry_type)) {
      sendJson(400, { error: { code: 'INVALID_ENTRY_TYPE', message: 'entry_type deve ser "income" ou "expense".' } })
      return
    }
    if (body.amount == null || isNaN(parseFloat(String(body.amount)))) {
      sendJson(400, { error: { code: 'INVALID_AMOUNT', message: 'amount deve ser um número válido.' } })
      return
    }
    const data = await createFinancialEntry(sql, body, getUserId(actor))
    sendJson(201, { data })
    return
  }

  // ── Update entry ──────────────────────────────────────────────────────────
  if (method === 'PUT' && entryId) {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    const updated = await updateFinancialEntry(sql, entryId, body, getUserId(actor))
    if (!updated) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Lançamento não encontrado.' } })
      return
    }
    sendJson(200, { data: updated })
    return
  }

  // ── Delete entry ──────────────────────────────────────────────────────────
  if (method === 'DELETE' && entryId) {
    const deleted = await deleteFinancialEntry(sql, entryId, getUserId(actor))
    if (!deleted) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Lançamento não encontrado.' } })
      return
    }
    sendJson(204, null)
    return
  }

  sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/categories
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialCategories(req, res, { method, sendJson, readJsonBody }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  const sql = await getScopedSql(actor)

  if (method === 'GET') {
    const data = await listFinancialCategories(sql)
    sendJson(200, { data })
    return
  }

  if (method === 'POST') {
    let body = {}
    if (typeof readJsonBody === 'function') {
      try {
        body = await readJsonBody(req)
      } catch (parseErr) {
        console.warn('[financial][categories] JSON parse error:', parseErr?.message)
        sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
        return
      }
    }
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const type = typeof body?.type === 'string' ? body.type.trim() : ''
    if (!name || !type) {
      sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'Campos name e type são obrigatórios.' } })
      return
    }
    const VALID_TYPES = ['income', 'expense', 'both']
    const VALID_SCOPES = ['company', 'project', 'both']
    if (!VALID_TYPES.includes(type)) {
      sendJson(400, { error: { code: 'VALIDATION_ERROR', message: `type deve ser um de: ${VALID_TYPES.join(', ')}.` } })
      return
    }
    const scope = VALID_SCOPES.includes(body?.scope) ? body.scope : 'both'
    const sort_order = typeof body?.sort_order === 'number' ? body.sort_order : 0
    const category = await createFinancialCategory(sql, { name, type, scope, sort_order })
    sendJson(201, { data: category })
    return
  }

  sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/dashboard-feed
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialDashboardFeed(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const data = await getFinancialSummary(sql, { from, to })
  sendJson(200, { data })
}
