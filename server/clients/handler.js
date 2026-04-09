// server/clients/handler.js
// Handles /api/clients routes with CPF deduplication and RBAC.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import {
  normalizeCpfServer,
  normalizeCnpjServer,
  normalizeDocumentServer,
  findClientByCpf,
  findClientByCnpj,
  findClientByOfflineOriginId,
  createClient,
  updateClient,
  listClients,
  getClientProposals,
  appendClientAuditLog,
} from './repository.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'

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
 * Upsert a client by CPF or CNPJ (deduplication). Returns existing client if document matches.
 * Also handles idempotency via offline_origin_id.
 *
 * Document auto-detection:
 *   - 11 digits → CPF
 *   - 14 digits → CNPJ
 * Accepts: cpf_raw, cnpj_raw, document (any of these; auto-detected by digit count).
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

  // Auto-detect document type from whichever field is provided
  const rawDocument = body.cpf_raw ?? body.cnpj_raw ?? body.document ?? null
  const { type: docType, normalized: docNormalized } = normalizeDocumentServer(rawDocument)

  const cpfNormalized = docType === 'cpf' ? normalizeCpfServer(rawDocument) : null
  const cnpjNormalized = docType === 'cnpj' ? normalizeCnpjServer(rawDocument) : null

  // Determine identity status based on document type and presence
  let identityStatus = 'pending_cpf'
  if (docNormalized && docType === 'cpf') identityStatus = 'confirmed'
  else if (docNormalized && docType === 'cnpj') identityStatus = 'confirmed'
  else if (docType === 'cnpj') identityStatus = 'pending_cnpj'

  try {
    // Idempotency: if we already created this offline entity, return it
    if (offlineOriginId) {
      const existing = await findClientByOfflineOriginId(db.sql, offlineOriginId)
      if (existing) {
        return sendJson(200, { data: existing, deduplicated: false, idempotent: true })
      }
    }

    // Document deduplication: CPF first, then CNPJ
    if (cpfNormalized) {
      const existing = await findClientByCpf(db.sql, cpfNormalized)
      if (existing) {
        await appendClientAuditLog(
          db.sql, existing.id, actor.userId, actor.email ?? null,
          'proposal_linked', null,
          { offline_origin_id: offlineOriginId, linked_by: actor.userId },
          'CPF deduplication — existing client reused', null
        )
        return sendJson(200, { data: existing, deduplicated: true, idempotent: false })
      }
    }

    if (cnpjNormalized) {
      const existing = await findClientByCnpj(db.sql, cnpjNormalized)
      if (existing) {
        await appendClientAuditLog(
          db.sql, existing.id, actor.userId, actor.email ?? null,
          'proposal_linked', null,
          { offline_origin_id: offlineOriginId, linked_by: actor.userId },
          'CNPJ deduplication — existing client reused', null
        )
        return sendJson(200, { data: existing, deduplicated: true, idempotent: false })
      }
    }

    // Create new client
    const newClient = await createClient(db.sql, {
      name: body.name.trim(),
      cpf_normalized: cpfNormalized,
      cpf_raw: docType === 'cpf' ? rawDocument : (body.cpf_raw ?? null),
      cnpj_normalized: cnpjNormalized,
      cnpj_raw: docType === 'cnpj' ? rawDocument : (body.cnpj_raw ?? null),
      document_type: docType !== 'unknown' ? docType : null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      city: body.city ?? null,
      state: body.state ?? body.uf ?? null,
      address: body.address ?? null,
      document: rawDocument ?? null,
      uc: body.uc ?? null,
      distribuidora: body.distribuidora ?? null,
      created_by_user_id: actor.userId,
      owner_user_id: actor.userId,
      identity_status: identityStatus,
      origin: offlineOriginId ? 'offline_sync' : 'online',
      offline_origin_id: offlineOriginId,
      metadata: body.metadata ?? null,
    })

    await appendClientAuditLog(
      db.sql, newClient.id, actor.userId, actor.email ?? null,
      'created', null, newClient,
      offlineOriginId ? 'offline_sync' : null, null
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
    // RLS (via userSql + role context) enforces access — no ownerUserId/officeUserId needed.
    const userSql = createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
    try {
      const result = await listClients(userSql, {
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
      const rawDoc = body.cpf_raw ?? body.cnpj_raw ?? body.document ?? null
      const { type: docType, normalized: docNormalized } = normalizeDocumentServer(rawDoc)
      const cpfNormalized = docType === 'cpf' ? normalizeCpfServer(rawDoc) : null
      const cnpjNormalized = docType === 'cnpj' ? normalizeCnpjServer(rawDoc) : null
      let identityStatus = 'pending_cpf'
      if (docNormalized && docType === 'cpf') identityStatus = 'confirmed'
      else if (docNormalized && docType === 'cnpj') identityStatus = 'confirmed'
      else if (docType === 'cnpj') identityStatus = 'pending_cnpj'
      // RLS enforces write permission; app layer also guards via isFinanceiro check above.
      const userSql = createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
      const client = await createClient(userSql, {
        ...body,
        cpf_normalized: cpfNormalized,
        cnpj_normalized: cnpjNormalized,
        cnpj_raw: docType === 'cnpj' ? rawDoc : (body.cnpj_raw ?? null),
        document_type: docType !== 'unknown' ? docType : null,
        created_by_user_id: actor.userId,
        owner_user_id: actor.userId,
        identity_status: identityStatus,
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
    const userSql = createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
    try {
      const proposals = await getClientProposals(userSql, clientId)
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
      const rawDoc = body.cpf_raw ?? body.cnpj_raw ?? null
      const { type: docType, normalized: _docNormalized } = normalizeDocumentServer(rawDoc)
      const cpfNormalized = (body.cpf_raw != null || docType === 'cpf') ? normalizeCpfServer(body.cpf_raw ?? rawDoc) : undefined
      const cnpjNormalized = (body.cnpj_raw != null || docType === 'cnpj') ? normalizeCnpjServer(body.cnpj_raw ?? rawDoc) : undefined
      // RLS enforces write permission; app layer also guards via isFinanceiro check above.
      const userSql = createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
      const updated = await updateClient(userSql, clientId, {
        ...body,
        cpf_normalized: cpfNormalized,
        cnpj_normalized: cnpjNormalized,
        document_type: docType !== 'unknown' ? docType : undefined,
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
