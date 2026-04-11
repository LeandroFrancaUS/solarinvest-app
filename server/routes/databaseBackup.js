import crypto from 'node:crypto'
import { getDatabaseClient } from '../database/neonClient.js'
import { resolveActor } from '../proposals/permissions.js'
import { ensureOperationalSchema } from '../database/ensureOperationalSchema.js'

const BACKUP_TABLE = 'db_backup_snapshots'
const MAX_PLATFORM_BACKUPS_PER_USER = 20

function toIsoString(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toISOString === 'function') return value.toISOString()
  return String(value)
}

function parseDestination(value) {
  if (typeof value !== 'string') return 'local'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'platform' || normalized === 'cloud') return normalized
  return 'local'
}

async function tableExists(sql, schema, table) {
  const [row] = await sql`
    SELECT to_regclass(${`${schema}.${table}`}) AS full_name
  `
  return Boolean(row?.full_name)
}

async function safeSelectAll(sql, schema, table, orderBy = 'id ASC') {
  const exists = await tableExists(sql, schema, table)
  if (!exists) return []
  const query = `SELECT * FROM ${schema}.${table} ORDER BY ${orderBy}`
  return await sql(query)
}

function sanitizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

async function withTransaction(sql, callback) {
  await sql('BEGIN')
  try {
    const result = await callback()
    await sql('COMMIT')
    return result
  } catch (error) {
    await sql('ROLLBACK')
    throw error
  }
}

async function buildBackupPayload(sql, actor) {
  const [metaRow] = await sql`
    SELECT
      now() AS generated_at,
      current_database() AS database_name,
      version() AS postgres_version
  `

  const [
    clients,
    proposals,
    clientAuditLog,
    users,
  ] = await Promise.all([
    safeSelectAll(sql, 'public', 'clients', 'id ASC'),
    safeSelectAll(sql, 'public', 'proposals', 'created_at ASC'),
    safeSelectAll(sql, 'public', 'client_audit_log', 'id ASC'),
    safeSelectAll(sql, 'public', 'app_user_access', 'created_at ASC'),
  ])

  return {
    generatedAt: toIsoString(metaRow?.generated_at) ?? new Date().toISOString(),
    generatedBy: {
      userId: actor.userId,
      email: actor.email ?? null,
      role: actor.isAdmin ? 'role_admin' : 'role_office',
    },
    database: {
      name: metaRow?.database_name ?? null,
      postgresVersion: metaRow?.postgres_version ?? null,
    },
    summary: {
      totalClients: clients.length,
      totalProposals: proposals.length,
      totalClientAuditRows: clientAuditLog.length,
    },
    data: {
      clients,
      proposals,
      clientAuditLog,
      appUserAccess: users,
    },
  }
}

const CLIENT_COLUMNS = [
  'id', 'user_id', 'name', 'document', 'email', 'phone', 'city', 'state', 'address', 'uc',
  'distribuidora', 'metadata', 'created_at', 'updated_at', 'tipo', 'nome_razao', 'telefone_secundario',
  'logradouro', 'numero', 'complemento', 'bairro', 'cep', 'origem', 'observacoes', 'responsavel_id',
  'cpf_normalized', 'cpf_raw', 'identity_status', 'merged_into_client_id', 'created_by_user_id',
  'owner_user_id', 'origin', 'last_synced_at', 'deleted_at', 'offline_origin_id', 'search_text',
  'cnpj_normalized', 'cnpj_raw', 'document_type',
]

const PROPOSAL_COLUMNS = [
  'id', 'proposal_type', 'proposal_code', 'version', 'status', 'owner_user_id', 'owner_email',
  'owner_display_name', 'created_by_user_id', 'updated_by_user_id', 'client_name', 'client_document',
  'client_city', 'client_state', 'client_phone', 'client_email', 'consumption_kwh_month', 'system_kwp',
  'capex_total', 'contract_value', 'term_months', 'payload_json', 'created_at', 'updated_at', 'deleted_at',
  'client_id', 'offline_origin_id', 'is_pending_sync', 'is_conflicted', 'conflict_reason', 'synced_at',
  'uc_geradora_numero', 'draft_source',
]

const columnCache = new Map()

