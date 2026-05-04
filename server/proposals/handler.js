// server/proposals/handler.js
// HTTP route handlers for the proposals API.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { getCanonicalDatabaseDiagnostics } from '../database/connection.js'
import { validateCreateProposal, validateUpdateProposal } from './validators.js'
import {
  createProposal,
  getProposalById,
  listProposals,
  updateProposal,
  softDeleteProposal,
  appendAuditLog,
} from './repository.js'
import {
  resolveActor,
  actorRole,
  requireProposalAuth,
  canReadProposal,
  canWriteProposals,
  canModifyProposal,
  canDeleteProposal,
} from './permissions.js'
import { toCanonicalProposal, toProposalWritePayload } from '../adapters/proposalAdapter.js'

function sendError(sendJson, statusCode, code, message, details = {}) {
  sendJson(statusCode, { error: { code, message, details } })
}

function getDb(sendJson) {
  const db = getDatabaseClient()
  if (!db) {
    sendJson(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' } })
    return null
  }
  return db
}


function logRoute(route, extra = {}) {
  const diagnostics = getCanonicalDatabaseDiagnostics()
  const payload = {
    route,
    dbSource: diagnostics.source,
    dbHost: diagnostics.host,
    dbName: diagnostics.database,
    schema: diagnostics.schema,
    ...extra,
  }
  console.info('[db-route]', payload)
  console.info('[db-runtime]', payload)
}

function sqlForActor(db, actor) {
  // Inject app.current_user_id and app.current_user_role into the PostgreSQL
  // session via a single sql.transaction() batch.  The main DB client prefers
  // DATABASE_URL_UNPOOLED (direct connection) where sql.transaction() works
  // reliably.  All access control is enforced by RLS policies in the DB.
  return createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
}

/**
 * Normalize an incoming proposal request body through the proposal adapter.
 *
 * When payload_json is present the adapter maps legacy client field aliases
 * (name, document, email, phone, city, state) to their canonical equivalents
 * (client_name, client_document, …) and validates payload_json early at the
 * API boundary.  When payload_json is absent (e.g. a PATCH that only updates
 * status) the body is returned unchanged so that no null values are injected
 * into the request and the update validator can accept partial bodies as normal.
 *
 * Returns null and sends a 422 response when the adapter rejects the input.
 *
 * @param {object}   body     - Parsed request body.
 * @param {Function} sendJson - Handler-local sendJson(status, payload).
 * @returns {object|null}
 */
function normalizeIncomingProposal(body, sendJson) {
  if (!('payload_json' in body)) return body

  let adapted
  try {
    adapted = toProposalWritePayload(body)
  } catch (err) {
    sendError(sendJson, 422, err.code ?? 'VALIDATION_ERROR', err.message)
    return null
  }

  // Merge: overlay all non-undefined adapter fields over the original body.
  // This ensures canonical client names (client_name, client_document, …) win
  // over legacy aliases (name, document, …), while other body fields such as
  // client_cep and uc_geradora_nm that the adapter does not cover are preserved
  // intact from the original body.
  const merged = { ...body }
  for (const [key, val] of Object.entries(adapted)) {
    if (val !== undefined) merged[key] = val
  }
  return merged
}

async function resolveAndAuth(req, sendJson) {
  let actor
  try {
    actor = await resolveActor(req)
    requireProposalAuth(actor)
  } catch (err) {
    const status = err.statusCode ?? 500
    if (status === 401) {
      sendError(sendJson, 401, 'UNAUTHENTICATED', err.message)
    } else if (status === 403) {
      sendError(sendJson, 403, 'FORBIDDEN', err.message)
    } else {
      sendError(sendJson, 500, 'INTERNAL_ERROR', 'Unexpected authentication error')
    }
    return null
  }
  return actor
}

/**
 * Handle GET /api/proposals and POST /api/proposals
 */
export async function handleProposalsRequest(req, res, ctx) {
  const { method, readJsonBody, sendJson: rawSendJson, requestUrl } = ctx

  const sendJson = (status, payload) => rawSendJson(res, status, payload)

  const db = getDb(sendJson)
  if (!db) return

  const actor = await resolveAndAuth(req, sendJson)
  if (!actor) return

  // RLS context: set both user ID and role so the DB enforces access control.
  // Security is layered: application checks (canWriteProposals etc.) + RLS.
  const userSql = sqlForActor(db, actor)

  // ── GET /api/proposals ──────────────────────────────────────────────────────
  if (method === 'GET') {
    const page = parseInt(requestUrl.searchParams.get('page') || '1', 10)
    const limit = parseInt(requestUrl.searchParams.get('limit') || '20', 10)
    const proposal_type = requestUrl.searchParams.get('proposal_type') || null
    const status = requestUrl.searchParams.get('status') || null

    try {
      // RLS (via userSql) is the authoritative access gate.
      // No ownerUserId/officeUserId filters needed here — the DB enforces them.
      logRoute('/api/proposals', { method: 'GET', actorUserId: actor.userId })
      const result = await listProposals(userSql, {
        page,
        limit,
        proposal_type,
        status,
      })
      logRoute('/api/proposals', { method: 'GET', actorUserId: actor.userId, success: true, count: result.data.length })
      sendJson(200, { data: result.data.map(toCanonicalProposal), pagination: result.pagination })
    } catch (err) {
      console.error('[proposals] listProposals error:', err)
      sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to list proposals')
    }
    return
  }

  // ── POST /api/proposals ─────────────────────────────────────────────────────
  if (method === 'POST') {
    if (!canWriteProposals(actor)) {
      sendError(sendJson, 403, 'FORBIDDEN', 'You do not have permission to create proposals')
      return
    }

    let body
    try {
      body = await readJsonBody(req)
    } catch (err) {
      sendError(sendJson, 400, 'VALIDATION_ERROR', err.message || 'Invalid request body')
      return
    }

    const normalizedBody = normalizeIncomingProposal(body, sendJson)
    if (normalizedBody === null) return

    const validation = validateCreateProposal(normalizedBody)
    if (!validation.valid) {
      sendError(sendJson, 422, 'VALIDATION_ERROR', validation.error)
      return
    }

    try {
      logRoute('/api/proposals', { method: 'POST', actorUserId: actor.userId })
      const proposal = await createProposal(userSql, actor.userId, {
        ...validation.data,
        created_by_user_id: actor.userId,
        owner_email: actor.email,
        owner_display_name: actor.displayName,
      })

      await appendAuditLog(
        db.sql,
        proposal.id,
        actor.userId,
        actor.email,
        'created',
        null,
        proposal
      )

      logRoute('/api/proposals', { method: 'POST', actorUserId: actor.userId, success: true, proposalId: proposal.id })
      sendJson(201, { data: toCanonicalProposal(proposal) })
    } catch (err) {
      console.error('[proposals] createProposal error:', err)
      sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to create proposal')
    }
    return
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}

/**
 * Handle GET /api/proposals/:id, PATCH /api/proposals/:id, DELETE /api/proposals/:id
 */
export async function handleProposalByIdRequest(req, res, ctx) {
  const { method, proposalId, readJsonBody, sendJson: rawSendJson, sendNoContent } = ctx

  const sendJson = (status, payload) => rawSendJson(res, status, payload)

  if (!proposalId) {
    sendError(sendJson, 400, 'VALIDATION_ERROR', 'Proposal ID is required')
    return
  }

  const db = getDb(sendJson)
  if (!db) return

  const actor = await resolveAndAuth(req, sendJson)
  if (!actor) return

  // RLS context: role-aware, so the DB enforces access per-row.
  const userSql = sqlForActor(db, actor)

  // Fetch the proposal first (needed for permission checks on all methods)
  let proposal
  try {
    logRoute('/api/proposals/:id', { method: method, actorUserId: actor.userId, proposalId })
    proposal = await getProposalById(userSql, proposalId)
  } catch (err) {
    console.error('[proposals] getProposalById error:', err)
    sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to fetch proposal')
    return
  }

  if (!proposal) {
    sendError(sendJson, 404, 'NOT_FOUND', 'Proposal not found')
    return
  }

  // ── GET /api/proposals/:id ──────────────────────────────────────────────────
  if (method === 'GET') {
    if (!canReadProposal(actor, proposal)) {
      sendError(sendJson, 403, 'FORBIDDEN', 'You do not have permission to read this proposal')
      return
    }
    logRoute('/api/proposals/:id', { method: 'GET', actorUserId: actor.userId, proposalId, success: true })
    sendJson(200, { data: toCanonicalProposal(proposal) })
    return
  }

  // ── PATCH /api/proposals/:id ────────────────────────────────────────────────
  if (method === 'PATCH') {
    if (!canModifyProposal(actor, proposal)) {
      sendError(sendJson, 403, 'FORBIDDEN', 'You do not have permission to modify this proposal')
      return
    }

    let body
    try {
      body = await readJsonBody(req)
    } catch (err) {
      sendError(sendJson, 400, 'VALIDATION_ERROR', err.message || 'Invalid request body')
      return
    }

    const normalizedBody = normalizeIncomingProposal(body, sendJson)
    if (normalizedBody === null) return

    const validation = validateUpdateProposal(normalizedBody)
    if (!validation.valid) {
      sendError(sendJson, 422, 'VALIDATION_ERROR', validation.error)
      return
    }

    try {
      const updated = await updateProposal(userSql, proposalId, {
        ...validation.data,
        updated_by_user_id: actor.userId,
      })

      if (!updated) {
        sendError(sendJson, 404, 'NOT_FOUND', 'Proposal not found or already deleted')
        return
      }

      await appendAuditLog(
        db.sql,
        proposalId,
        actor.userId,
        actor.email,
        'updated',
        proposal,
        updated
      )

      logRoute('/api/proposals/:id', { method: 'PATCH', actorUserId: actor.userId, proposalId, success: true })
      sendJson(200, { data: toCanonicalProposal(updated) })
    } catch (err) {
      console.error('[proposals] updateProposal error:', err)
      sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update proposal')
    }
    return
  }

  // ── DELETE /api/proposals/:id ───────────────────────────────────────────────
  if (method === 'DELETE') {
    if (!canDeleteProposal(actor, proposal)) {
      sendError(sendJson, 403, 'FORBIDDEN', 'You do not have permission to delete this proposal')
      return
    }

    try {
      const deleted = await softDeleteProposal(userSql, proposalId, actor.userId)

      if (!deleted) {
        sendError(sendJson, 404, 'NOT_FOUND', 'Proposal not found or already deleted')
        return
      }

      await appendAuditLog(
        db.sql,
        proposalId,
        actor.userId,
        actor.email,
        'deleted',
        proposal,
        null
      )

      logRoute('/api/proposals/:id', { method: 'DELETE', actorUserId: actor.userId, proposalId, success: true })
      sendNoContent(res)
    } catch (err) {
      console.error('[proposals] softDeleteProposal error:', err)
      sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to delete proposal')
    }
    return
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}
