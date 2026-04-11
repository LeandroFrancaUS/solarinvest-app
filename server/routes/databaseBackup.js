import crypto from 'node:crypto'
import { getDatabaseClient } from '../database/neonClient.js'
import { resolveActor } from '../proposals/permissions.js'

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

function parseAction(value) {
  if (typeof value !== 'string') return 'export'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'import' || normalized === 'restore') return 'import'
  return 'export'
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

async function upsertClient(sql, rawClient) {
  const existing = await getExistingColumns(sql, 'clients')
  const activeColumns = CLIENT_COLUMNS.filter((column) => existing.has(column))
  const client = pickColumns(rawClient, activeColumns)
  if (!client?.id || !client?.name) return

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
      return
    }
    throw error
  }
}

async function upsertProposal(sql, rawProposal) {
  const existing = await getExistingColumns(sql, 'proposals')
  const activeColumns = PROPOSAL_COLUMNS.filter((column) => existing.has(column))
  const proposal = pickColumns(rawProposal, activeColumns)
  if (!proposal?.id || !proposal?.proposal_type || !proposal?.owner_user_id || !proposal?.created_by_user_id) return

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

  const result = await withTransaction(sql, async () => {
    for (const client of clients) {
      await upsertClient(sql, client)
    }
    for (const proposal of proposals) {
      await upsertProposal(sql, proposal)
    }
    await sql(`
      SELECT setval(
        pg_get_serial_sequence('public.clients', 'id'),
        COALESCE((SELECT MAX(id) FROM public.clients), 1),
        true
      )
    `)
    return { importedClients: clients.length, importedProposals: proposals.length }
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
        summary: result,
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
  let actor
  try {
    actor = await resolveActor(req)
  } catch {
    sendJson(res, 401, { ok: false, error: 'Autenticação obrigatória.' })
    return
  }

  if (!actor?.userId) {
    sendJson(res, 401, { ok: false, error: 'Autenticação obrigatória.' })
    return
  }

  if (!actor.isAdmin && !actor.isOffice) {
    sendJson(res, 403, { ok: false, error: 'Apenas perfis Admin e Office podem gerar backup.' })
    return
  }

  const db = getDatabaseClient()
  if (!db?.sql) {
    sendJson(res, 503, { ok: false, error: 'Banco de dados não configurado.' })
    return
  }

  const action = parseAction(body?.action)
  const destination = parseDestination(body?.destination)

  if (action === 'import') {
    try {
      const importResult = await restoreBackupPayload(db.sql, body?.payload, actor)
      sendJson(res, 200, {
        ok: true,
        action: 'import',
        importedClients: importResult.importedClients,
        importedProposals: importResult.importedProposals,
      })
    } catch (error) {
      console.error('[backup][import] failed to restore backup:', {
        actorId: actor.userId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      sendJson(res, 500, {
        ok: false,
        error: 'IMPORT_BACKUP_FAILED',
        message: 'Falha ao importar o backup. Verifique se o arquivo é um backup válido do SolarInvest.',
        details: error instanceof Error ? error.message : String(error),
      })
    }
    return
  }

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
    console.error('[backup][export] failed to generate backup:', {
      actorId: actor.userId,
      destination,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    sendJson(res, 500, {
      ok: false,
      error: 'EXPORT_BACKUP_FAILED',
      message: 'Falha ao gerar backup do banco.',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

// ─── Preview-based import endpoint ────────────────────────────────────────────
// POST /api/admin/database-backup/import
// Accepts the selection payload produced by the ImportBackupPreviewModal.
// Each item in selection.clients / selection.proposals is a NormalizedImportRow
// (fields: nome, documento, cidade, uf, telefone, email, consumoKwh, entityType, rowIndex, raw).
//
// Returns: { ok, report: { clientsInserted, clientsSkipped, failures: [] } }

function mapNormalizedRowToClient(row) {
  if (!row || typeof row !== 'object') return null
  const name = String(row.nome ?? row.name ?? '').trim()
  if (!name) return null

  return {
    name,
    document: row.documento ?? row.document ?? null,
    city: row.cidade ?? row.city ?? null,
    state: row.uf ?? row.state ?? null,
    phone: row.telefone ?? row.phone ?? null,
    email: row.email ?? null,
    metadata: row.consumoKwh != null ? { consumoKwh: row.consumoKwh } : null,
  }
}

export async function handleDatabaseBackupImportV2Request(req, res, { sendJson, body }) {
  console.info('[backup-import-v2] request received', {
    method: req.method,
    hasBody: !!body,
    hasAuthorization: !!req.headers.authorization,
    contentType: req.headers['content-type'],
  })

  // ── Authentication ─────────────────────────────────────────────────────────
  let actor
  try {
    actor = await resolveActor(req)
  } catch {
    sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Autenticação obrigatória.' })
    return
  }

  if (!actor?.userId) {
    sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Autenticação obrigatória.' })
    return
  }

  // ── Authorization ──────────────────────────────────────────────────────────
  if (!actor.isAdmin && !actor.isOffice && !actor.isFinanceiro) {
    sendJson(res, 403, {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Apenas perfis Admin, Office e Financeiro podem importar clientes.',
    })
    return
  }

  // ── Payload validation ─────────────────────────────────────────────────────
  if (!body || typeof body !== 'object') {
    sendJson(res, 400, { ok: false, error: 'IMPORT_BODY_INVALID', message: 'Payload de importação inválido.' })
    return
  }

  const selection = body.selection
  if (!selection || typeof selection !== 'object') {
    sendJson(res, 400, { ok: false, error: 'IMPORT_SELECTION_MISSING', message: 'Campo "selection" ausente no payload.' })
    return
  }

  if (!Array.isArray(selection.clients)) {
    sendJson(res, 400, { ok: false, error: 'IMPORT_CLIENTS_ARRAY_MISSING', message: 'Campo "selection.clients" deve ser um array.' })
    return
  }

  const selectedClients = selection.clients.filter((item) => item && (item.selected !== false))
  const selectedProposals = Array.isArray(selection.proposals)
    ? selection.proposals.filter((item) => item && (item.selected !== false))
    : []

  console.info('[backup-import-v2] payload summary', {
    actorId: actor.userId,
    totalClients: selectedClients.length,
    totalProposals: selectedProposals.length,
    sourceType: body.meta?.sourceType ?? null,
    fileName: body.meta?.fileName ?? null,
  })

  // ── Database ───────────────────────────────────────────────────────────────
  const db = getDatabaseClient()
  if (!db?.sql) {
    sendJson(res, 503, { ok: false, error: 'DB_UNAVAILABLE', message: 'Banco de dados não configurado.' })
    return
  }

  const report = {
    clientsInserted: 0,
    clientsSkipped: 0,
    proposalsInserted: 0,
    proposalsSkipped: 0,
    failures: [],
  }

  try {
    for (const item of selectedClients) {
      // item may be a plain NormalizedImportRow or an ImportPreviewRow whose .data holds the row
      const rawRow = item.data ?? item
      const client = mapNormalizedRowToClient(rawRow)

      if (!client) {
        report.clientsSkipped += 1
        continue
      }

      try {
        await upsertClient(db.sql, client)
        report.clientsInserted += 1
      } catch (itemError) {
        const key = client.name ?? String(item.rowIndex ?? 'unknown')
        console.warn('[backup-import-v2] client upsert failed', {
          key,
          error: itemError instanceof Error ? itemError.message : String(itemError),
        })
        report.failures.push({
          entity: 'client',
          key,
          reason: itemError instanceof Error ? itemError.message : String(itemError),
        })
      }
    }

    // Proposals import is a future feature; skip gracefully for now.
    report.proposalsSkipped = selectedProposals.length

    // Reset client id sequence so future inserts don't collide.
    if (report.clientsInserted > 0) {
      try {
        await db.sql(`
          SELECT setval(
            pg_get_serial_sequence('public.clients', 'id'),
            COALESCE((SELECT MAX(id) FROM public.clients), 1),
            true
          )
        `)
      } catch {
        // Non-fatal — sequence reset is a best-effort operation.
      }
    }

    console.info('[backup-import-v2] completed', { actorId: actor.userId, report })

    sendJson(res, 200, { ok: true, report })
  } catch (error) {
    console.error('[backup-import-v2] unexpected failure', {
      actorId: actor.userId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    sendJson(res, 500, {
      ok: false,
      error: 'BACKUP_IMPORT_V2_FAILED',
      message: error instanceof Error ? error.message : 'Falha ao importar backup.',
    })
  }
}