async function getExistingColumns(sql, tableName) {
  const cacheKey = tableName
  const cached = columnCache.get(cacheKey)
  if (cached) return cached
  const rows = await sql`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ${tableName}
  `
  const columns = new Set(rows.map((row) => row.column_name))
  columnCache.set(cacheKey, columns)
  return columns
}

function pickColumns(record, columns) {
  const base = sanitizeObject(record)
  if (!base) return null
  const picked = {}
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(base, column)) {
      picked[column] = base[column]
    }
  }
  return picked
}

async function upsertClient(sql, rawClient, actorUserId) {
  const existing = await getExistingColumns(sql, 'clients')
  const activeColumns = CLIENT_COLUMNS.filter((column) => existing.has(column))
  const client = pickColumns(rawClient, activeColumns)
  if (!client?.name) return false

  if (!client.owner_user_id && activeColumns.includes('owner_user_id')) client.owner_user_id = actorUserId
  if (!client.created_by_user_id && activeColumns.includes('created_by_user_id')) client.created_by_user_id = actorUserId
  if (!client.user_id && activeColumns.includes('user_id')) client.user_id = actorUserId

  // Insert new rows when ID is absent in import files (xlsx/csv).
  if (!client.id) {
    const insertColumns = activeColumns.filter((column) => column !== 'id')
    const values = insertColumns.map((column) => client[column] ?? null)
    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ')
    await sql(`INSERT INTO public.clients (${insertColumns.join(', ')}) VALUES (${placeholders})`, values)
    return true
  }

  const values = activeColumns.map((column) => client[column] ?? null)
  const updates = activeColumns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(', ')

  const placeholders = activeColumns.map((_, index) => `$${index + 1}`).join(', ')
  const insertSql = `
    INSERT INTO public.clients (${activeColumns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updates}
  `

  try {
    await sql(insertSql, values)
  } catch (error) {
    if (error?.code === '23505' && client.cpf_normalized) {
      await sql(
        `
          UPDATE public.clients
             SET name = $1,
                 document = $2,
                 email = $3,
                 phone = $4,
                 city = $5,
                 state = $6,
                 address = $7,
                 uc = $8,
                 distribuidora = $9,
                 metadata = $10::jsonb,
                 updated_at = COALESCE($11::timestamptz, now())
           WHERE cpf_normalized = $12
        `,
        [
          client.name,
          client.document,
          client.email,
          client.phone,
          client.city,
          client.state,
          client.address,
          client.uc,
          client.distribuidora,
          client.metadata ? JSON.stringify(client.metadata) : null,
          client.updated_at,
          client.cpf_normalized,
        ],
      )
      return true
    }
    throw error
  }
  return true
}

async function upsertProposal(sql, rawProposal, actorUserId) {
  const existing = await getExistingColumns(sql, 'proposals')
  const activeColumns = PROPOSAL_COLUMNS.filter((column) => existing.has(column))
  const proposal = pickColumns(rawProposal, activeColumns)
  if (!proposal?.proposal_type) return false
  if (!proposal.owner_user_id && activeColumns.includes('owner_user_id')) proposal.owner_user_id = actorUserId
  if (!proposal.created_by_user_id && activeColumns.includes('created_by_user_id')) proposal.created_by_user_id = actorUserId

  if (!proposal.id) {
    const insertColumns = activeColumns.filter((column) => column !== 'id')
    const values = insertColumns.map((column) => proposal[column] ?? null)
    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ')
    await sql(`INSERT INTO public.proposals (${insertColumns.join(', ')}) VALUES (${placeholders})`, values)
    return true
  }

  const values = activeColumns.map((column) => proposal[column] ?? null)
  const updates = activeColumns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(', ')
  const placeholders = activeColumns.map((_, index) => `$${index + 1}`).join(', ')

  await sql(
    `
      INSERT INTO public.proposals (${activeColumns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updates}
    `,
    values,
  )
  return true
}

