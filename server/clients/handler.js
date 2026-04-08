// server/clients/handler.js
// Handles /api/clients routes with CPF deduplication and RBAC.

import { getDatabaseClient } from '../database/neonClient.js'
import {
  normalizeCpfServer,
  findClientByCpf,
  findClientByOfflineOriginId,
  createClient,
  updateClient,
  listClients,
  getClientProposals,
  appendClientAuditLog,
} from './repository.js'
import { resolveActor } from '../proposals/permissions.js'

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function getDb(sendJson) {
  const db = getDatabaseClient()
  if (!db) {
    sendJson(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' } })
    return null
  }
  return db
}

/**
 * POST /api/clients/upsert-by-cpf
 * Upsert a client by CPF (deduplication). Returns existing client if CPF matches.
 * Also handles idempotency via offline_origin_id.
 */
export async function handleUpsertClientByCpf(req, res, ctx) {
  const { readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    if (!actor?.userId) return sendError(sendJson, 401, 'UNAUTHENTICATED', 'Login required')
    if (actor.isFinanceiro && !actor.isAdmin) return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
  } catch {
    return sendError(sendJson, 401, 'UNAUTHENTICATED', 'Login required')
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON')
  }

  if (!body.name || typeof body.name !== 'string') {
    return sendError(sendJson, 422, 'VALIDATION_ERROR', 'Field name is required')
  }

  const offlineOriginId = body.offline_origin_id ?? null
  const cpfNormalized = normalizeCpfServer(body.cpf_raw ?? body.cpf_normalized ?? body.document)

  try {
    // Idempotency: if we already created this offline entity, return it
    if (offlineOriginId) {
      const existing = await findClientByOfflineOriginId(db.sql, offlineOriginId)
      if (existing) {
        return sendJson(200, { data: existing, deduplicated: false, idempotent: true })
      }
    }

    // CPF deduplication: if CPF exists, return existing client
    if (cpfNormalized) {
      const existing = await findClientByCpf(db.sql, cpfNormalized)
      if (existing) {
        await appendClientAuditLog(
          db.sql, existing.id, actor.userId, actor.email ?? null,
          'proposal_linked',
          null,
          { offline_origin_id: offlineOriginId, linked_by: actor.userId },
          'CPF deduplication — existing client reused',
          null
        )
        return sendJson(200, { data: existing, deduplicated: true, idempotent: false })
      }
    }

    // Create new client
    const newClient = await createClient(db.sql, {
      name: body.name.trim(),
      cpf_normalized: cpfNormalized,
      cpf_raw: body.cpf_raw ?? body.document ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      city: body.city ?? null,
      state: body.state ?? body.uf ?? null,
      address: body.address ?? null,
      document: body.document ?? null,
      uc: body.uc ?? null,
      distribuidora: body.distribuidora ?? null,
      created_by_user_id: actor.userId,
      owner_user_id: actor.userId,
      identity_status: cpfNormalized ? 'confirmed' : 'pending_cpf',
      origin: offlineOriginId ? 'offline_sync' : 'online',
      offline_origin_id: offlineOriginId,
      metadata: body.metadata ?? null,
    })

    await appendClientAuditLog(
      db.sql, newClient.id, actor.userId, actor.email ?? null,
      'created',
      null,
      newClient,
      offlineOriginId ? 'offline_sync' : null,
      null
    )

    return sendJson(201, { data: newClient, deduplicated: false, idempotent: false })
  } catch (err) {
    console.error('[clients] upsert-by-cpf error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to upsert client')
  }
}

/**
 * GET /api/clients — list with filters
 * POST /api/clients — create client
 */
export async function handleClientsRequest(req, res, ctx) {
  const { method, readJsonBody, sendJson: rawSendJson, requestUrl } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    if (!actor?.userId) return sendError(sendJson, 401, 'UNAUTHENTICATED', 'Login required')
  } catch {
    return sendError(sendJson, 401, 'UNAUTHENTICATED', 'Login required')
  }

  if (method === 'GET') {
    const q = requestUrl.searchParams
    const ownerUserId = (actor.isAdmin || actor.isFinanceiro) ? (q.get('owner_user_id') ?? null) : actor.userId
    try {
      const result = await listClients(db.sql, {
        ownerUserId,
        createdByUserId: q.get('created_by') ?? null,
        city: q.get('city') ?? null,
        state: q.get('uf') ?? null,
        identityStatus: q.get('identity_status') ?? null,
        search: q.get('search') ?? null,
        page: q.get('page') ?? 1,
        limit: q.get('limit') ?? 20,
        sortBy: q.get('sort_by') ?? 'updated_at',
        sortDir: q.get('sort_dir') ?? 'DESC',
      })
      return sendJson(200, result)
    } catch (err) {
      console.error('[clients] list error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to list clients')
    }
  }

  if (method === 'POST') {
    if (actor.isFinanceiro && !actor.isAdmin) {
      return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
    }
    let body
    try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }
    if (!body.name) return sendError(sendJson, 422, 'VALIDATION_ERROR', 'Field name is required')

    try {
      const cpfNormalized = normalizeCpfServer(body.cpf_raw ?? body.document)
      const client = await createClient(db.sql, {
        ...body,
        cpf_normalized: cpfNormalized,
        created_by_user_id: actor.userId,
        owner_user_id: actor.userId,
        identity_status: cpfNormalized ? 'confirmed' : 'pending_cpf',
        origin: 'online',
      })
      await appendClientAuditLog(db.sql, client.id, actor.userId, actor.email ?? null, 'created', null, client)
      return sendJson(201, { data: client })
    } catch (err) {
      console.error('[clients] create error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to create client')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}

/**
 * GET /api/clients/:id
 * GET /api/clients/:id/proposals
 * PUT /api/clients/:id
 */
export async function handleClientByIdRequest(req, res, ctx) {
  const { method, clientId, subpath, readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    if (!actor?.userId) return sendError(sendJson, 401, 'UNAUTHENTICATED', 'Login required')
  } catch {
    return sendError(sendJson, 401, 'UNAUTHENTICATED', 'Login required')
  }

  // GET /api/clients/:id/proposals
  if (method === 'GET' && subpath === 'proposals') {
    try {
      const proposals = await getClientProposals(db.sql, clientId)
      return sendJson(200, { data: proposals })
    } catch (err) {
      console.error('[clients] get proposals error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to get proposals')
    }
  }

  if (method === 'PUT') {
    if (actor.isFinanceiro && !actor.isAdmin) {
      return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
    }
    let body
    try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }

    try {
      const cpfNormalized = body.cpf_raw ? normalizeCpfServer(body.cpf_raw) : undefined
      const updated = await updateClient(db.sql, clientId, {
        ...body,
        cpf_normalized: cpfNormalized,
      })
      if (!updated) return sendError(sendJson, 404, 'NOT_FOUND', 'Client not found')
      await appendClientAuditLog(db.sql, updated.id, actor.userId, actor.email ?? null, 'updated', null, updated)
      return sendJson(200, { data: updated })
    } catch (err) {
      console.error('[clients] update error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update client')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}
