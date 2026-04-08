// server/proposals/handler.js
// HTTP route handlers for the proposals API.

import { getDatabaseClient } from '../database/neonClient.js'
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
  requireProposalAuth,
  canReadProposal,
  canWriteProposals,
  canModifyProposal,
  canDeleteProposal,
} from './permissions.js'

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

  // ── GET /api/proposals ──────────────────────────────────────────────────────
  if (method === 'GET') {
    const page = parseInt(requestUrl.searchParams.get('page') || '1', 10)
    const limit = parseInt(requestUrl.searchParams.get('limit') || '20', 10)
    const proposal_type = requestUrl.searchParams.get('proposal_type') || null
    const status = requestUrl.searchParams.get('status') || null

    // Comercial users only see their own proposals; admins, office and financeiro see all
    const ownerUserId = (actor.isAdmin || actor.isOffice || actor.isFinanceiro) ? null : actor.userId

    try {
      const result = await listProposals(db.sql, {
        ownerUserId,
        page,
        limit,
        proposal_type,
        status,
      })
      sendJson(200, result)
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

    const validation = validateCreateProposal(body)
    if (!validation.valid) {
      sendError(sendJson, 422, 'VALIDATION_ERROR', validation.error)
      return
    }

    try {
      const proposal = await createProposal(db.sql, actor.userId, {
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

      sendJson(201, { data: proposal })
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

  // Fetch the proposal first (needed for permission checks on all methods)
  let proposal
  try {
    proposal = await getProposalById(db.sql, proposalId)
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
    sendJson(200, { data: proposal })
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

    const validation = validateUpdateProposal(body)
    if (!validation.valid) {
      sendError(sendJson, 422, 'VALIDATION_ERROR', validation.error)
      return
    }

    try {
      const updated = await updateProposal(db.sql, proposalId, {
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

      sendJson(200, { data: updated })
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
      const deleted = await softDeleteProposal(db.sql, proposalId, actor.userId)

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

      sendNoContent(res)
    } catch (err) {
      console.error('[proposals] softDeleteProposal error:', err)
      sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to delete proposal')
    }
    return
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}