async function restoreBackupPayload(sql, payload, actor) {
  const backupObject = sanitizeObject(payload)
  if (!backupObject) {
    throw new Error('Payload de backup inválido.')
  }
  const data = sanitizeObject(backupObject.data)
  if (!data) {
    throw new Error('Payload sem bloco "data".')
  }

  const clients = Array.isArray(data.clients) ? data.clients : []
  const proposals = Array.isArray(data.proposals) ? data.proposals : []

  const result = {
    clientsInserted: 0,
    clientsUpdated: 0,
    clientsSkipped: 0,
    proposalsInserted: 0,
    proposalsUpdated: 0,
    proposalsSkipped: 0,
    failures: [],
  }

  await withTransaction(sql, async () => {
    for (const client of clients) {
      try {
        const ok = await upsertClient(sql, client, actor.userId)
        if (ok) result.clientsInserted += 1
        else result.clientsSkipped += 1
      } catch (error) {
        result.failures.push({
          entity: 'client',
          key: client?.id ?? client?.name ?? 'unknown',
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
    for (const proposal of proposals) {
      try {
        const ok = await upsertProposal(sql, proposal, actor.userId)
        if (ok) result.proposalsInserted += 1
        else result.proposalsSkipped += 1
      } catch (error) {
        result.failures.push({
          entity: 'proposal',
          key: proposal?.id ?? proposal?.proposal_code ?? 'unknown',
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
    await sql(`
      SELECT setval(
        pg_get_serial_sequence('public.clients', 'id'),
        COALESCE((SELECT MAX(id) FROM public.clients), 1),
        true
      )
    `)
  })

  await ensureBackupTable(sql)
  await sql`
    INSERT INTO public.db_backup_snapshots (
      actor_user_id,
      actor_email,
      destination,
      checksum_sha256,
      backup_payload
    ) VALUES (
      ${actor.userId},
      ${actor.email ?? null},
      'import',
      ${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')},
      ${JSON.stringify({
        importedAt: new Date().toISOString(),
        importedBy: actor.userId,
        summary: {
          clientsInserted: result.clientsInserted,
          proposalsInserted: result.proposalsInserted,
          failures: result.failures.length,
        },
      })}::jsonb
    )
  `

  return result
}

async function ensureBackupTable(sql) {
  await sql(`
    CREATE TABLE IF NOT EXISTS public.${BACKUP_TABLE} (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_email TEXT,
      destination TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      backup_payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function persistPlatformBackup(sql, actor, payload, checksum) {
  await ensureBackupTable(sql)

  await sql`
    INSERT INTO public.db_backup_snapshots (
      actor_user_id,
      actor_email,
      destination,
      checksum_sha256,
      backup_payload
    ) VALUES (
      ${actor.userId},
      ${actor.email ?? null},
      'platform',
      ${checksum},
      ${JSON.stringify(payload)}::jsonb
    )
  `

  await sql`
    DELETE FROM public.db_backup_snapshots
     WHERE actor_user_id = ${actor.userId}
       AND id NOT IN (
         SELECT id
           FROM public.db_backup_snapshots
          WHERE actor_user_id = ${actor.userId}
          ORDER BY created_at DESC
          LIMIT ${MAX_PLATFORM_BACKUPS_PER_USER}
       )
  `
}

export async function handleDatabaseBackupRequest(req, res, { sendJson, body }) {
  return handleDatabaseBackupExportRequest(req, res, { sendJson, body })
}

async function resolveAndValidateBackupActor(req, res, sendJson) {
  console.info('[auth-check]', {
    hasAuthorizationHeader: Boolean(req.headers?.authorization),
    hasStackAccessToken: Boolean(req.headers?.['x-stack-access-token']),
  })
  let actor
  try {
    actor = await resolveActor(req)
  } catch {
    sendJson(res, 401, { ok: false, error: 'Autenticação obrigatória.' })
    return null
  }

  if (!actor?.userId) {
    sendJson(res, 401, { ok: false, error: 'Autenticação obrigatória.' })
    return null
  }

  if (!actor.isAdmin && !actor.isOffice) {
    sendJson(res, 403, { ok: false, error: 'Apenas perfis Admin e Office podem exportar/importar backup.' })
    return null
  }

  const db = getDatabaseClient()
  if (!db?.sql) {
    sendJson(res, 503, { ok: false, error: 'Banco de dados não configurado.' })
    return null
  }
  try {
    await ensureOperationalSchema(db.sql)
  } catch (error) {
    console.warn('[database-backup][schema]', { message: error?.message ?? String(error) })
  }
  return { actor, db }
}

export async function handleDatabaseBackupExportRequest(req, res, { sendJson, body }) {
  const context = await resolveAndValidateBackupActor(req, res, sendJson)
  if (!context) return
  const { actor, db } = context

  const destination = parseDestination(body?.destination)

  try {
    const payload = await buildBackupPayload(db.sql, actor)
    const serialized = JSON.stringify(payload)
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex')

    if (destination === 'platform') {
      await persistPlatformBackup(db.sql, actor, payload, checksum)
    }

    sendJson(res, 200, {
      ok: true,
      destination,
      fileName: `solarinvest-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      checksumSha256: checksum,
      platformSaved: destination === 'platform',
      payload,
    })
  } catch (error) {
    console.error('[database-backup][export]', {
      step: 'generate_backup',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    sendJson(res, 500, {
      ok: false,
      error: 'DATABASE_BACKUP_EXPORT_FAILED',
      message: 'Falha ao gerar backup do banco.',
    })
  }
}

function normalizeImportSelection(selection, fallbackList = []) {
  if (!Array.isArray(selection) || selection.length === 0) return fallbackList
  return selection
    .filter((entry) => entry && typeof entry === 'object' && entry.selected === true && entry.status !== 'invalid')
    .map((entry) => (entry.data && typeof entry.data === 'object' ? entry.data : null))
    .filter(Boolean)
}

function assertValidImportBody(body) {
  if (!body || typeof body !== 'object') throw new Error('IMPORT_BODY_INVALID')
  if (!body.selection || typeof body.selection !== 'object') throw new Error('IMPORT_SELECTION_MISSING')
  if (!Array.isArray(body.selection.clients)) throw new Error('IMPORT_CLIENTS_ARRAY_MISSING')
  if (!Array.isArray(body.selection.proposals)) throw new Error('IMPORT_PROPOSALS_ARRAY_MISSING')
}

export async function handleDatabaseBackupImportRequest(req, res, { sendJson, body }) {
  console.info('[backup-import] request received', {
    method: req.method,
    hasBody: Boolean(body),
    bodyType: typeof body,
    hasAuthorization: Boolean(req.headers?.authorization),
    contentType: req.headers?.['content-type'] ?? null,
  })
  const context = await resolveAndValidateBackupActor(req, res, sendJson)
  if (!context) return
  const { actor, db } = context

  const rawPayload = body?.payload && typeof body.payload === 'object' ? body.payload : body
  try {
    assertValidImportBody(rawPayload)
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : 'IMPORT_BODY_INVALID',
      message: 'Payload de importação inválido.',
    })
    return
  }
  const selection = rawPayload?.selection && typeof rawPayload.selection === 'object' ? rawPayload.selection : null
  const selectedClients = normalizeImportSelection(selection?.clients, rawPayload?.data?.clients ?? [])
  const selectedProposals = normalizeImportSelection(selection?.proposals, rawPayload?.data?.proposals ?? [])
  console.info('[backup-import] payload summary', {
    clientsCount: selectedClients.length,
    proposalsCount: selectedProposals.length,
    sourceType: rawPayload?.meta?.sourceType ?? null,
    sheetNameUsed: rawPayload?.meta?.sheetNameUsed ?? null,
  })
  const importPayload = { data: { clients: selectedClients, proposals: selectedProposals } }

  try {
    const importResult = await restoreBackupPayload(db.sql, importPayload, actor)
    const partial = importResult.failures.length > 0
    sendJson(res, 200, {
      ok: true,
      partial,
      report: {
        clientsInserted: importResult.clientsInserted,
        clientsUpdated: importResult.clientsUpdated,
        clientsSkipped: importResult.clientsSkipped,
        proposalsInserted: importResult.proposalsInserted,
        proposalsUpdated: importResult.proposalsUpdated,
        proposalsSkipped: importResult.proposalsSkipped,
        failures: importResult.failures,
      },
      importedClients: importResult.clientsInserted,
      importedProposals: importResult.proposalsInserted,
    })
  } catch (error) {
    console.error('[database-backup][import]', {
      step: 'restore_payload',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    sendJson(res, 500, {
      ok: false,
      error: 'DATABASE_BACKUP_IMPORT_FAILED',
      message: error instanceof Error && error.message ? error.message : 'Falha ao importar backup.',
    })
  }
}
