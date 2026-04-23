// server/clients/handler.js
// Handles /api/clients routes with CPF deduplication and RBAC.

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
  getClientById,
  getClientProposals,
  appendClientAuditLog,
  upsertClientEnergyProfile,
  upsertClientUsinaConfig,
  backfillClientConsultorNames,
} from './repository.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
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

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value
  }
  return undefined
}

function parseNullableNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeCep(raw) {
  if (raw === undefined) return undefined
  if (raw === null) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits ? digits : null
}

// Placeholder values that must never be stored as a client name.
// Keep this list in sync with:
//   • server/proposals/validators.js  → PLACEHOLDER_NAME_BLOCKLIST
//   • server/clients/repository.js    → CLIENT_LISTABLE_ANCHOR SQL condition
//   • db/migrations/0052_listable_views.sql → vw_clients_listable
const CLIENT_PLACEHOLDER_NAMES = new Set([
  '[object object]', '0', 'null', 'undefined', '-', '\u2014',
])

/**
 * Validate writable client fields from a POST/PUT body.
 * Returns { ok: true } or { ok: false, field, message }.
 */
function validateClientWriteFields(body) {
  const rawName = firstDefined(body?.client_name, body?.name)
  if (rawName != null) {
    const nameLower = String(rawName).trim().toLowerCase()
    if (CLIENT_PLACEHOLDER_NAMES.has(nameLower)) {
      return { ok: false, field: 'name', message: 'Field name contains an invalid placeholder value' }
    }
  }

  const rawEmail = firstDefined(body?.client_email, body?.email)
  if (rawEmail != null && String(rawEmail).trim() !== '') {
    if (!String(rawEmail).includes('@')) {
      return { ok: false, field: 'email', message: 'Field email must contain @' }
    }
  }

  const rawPhone = firstDefined(body?.client_phone, body?.phone)
  if (rawPhone != null && String(rawPhone).trim() !== '') {
    const digits = String(rawPhone).replace(/\D/g, '')
    if (digits.length > 0 && digits.length < 10) {
      return { ok: false, field: 'phone', message: 'Field phone must have at least 10 digits' }
    }
  }

  return { ok: true }
}

function toClientWritePayload(body) {
  const accepted = {}
  const assign = (field, ...sources) => {
    const value = firstDefined(...sources)
    if (value !== undefined) accepted[field] = value
  }

  assign('name', body.client_name, body.name)
  assign('phone', body.client_phone, body.phone)
  assign('email', body.client_email, body.email)
  assign('city', body.client_city, body.city)
  assign('state', body.client_state, body.state, body.uf)
  assign('address', body.client_address, body.address)
  assign('document', body.client_document, body.document)
  const normalizedCep = normalizeCep(firstDefined(body.client_cep, body.cep))
  if (normalizedCep !== undefined) accepted.client_cep = normalizedCep
  assign('uc', body.uc_geradora, body.ucGeradora, body.uc)
  assign('uc_beneficiaria', body.uc_beneficiaria, body.ucBeneficiaria)
  assign('system_kwp', body.system_kwp, body.systemKwp)
  assign('term_months', body.term_months, body.termMonths)
  assign('distribuidora', body.distribuidora)

  const parsedConsumption = parseNullableNumber(
    firstDefined(body.consumption_kwh_month, body.consumptionKwhMonth),
  )
  if (firstDefined(body.consumption_kwh_month, body.consumptionKwhMonth) !== undefined) {
    accepted.consumption_kwh_month = parsedConsumption
  }

  // Usina fields are now persisted in the dedicated client_usina_config table
  // (migration 0032). We still write them to metadata as a temporary fallback
  // for environments where the migration hasn't been applied yet.
  // The handler will additionally call upsertClientUsinaConfig() after save.
  const usinaFields = {}
  const usinaKeys = [
    'potencia_modulo_wp', 'numero_modulos', 'modelo_modulo',
    'modelo_inversor', 'tipo_instalacao', 'area_instalacao_m2',
    'geracao_estimada_kwh', 'valordemercado',
  ]
  for (const key of usinaKeys) {
    if (body[key] !== undefined) usinaFields[key] = body[key]
  }

  // Combine with any explicitly-provided metadata (temporary fallback)
  const explicitMeta = body.metadata ?? null
  if (Object.keys(usinaFields).length > 0 || explicitMeta) {
    accepted.metadata = {
      ...(typeof explicitMeta === 'object' && explicitMeta !== null ? explicitMeta : {}),
      ...usinaFields,
    }
  }

  // Canonical consultant FK (clients.consultant_id — BIGINT FK to consultants).
  // Only accept a non-empty string/number; never send null (server uses COALESCE to preserve
  // the existing value, so omitting the field is safer than sending null).
  const rawConsultantId = firstDefined(body.consultant_id)
  if (rawConsultantId !== undefined && rawConsultantId !== null && rawConsultantId !== '') {
    const parsed = parseInt(String(rawConsultantId).trim(), 10)
    if (!isNaN(parsed) && parsed > 0) {
      accepted.consultant_id = parsed
    }
  }

  // Expose usina fields separately so the handler can persist them in client_usina_config
  accepted._usinaConfig = Object.keys(usinaFields).length > 0 ? usinaFields : null

  return accepted
}

