// server/revenue-billing/handler.js
// Handles GET /api/revenue-billing/clients.
// RBAC: requires page_financial_management permission or role_admin.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { listRevenueClients } from './repository.js'

// ─────────────────────────────────────────────────────────────────────────────
// Access helpers
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['role_admin']
const ALLOWED_PERMISSION = 'page_financial_management'

function requireAccess(actor, sendJson) {
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária.' } })
    return false
  }
  if (ALLOWED_ROLES.includes(actorRole(actor))) return true
  const perms = actor.permissions ?? []
  if (perms.includes(ALLOWED_PERMISSION) || perms.includes('page:financial_management')) {
    return true
  }
  sendJson(403, {
    error: {
      code: 'FORBIDDEN',
      message: 'Acesso à Receita e Cobrança requer a permissão page_financial_management.',
    },
  })
  return false
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/revenue-billing/clients
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a deduplicated list of canonical active clients for the
 * Receita e Cobrança → Projetos tab.
 *
 * Query params:
 *   search        — free-text search
 *   contract_type — filter by contract_type value
 *   order_by      — sort column key
 *   order_dir     — 'asc' | 'desc'
 *   limit         — max rows per page
 *   offset        — pagination offset
 */
export async function handleRevenueClients(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const qs = requestUrl.searchParams
  const filters = {
    search:        qs.get('search')        ?? undefined,
    contract_type: qs.get('contract_type') ?? undefined,
    order_by:      qs.get('order_by')      ?? undefined,
    order_dir:     qs.get('order_dir')     ?? undefined,
    limit:         qs.get('limit')         ?? undefined,
    offset:        qs.get('offset')        ?? undefined,
  }

  try {
    const scopedSql = await getScopedSql(actor)
    const result = await listRevenueClients(scopedSql, filters)
    sendJson(200, result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const statusCode = err?.statusCode ?? 500
    console.error('[revenue-billing][clients] error', { message })
    sendJson(statusCode, { error: { code: 'INTERNAL_ERROR', message } })
  }
}
