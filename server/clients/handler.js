// server/clients/handler.js
// Handles /api/clients routes with CPF deduplication and RBAC.

import { randomUUID } from 'node:crypto'
import { getDatabaseClient } from '../database/neonClient.js'
import { getCanonicalDatabaseDiagnostics } from '../database/connection.js'
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
  softDeleteClient,
  listClients,
  getClientProposals,
  appendClientAuditLog,
} from './repository.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function createRequestId() {
  try {
    return randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
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

function getDb(sendJson) {
  const db = getDatabaseClient()
  if (!db) {
    sendJson(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' } })
    return null
  }
  return db
}

function sqlForActor(db, actor) {
  return createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
}


function requireClientAuth(actor) {
  if (!actor?.userId) {
    const err = new Error('Login required')
    err.statusCode = 401
    throw err
  }
  if (!actor?.hasAnyRole) {
    const err = new Error('Access forbidden: no recognized role assigned')
    err.statusCode = 403
    throw err
  }
}

function handleAuthError(sendJson, err) {
  const status = err?.statusCode ?? 500
  if (status === 401) return sendError(sendJson, 401, 'UNAUTHENTICATED', err.message || 'Login required')
  if (status === 403) return sendError(sendJson, 403, 'FORBIDDEN', err.message || 'Access forbidden')
  return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Unexpected authentication error')
}

export async function handleUpsertClientByCpf(req, res, ctx) {
  const { readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientAuth(actor)
    if (actor.isFinanceiro && !actor.isAdmin) return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
  } catch (err) {
    return handleAuthError(sendJson, err)
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
  const rawDocument = body.cpf_raw ?? body.cnpj_raw ?? body.document ?? null
  const { type: docType, normalized: docNormalized } = normalizeDocumentServer(rawDocument)

  const cpfNormalized = docType === 'cpf' ? normalizeCpfServer(rawDocument) : null
  const cnpjNormalized = docType === 'cnpj' ? normalizeCnpjServer(rawDocument) : null

  let identityStatus = 'pending_cpf'
  if (docNormalized && docType === 'cpf') identityStatus = 'confirmed'
  else if (docNormalized && docType === 'cnpj') identityStatus = 'confirmed'
  else if (docType === 'cnpj') identityStatus = 'pending_cnpj'

  try {
    logRoute('/api/clients/upsert-by-cpf', { method: 'POST', actorUserId: actor.userId })

    if (offlineOriginId) {
      const existing = await findClientByOfflineOriginId(db.sql, offlineOriginId)
      if (existing) {
        return sendJson(200, { data: existing, deduplicated: false, idempotent: true })
      }
    }

    if (cpfNormalized) {
      const existing = await findClientByCpf(db.sql, cpfNormalized)
      if (existing) {
        await appendClientAuditLog(
          db.sql, existing.id, actor.userId, actor.email ?? null,
          'proposal_linked', null,
          { offline_origin_id: offlineOriginId, linked_by: actor.userId },
          'CPF deduplication — existing client reused', null,
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
          'CNPJ deduplication — existing client reused', null,
        )
        return sendJson(200, { data: existing, deduplicated: true, idempotent: false })
      }
    }

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
      offlineOriginId ? 'offline_sync' : null, null,
    )

    logRoute('/api/clients/upsert-by-cpf', { method: 'POST', actorUserId: actor.userId, success: true, clientId: newClient.id })
    return sendJson(201, { data: newClient, deduplicated: false, idempotent: false })
  } catch (err) {
    console.error('[clients] upsert-by-cpf error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to upsert client')
  }
}

export async function handleClientsRequest(req, res, ctx) {
  const { method, readJsonBody, sendJson: rawSendJson, requestUrl } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  if (method === 'GET') {
    const requestId = createRequestId()
    const q = requestUrl.searchParams
    const page = q.get('page') ?? 1
    const limit = q.get('limit') ?? 20
    console.info('[api/clients][GET] start', {
      requestId,
      page,
      limit,
      userId: actor?.userId ?? null,
      email: actor?.email ?? null,
    })
    console.info('[api/clients][GET] db-config', {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.PGURI || process.env.NEON_POSTGRESQL_URL),
      hasUnpooledUrl: Boolean(process.env.DATABASE_URL_UNPOOLED || process.env.NEON_DATABASE_URL_UNPOOLED),
      diagnostics: getCanonicalDatabaseDiagnostics(),
      nodeEnv: process.env.NODE_ENV ?? null,
    })
    try {
      const userSql = sqlForActor(db, actor)
      const shouldBypassRlsForList = actor.isAdmin || actor.isOffice || actor.isFinanceiro || actor.isGerenteComercial
      const listSql = shouldBypassRlsForList ? db.sql : userSql
      logRoute('/api/clients', { method: 'GET', actorUserId: actor.userId, page, limit })
      const result = await listClients(listSql, {
        createdByUserId: q.get('created_by') ?? null,
        city: q.get('city') ?? null,
        state: q.get('uf') ?? null,
        identityStatus: q.get('identity_status') ?? null,
        search: q.get('search') ?? null,
        page,
        limit,
        sortBy: q.get('sort_by') ?? 'updated_at',
        sortDir: q.get('sort_dir') ?? 'DESC',
      })
      console.info('[api/clients][GET] mode', {
        requestId,
        actorUserId: actor.userId,
        actorRole: actorRole(actor),
        bypassRlsForList: shouldBypassRlsForList,
      })
      logRoute('/api/clients', { method: 'GET', actorUserId: actor.userId, success: true, count: result.data.length })
      return sendJson(200, result)
    } catch (err) {
      const isSchemaOrSqlError = typeof err?.code === 'string' && ['42703', '42P01', '42883'].includes(err.code)
      const errorCode = isSchemaOrSqlError ? 'MIGRATION_REQUIRED' : 'QUERY_FAILED'
      console.error('[api/clients][GET] failed', {
        requestId,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        code: err?.code ?? null,
        detail: err?.detail ?? null,
        hint: err?.hint ?? null,
        name: err?.name ?? null,
        actorUserId: actor?.userId ?? null,
        dbSource: getCanonicalDatabaseDiagnostics().source,
        dbSchema: getCanonicalDatabaseDiagnostics().schema,
        dbHost: getCanonicalDatabaseDiagnostics().host,
        classification: isSchemaOrSqlError ? 'MIGRATION_REQUIRED' : 'QUERY_FAILED',
      })
      return sendError(sendJson, 500, errorCode, 'Falha ao carregar clientes do banco.')
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
      logRoute('/api/clients', { method: 'POST', actorUserId: actor.userId })
      const rawDoc = body.cpf_raw ?? body.cnpj_raw ?? body.document ?? null
      const { type: docType, normalized: docNormalized } = normalizeDocumentServer(rawDoc)
      const cpfNormalized = docType === 'cpf' ? normalizeCpfServer(rawDoc) : null
      const cnpjNormalized = docType === 'cnpj' ? normalizeCnpjServer(rawDoc) : null
      let identityStatus = 'pending_cpf'
      if (docNormalized && docType === 'cpf') identityStatus = 'confirmed'
      else if (docNormalized && docType === 'cnpj') identityStatus = 'confirmed'
      else if (docType === 'cnpj') identityStatus = 'pending_cnpj'
      const userSql = sqlForActor(db, actor)
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
      logRoute('/api/clients', { method: 'POST', actorUserId: actor.userId, success: true, clientId: client.id })
      return sendJson(201, { data: client })
    } catch (err) {
      console.error('[clients] create error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to create client')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}

export async function handleClientByIdRequest(req, res, ctx) {
  const { method, clientId, subpath, readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)
  const db = getDb(sendJson)
  if (!db) return

  let actor
  try {
    actor = await resolveActor(req)
    requireClientAuth(actor)
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  if (method === 'GET' && subpath === 'proposals') {
    try {
      const userSql = sqlForActor(db, actor)
      logRoute('/api/clients/:id/proposals', { method: 'GET', actorUserId: actor.userId, clientId })
      const proposals = await getClientProposals(userSql, clientId)
      logRoute('/api/clients/:id/proposals', { method: 'GET', actorUserId: actor.userId, clientId, success: true, count: proposals.length })
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
      logRoute('/api/clients/:id', { method: 'PUT', actorUserId: actor.userId, clientId })
      const rawDoc = body.cpf_raw ?? body.cnpj_raw ?? null
      const { type: docType } = normalizeDocumentServer(rawDoc)
      const cpfNormalized = (body.cpf_raw != null || docType === 'cpf') ? normalizeCpfServer(body.cpf_raw ?? rawDoc) : undefined
      const cnpjNormalized = (body.cnpj_raw != null || docType === 'cnpj') ? normalizeCnpjServer(body.cnpj_raw ?? rawDoc) : undefined
      const userSql = sqlForActor(db, actor)
      const updated = await updateClient(userSql, clientId, {
        ...body,
        cpf_normalized: cpfNormalized,
        cnpj_normalized: cnpjNormalized,
        document_type: docType !== 'unknown' ? docType : undefined,
      })
      if (!updated) return sendError(sendJson, 404, 'NOT_FOUND', 'Client not found')
      await appendClientAuditLog(db.sql, updated.id, actor.userId, actor.email ?? null, 'updated', null, updated)
      logRoute('/api/clients/:id', { method: 'PUT', actorUserId: actor.userId, clientId, success: true })
      return sendJson(200, { data: updated })
    } catch (err) {
      console.error('[clients] update error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to update client')
    }
  }

  if (method === 'DELETE') {
    if (actor.isFinanceiro && !actor.isAdmin) {
      return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
    }

    try {
      logRoute('/api/clients/:id', { method: 'DELETE', actorUserId: actor.userId, clientId })
      console.info('[api/clients][DELETE] start', { id: clientId })
      const userSql = sqlForActor(db, actor)
      const deleted = await softDeleteClient(userSql, clientId, actor.userId)
      if (!deleted) {
        console.info('[api/clients][DELETE] already-absent', { id: clientId })
        res.statusCode = 204
        res.end()
        return
      }
      try {
        await appendClientAuditLog(db.sql, clientId, actor.userId, actor.email ?? null, 'deleted', null, null)
      } catch (auditErr) {
        console.warn('[api/clients][DELETE] audit-log-failed', {
          id: clientId,
          message: auditErr instanceof Error ? auditErr.message : String(auditErr),
        })
      }
      console.info('[client-delete][db]', { id: clientId, deletedRows: 1 })
      res.statusCode = 204
      res.end()
      return
    } catch (err) {
      console.error('[api/clients][DELETE] failed', {
        id: clientId,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to delete client')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}