function normalizeClientResponse(row) {
  if (!row) return row
  return {
    ...row,
    name: row.client_name ?? row.name ?? null,
    client_name: row.client_name ?? row.name ?? null,
    document: row.client_document ?? row.document ?? null,
    client_document: row.client_document ?? row.document ?? null,
    email: row.client_email ?? row.email ?? null,
    client_email: row.client_email ?? row.email ?? null,
    phone: row.client_phone ?? row.phone ?? null,
    client_phone: row.client_phone ?? row.phone ?? null,
    city: row.client_city ?? row.city ?? null,
    client_city: row.client_city ?? row.city ?? null,
    state: row.client_state ?? row.state ?? null,
    client_state: row.client_state ?? row.state ?? null,
    address: row.client_address ?? row.address ?? null,
    client_address: row.client_address ?? row.address ?? null,
    cep: row.client_cep ?? row.cep ?? null,
    client_cep: row.client_cep ?? row.cep ?? null,
    uc: row.uc_geradora ?? row.uc ?? null,
    uc_geradora: row.uc_geradora ?? row.uc ?? null,
    ucBeneficiaria: row.uc_beneficiaria ?? null,
    consumptionKwhMonth: row.consumption_kwh_month ?? null,
    systemKwp: row.system_kwp ?? null,
    termMonths: row.term_months ?? null,
    updatedAt: row.updated_at ?? null,
    deletedAt: row.deleted_at ?? null,
  }
}

/**
 * Best-effort upsert of energy profile — never blocks the parent save path.
 * Errors are logged with client context to maintain observability.
 */
async function tryUpsertEnergyProfile(sql, clientId, profile) {
  try {
    await upsertClientEnergyProfile(sql, clientId, profile)
  } catch (err) {
    console.warn('[clients][energy-profile] upsert failed', {
      clientId,
      message: err instanceof Error ? err.message : String(err),
    })
  }
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
  // Inject app.current_user_id and app.current_user_role into the PostgreSQL
  // session via a single sql.transaction() batch.  The main DB client prefers
  // DATABASE_URL_UNPOOLED (direct connection) where sql.transaction() works
  // reliably.  All access control is enforced by RLS policies in the DB.
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

  const writeValidation = validateClientWriteFields(body)
  if (!writeValidation.ok) {
    return sendError(sendJson, 422, 'VALIDATION_ERROR', writeValidation.message)
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
        if (body.energyProfile && typeof body.energyProfile === 'object') {
          await tryUpsertEnergyProfile(db.sql, existing.id, body.energyProfile)
        }
        return sendJson(200, { data: normalizeClientResponse(existing), deduplicated: false, idempotent: true })
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
        if (body.energyProfile && typeof body.energyProfile === 'object') {
          await tryUpsertEnergyProfile(db.sql, existing.id, body.energyProfile)
        }
        return sendJson(200, { data: normalizeClientResponse(existing), deduplicated: true, idempotent: false })
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
        if (body.energyProfile && typeof body.energyProfile === 'object') {
          await tryUpsertEnergyProfile(db.sql, existing.id, body.energyProfile)
        }
        return sendJson(200, { data: normalizeClientResponse(existing), deduplicated: true, idempotent: false })
      }
    }

    const mappedBody = toClientWritePayload(body)
    const newClient = await createClient(db.sql, {
      ...mappedBody,
      name: (mappedBody.name ?? body.name ?? '').trim(),
      cpf_normalized: cpfNormalized,
      cpf_raw: docType === 'cpf' ? rawDocument : (body.cpf_raw ?? null),
      cnpj_normalized: cnpjNormalized,
      cnpj_raw: docType === 'cnpj' ? rawDocument : (body.cnpj_raw ?? null),
      document_type: docType !== 'unknown' ? docType : null,
      document: rawDocument ?? null,
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

    if (body.energyProfile && typeof body.energyProfile === 'object') {
      await tryUpsertEnergyProfile(db.sql, newClient.id, body.energyProfile)
    }
    // Persist usina fields in the dedicated client_usina_config table
    if (mappedBody._usinaConfig) {
      try {
        await upsertClientUsinaConfig(db.sql, newClient.id, mappedBody._usinaConfig)
      } catch (usinaErr) {
        console.warn('[clients][create] upsertClientUsinaConfig failed (non-fatal):',
          usinaErr instanceof Error ? usinaErr.message : String(usinaErr))
      }
    }

    logRoute('/api/clients/upsert-by-cpf', { method: 'POST', actorUserId: actor.userId, success: true, clientId: newClient.id })
    return sendJson(201, { data: normalizeClientResponse(newClient), deduplicated: false, idempotent: false })
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
    const q = requestUrl.searchParams
    const page = q.get('page') ?? 1
    const limit = q.get('limit') ?? 20
    const resolvedActorRole = actorRole(actor)
    const isComercialActor = resolvedActorRole === 'role_comercial'
    const isScoped = isComercialActor
    console.info('[clients][list] security', {
      role: resolvedActorRole,
      userId: actor?.userId ?? null,
      scoped: isScoped,
    })
    if (isComercialActor) {
      console.info('[clients][list] scoped-by-owner', { actorUserId: actor.userId })
    } else {
      console.info('[clients][list] admin-access', { actorRole: resolvedActorRole })
    }
    console.info('[api/clients][GET] db-config', {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasUnpooledUrl: Boolean(process.env.DATABASE_URL_UNPOOLED || process.env.NEON_DATABASE_URL_UNPOOLED),
      nodeEnv: process.env.NODE_ENV ?? null,
    })
    try {
      const userSql = sqlForActor(db, actor)
      logRoute('/api/clients', { method: 'GET', actorUserId: actor.userId, actorRole: resolvedActorRole, page, limit })
      const result = await listClients(userSql, {
        createdByUserId: q.get('created_by') ?? null,
        city: q.get('city') ?? null,
        state: q.get('uf') ?? null,
        identityStatus: q.get('identity_status') ?? null,
        search: q.get('search') ?? null,
        page,
        limit,
        sortBy: q.get('sort_by') ?? 'updated_at',
        sortDir: q.get('sort_dir') ?? 'DESC',
        actorUserId: actor.userId,
        actorRole: resolvedActorRole,
      })
      const safeData = Array.isArray(result?.data) ? result.data.map(normalizeClientResponse) : []
      console.info('[clients][list] security', {
        role: resolvedActorRole,
        userId: actor.userId,
        scoped: isComercialActor,
        count: safeData.length,
      })
      logRoute('/api/clients', { method: 'GET', actorUserId: actor.userId, success: true, count: safeData.length })
      return sendJson(200, { ...result, data: safeData })
    } catch (err) {
      // Auth errors from sqlForActor (createUserScopedSql) must not become 500
      if (err?.statusCode === 401 || err?.statusCode === 403) {
        return handleAuthError(sendJson, err)
      }
      console.error('[clients][list] failed', {
        actorUserId: actor?.userId ?? null,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        code: err?.code ?? null,
        detail: err?.detail ?? null,
        hint: err?.hint ?? null,
        name: err?.name ?? null,
      })
      return sendError(sendJson, 500, 'CLIENTS_LIST_FAILED', 'Falha ao carregar clientes do banco.')
    }
  }

  if (method === 'POST') {
    if (requestUrl.pathname === '/api/clients/consultor-backfill') {
      if (!actor.isAdmin) {
        return sendError(sendJson, 403, 'FORBIDDEN', 'Apenas administradores podem executar a varredura de consultores.')
      }
      try {
        logRoute('/api/clients/consultor-backfill', { method: 'POST', actorUserId: actor.userId })
        const result = await backfillClientConsultorNames(db.sql)
        return sendJson(200, { data: result })
      } catch (err) {
        console.error('[clients][consultor-backfill] failed', err)
        return sendError(sendJson, 500, 'CONSULTOR_BACKFILL_FAILED', 'Falha ao executar a varredura de consultores.')
      }
    }

    if (actor.isFinanceiro && !actor.isAdmin) {
      return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
    }
    let body
    try { body = await readJsonBody(req) } catch { return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON') }
    const hasName = firstDefined(body?.client_name, body?.name)
    if (!hasName) return sendError(sendJson, 422, 'VALIDATION_ERROR', 'Field name is required')

    const writeValidation = validateClientWriteFields(body)
    if (!writeValidation.ok) {
      return sendError(sendJson, 422, 'VALIDATION_ERROR', writeValidation.message)
    }

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
      const mappedBody = toClientWritePayload(body)
      const client = await createClient(userSql, {
        ...mappedBody,
        name: mappedBody.name,
        cpf_normalized: cpfNormalized,
        cnpj_normalized: cnpjNormalized,
        cnpj_raw: docType === 'cnpj' ? rawDoc : (body.cnpj_raw ?? null),
        document: firstDefined(mappedBody.document, body.client_document, body.document, rawDoc),
        document_type: docType !== 'unknown' ? docType : null,
        created_by_user_id: actor.userId,
        owner_user_id: actor.userId,
        identity_status: identityStatus,
        origin: 'online',
      })
      await appendClientAuditLog(db.sql, client.id, actor.userId, actor.email ?? null, 'created', null, client)
      // Persist usina fields in the dedicated client_usina_config table
      if (mappedBody._usinaConfig) {
        try {
          await upsertClientUsinaConfig(userSql, client.id, mappedBody._usinaConfig)
        } catch (usinaErr) {
          console.warn('[clients][create] upsertClientUsinaConfig failed (non-fatal):',
            usinaErr instanceof Error ? usinaErr.message : String(usinaErr))
        }
      }
      logRoute('/api/clients', { method: 'POST', actorUserId: actor.userId, success: true, clientId: client.id })
      return sendJson(201, { data: normalizeClientResponse(client) })
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

  const resolvedActorRole = actorRole(actor)

  if (method === 'GET' && !subpath) {
    // GET /api/clients/:id — fetch a single client
    try {
      const userSql = sqlForActor(db, actor)
      logRoute('/api/clients/:id', { method: 'GET', actorUserId: actor.userId, actorRole: resolvedActorRole, clientId })
      const client = await getClientById(userSql, clientId, {
        actorUserId: actor.userId,
        actorRole: resolvedActorRole,
      })
      if (!client) {
        // Return 404 for both "not found" and "access denied" to avoid
        // revealing existence of records the caller cannot read.
        return sendError(sendJson, 404, 'NOT_FOUND', 'Client not found')
      }
      logRoute('/api/clients/:id', { method: 'GET', actorUserId: actor.userId, actorRole: resolvedActorRole, clientId, success: true })
      return sendJson(200, { data: normalizeClientResponse(client) })
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) {
        return handleAuthError(sendJson, err)
      }
      console.error('[clients] get-by-id error:', err)
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to get client')
    }
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
      console.log('[clients][update] auth context', {
        userId: actor.userId,
        resolvedRole: resolvedActorRole,
        clientId,
      })
      if (!resolvedActorRole) {
        return sendError(
          sendJson,
          403,
          'RLS_CONTEXT_MISSING_INTERNAL_ROLE',
          'Unable to resolve internal app role for SQL session.',
        )
      }
      const rawDoc = body.cpf_raw ?? body.cnpj_raw ?? null
      const { type: docType } = normalizeDocumentServer(rawDoc)
      const cpfNormalized = (body.cpf_raw != null || docType === 'cpf') ? normalizeCpfServer(body.cpf_raw ?? rawDoc) : undefined
      const cnpjNormalized = (body.cnpj_raw != null || docType === 'cnpj') ? normalizeCnpjServer(body.cnpj_raw ?? rawDoc) : undefined
      console.log('[clients][update] applying rls context', {
        userId: actor.userId,
        userRole: resolvedActorRole,
      })
      const userSql = sqlForActor(db, actor)
      const mappedBody = toClientWritePayload(body)
      const updatePayload = {
        ...mappedBody,
        cpf_normalized: cpfNormalized,
        cnpj_normalized: cnpjNormalized,
        client_document: firstDefined(mappedBody.document, body.client_document, body.document),
        document_type: docType !== 'unknown' ? docType : undefined,
      }
      console.info('[clients][update] raw payload', { clientId, payload: body })
      console.info('[clients][update] normalized payload', { clientId, payload: updatePayload })
      console.info('[clients][update] columns to persist', { clientId, columns: Object.keys(updatePayload) })
      const updated = await updateClient(userSql, clientId, updatePayload, {
        actorUserId: actor.userId,
        actorRole: resolvedActorRole,
      })
      if (!updated) return sendError(sendJson, 404, 'NOT_FOUND', 'Client not found')
      console.info('[clients][update] updated-row', { clientId, updated })
      try {
        await appendClientAuditLog(db.sql, updated.id, actor.userId, actor.email ?? null, 'updated', null, updated)
      } catch (auditErr) {
        console.warn('[clients] audit log write failed (non-fatal):', auditErr instanceof Error ? auditErr.message : String(auditErr))
      }
      if (body.energyProfile && typeof body.energyProfile === 'object') {
        await tryUpsertEnergyProfile(userSql, updated.id, body.energyProfile)
      }
      // Auto-detect plano leasing fields and upsert energy profile.
      // These are sent as top-level fields from the portfolio Plano tab.
      const planoFields = {}
      if (body.kwh_mes_contratado !== undefined) planoFields.kwh_contratado = body.kwh_mes_contratado
      if (body.desconto_percentual !== undefined) planoFields.desconto_percentual = body.desconto_percentual
      if (body.tarifa_atual !== undefined) planoFields.tarifa_atual = body.tarifa_atual
      if (body.valor_mensalidade !== undefined) planoFields.mensalidade = body.valor_mensalidade
      if (Object.keys(planoFields).length > 0) {
        await tryUpsertEnergyProfile(userSql, updated.id, planoFields)
      }
      // Persist usina fields in the dedicated client_usina_config table
      if (mappedBody._usinaConfig) {
        try {
          await upsertClientUsinaConfig(userSql, updated.id, mappedBody._usinaConfig)
        } catch (usinaErr) {
          console.warn('[clients][update] upsertClientUsinaConfig failed (non-fatal):',
            usinaErr instanceof Error ? usinaErr.message : String(usinaErr))
        }
      }
      logRoute('/api/clients/:id', { method: 'PUT', actorUserId: actor.userId, clientId, success: true })
      return sendJson(200, { data: normalizeClientResponse(updated) })
    } catch (err) {
      console.error('[clients][update] db error', {
        clientId,
        code: err?.code ?? null,
        detail: err?.detail ?? null,
        hint: err?.hint ?? null,
        message: err instanceof Error ? err.message : String(err),
        columns: Object.keys(toClientWritePayload(body ?? {})),
      })
      return sendError(sendJson, 500, 'CLIENT_UPDATE_FAILED', err?.message ?? 'Failed to update client')
    }
  }

  if (method === 'DELETE') {
    if (actor.isFinanceiro && !actor.isAdmin) {
      return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
    }

    try {
      logRoute('/api/clients/:id', { method: 'DELETE', actorUserId: actor.userId, clientId })
      console.info('[api/clients][DELETE] start', { id: clientId, actorUserId: actor.userId, actorRole: actorRole(actor) })
      const userSql = sqlForActor(db, actor)
      const deleted = await softDeleteClient(userSql, clientId, actor.userId, resolvedActorRole)

      if (!deleted) {
        // UPDATE returned 0 rows — could be "truly absent" or "RLS/app-layer silently blocked".
        // Distinguish by re-checking with a service-level bypass query (intentional db.sql
        // direct access — no RLS context set so we see the record regardless of ownership,
        // solely to decide between 404 "absent" vs 403 "forbidden").
        const existsRows = await db.sql`
          SELECT 1
          FROM clients
          WHERE id = ${clientId}
            AND deleted_at IS NULL
          LIMIT 1
        `
        if (existsRows.length > 0) {
          console.warn('[api/clients][DELETE] blocked-by-rls', {
            id: clientId,
            actorUserId: actor.userId,
            actorRole: actorRole(actor),
          })
          return sendError(sendJson, 403, 'FORBIDDEN', 'Not authorized to delete this client')
        }

        console.info('[api/clients][DELETE] already-absent', { id: clientId })
        res.statusCode = 204
        res.end()
        return
      }

      await appendClientAuditLog(db.sql, clientId, actor.userId, actor.email ?? null, 'deleted', null, null)
      console.info('[api/clients][DELETE] success', { id: clientId, actorUserId: actor.userId, actorRole: actorRole(actor) })
      res.statusCode = 204
      res.end()
      return
    } catch (err) {
      console.error('[api/clients][DELETE] failed', {
        id: clientId,
        actorUserId: actor.userId,
        actorRole: actorRole(actor),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
      return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to delete client')
    }
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed`)
}
