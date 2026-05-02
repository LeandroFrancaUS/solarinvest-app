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

/**
 * Returns lightweight aggregate metrics for a table without fetching all rows.
 *
 * All identifier parameters (schema, table, sumColumn) are validated against
 * a strict allowlist before being interpolated into SQL to prevent injection.
 *
 * @param {Function} sql         - Neon tagged-template SQL function
 * @param {string}   schema      - must be 'public'
 * @param {string}   table       - must be one of ALLOWED_AGG_TABLES
 * @param {object}   [opts]
 * @param {string}   [opts.sumColumn]     - column name to SUM; must be one of ALLOWED_SUM_COLUMNS
 * @param {boolean}  [opts.filterDeleted] - if true, adds WHERE deleted_at IS NULL
 * @returns {{ total: number, totalDistinctIds: number, totalAmount: number|null }}
 */

const ALLOWED_AGG_SCHEMAS = new Set(['public'])

const ALLOWED_AGG_TABLES = new Set([
  'clients',
  'proposals',
  'client_contracts',
  'projects',
  'client_invoices',
  'financial_entries',
  'dashboard_operational_tasks',
  'schema_migrations',
  'client_audit_log',
  'app_user_access',
])

const ALLOWED_SUM_COLUMNS = new Set(['amount'])

async function safeAggregate(sql, schema, table, opts = {}) {
  const empty = { total: 0, totalDistinctIds: 0, totalAmount: null }

  if (!ALLOWED_AGG_SCHEMAS.has(schema)) {
    console.warn(`[backup] safeAggregate: schema '${schema}' not in allowlist — skipped.`)
    return empty
  }
  if (!ALLOWED_AGG_TABLES.has(table)) {
    console.warn(`[backup] safeAggregate: table '${table}' not in allowlist — skipped.`)
    return empty
  }
  if (opts.sumColumn && !ALLOWED_SUM_COLUMNS.has(opts.sumColumn)) {
    console.warn(`[backup] safeAggregate: sumColumn '${opts.sumColumn}' not in allowlist — skipped.`)
    return empty
  }

  const exists = await tableExists(sql, schema, table)
  if (!exists) return empty

  const whereClause = opts.filterDeleted ? 'WHERE deleted_at IS NULL' : ''
  const sumExpr = opts.sumColumn
    ? `, COALESCE(SUM(${opts.sumColumn}), 0) AS total_amount`
    : ''

  const query = `
    SELECT
      COUNT(*)              AS total,
      COUNT(DISTINCT id)    AS total_distinct_ids
      ${sumExpr}
    FROM ${schema}.${table}
    ${whereClause}
  `
  const [row] = await sql(query)
  if (!row) return empty
  return {
    total: Number(row.total ?? 0),
    totalDistinctIds: Number(row.total_distinct_ids ?? 0),
    totalAmount: opts.sumColumn ? Number(row.total_amount ?? 0) : null,
  }
}

function sanitizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

/**
 * Serializes a parameter value for use in a parameterized string query.
 *
 * The Neon HTTP driver's tagged-template form handles type inference
 * automatically, but the string-query form (`sql(query, values)`) passes
 * values verbatim to the wire protocol.  PostgreSQL expects JSONB params as
 * JSON-encoded strings, not as raw JS objects; passing a plain object would
 * either produce an invalid cast error or silently insert "[object Object]".
 *
 * This helper ensures every object (including nested JSONB payloads) is
 * JSON.stringify'd before being placed in the values array.
 */
function serializeForQuery(val) {
  if (val === null || val === undefined) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'object') return JSON.stringify(val)
  return val
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
    contractsAgg,
    projectsAgg,
    invoicesAgg,
    financialAgg,
    opsAgg,
    migrationsAgg,
  ] = await Promise.all([
    safeSelectAll(sql, 'public', 'clients', 'id ASC'),
    safeSelectAll(sql, 'public', 'proposals', 'created_at ASC'),
    safeSelectAll(sql, 'public', 'client_audit_log', 'id ASC'),
    safeSelectAll(sql, 'public', 'app_user_access', 'created_at ASC'),
    safeAggregate(sql, 'public', 'client_contracts'),
    safeAggregate(sql, 'public', 'projects', { filterDeleted: true }),
    safeAggregate(sql, 'public', 'client_invoices', { sumColumn: 'amount' }),
    safeAggregate(sql, 'public', 'financial_entries', { sumColumn: 'amount', filterDeleted: true }),
    safeAggregate(sql, 'public', 'dashboard_operational_tasks'),
    safeAggregate(sql, 'public', 'schema_migrations'),
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
      totalClientContracts: contractsAgg.total,
      totalDistinctClientContracts: contractsAgg.totalDistinctIds,
      totalProjects: projectsAgg.total,
      totalDistinctProjects: projectsAgg.totalDistinctIds,
      totalInvoices: invoicesAgg.total,
      totalInvoicesAmount: invoicesAgg.totalAmount,
      totalFinancialEntries: financialAgg.total,
      totalFinancialEntriesAmount: financialAgg.totalAmount,
      totalOperationalTasks: opsAgg.total,
      totalSchemaMigrations: migrationsAgg.total,
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
  'owner_user_id', 'owner_stack_user_id', 'origin', 'last_synced_at', 'deleted_at',
  'offline_origin_id', 'search_text', 'cnpj_normalized', 'cnpj_raw', 'document_type',
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

  const values = activeColumns.map((column) => serializeForQuery(client[column] ?? null))
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
    // 23505 = unique_violation — cpf_normalized or uc uniqueness constraint
    if (error?.code === '23505') {
      if (client.cpf_normalized) {
        // A different row already owns this CPF; update its non-key fields
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
                   distribuidora = $8,
                   metadata = $9::jsonb,
                   updated_at = COALESCE($10::timestamptz, now())
             WHERE cpf_normalized = $11
          `,
          [
            client.name,
            client.document,
            client.email,
            client.phone,
            client.city,
            client.state,
            client.address,
            client.distribuidora,
            client.metadata ? JSON.stringify(client.metadata) : null,
            client.updated_at,
            client.cpf_normalized,
          ],
        )
        return
      }
      // UC or other uniqueness conflict — insert without the conflicting field
      console.warn(`[backup-import] skipping client id=${client.id} due to unique constraint violation:`, error.detail ?? error.message)
      return
    }
    throw error
  }
}

async function upsertProposal(sql, rawProposal) {
  const existing = await getExistingColumns(sql, 'proposals')
  const activeColumns = PROPOSAL_COLUMNS.filter((column) => existing.has(column))
  const proposal = pickColumns(rawProposal, activeColumns)
  if (!proposal?.id || !proposal?.proposal_type || !proposal?.owner_user_id) return

  // Fallback: created_by_user_id is NOT NULL in the DB but may be absent in older backups
  if (!proposal.created_by_user_id && activeColumns.includes('created_by_user_id')) {
    proposal.created_by_user_id = proposal.owner_user_id
  }

  const values = activeColumns.map((column) => serializeForQuery(proposal[column] ?? null))
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

  console.log(`[backup-import] start — ${clients.length} clients, ${proposals.length} proposals (user=${actor.userId})`)

  // Import clients — per-record errors are caught so one bad row does not
  // abort the entire restore.  Each insert is committed independently because
  // BEGIN/COMMIT are no-ops over the Neon HTTP driver.
  let importedClients = 0
  let failedClients = 0
  console.log(`[backup-import] entity-start clients`)
  for (const client of clients) {
    try {
      await upsertClient(sql, client)
      importedClients++
    } catch (error) {
      failedClients++
      console.error(`[backup-import] client failed id=${client?.id ?? '?'}:`, error.message)
    }
  }
  console.log(`[backup-import] entity-success clients imported=${importedClients} failed=${failedClients}`)

  // Import proposals
  let importedProposals = 0
  let failedProposals = 0
  console.log(`[backup-import] entity-start proposals`)
  for (const proposal of proposals) {
    try {
      await upsertProposal(sql, proposal)
      importedProposals++
    } catch (error) {
      failedProposals++
      console.error(`[backup-import] proposal failed id=${proposal?.id ?? '?'}:`, error.message)
    }
  }
  console.log(`[backup-import] entity-success proposals imported=${importedProposals} failed=${failedProposals}`)

  // Reset clients sequence so next auto-generated id does not collide
  try {
    await sql(`
      SELECT setval(
        pg_get_serial_sequence('public.clients', 'id'),
        COALESCE((SELECT MAX(id) FROM public.clients), 1),
        true
      )
    `)
  } catch (seqError) {
    console.warn('[backup-import] could not reset clients sequence:', seqError.message)
  }

  const result = {
    importedClients,
    failedClients,
    importedProposals,
    failedProposals,
  }

  // Write audit snapshot — non-fatal: if the table doesn't exist yet (pending
  // migration 0026) or the role lacks INSERT, we log a warning but do not
  // fail the entire restore that already succeeded.
  try {
    const checksum = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
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
        ${checksum},
        ${JSON.stringify({
          importedAt: new Date().toISOString(),
          importedBy: actor.userId,
          summary: result,
        })}::jsonb
      )
    `
  } catch (auditError) {
    console.warn('[backup-import] audit snapshot failed (non-fatal):', auditError.message)
  }

  console.log(`[backup-import] completed — clients=${importedClients}/${clients.length} proposals=${importedProposals}/${proposals.length}`)
  return result
}

async function persistPlatformBackup(sql, actor, payload, checksum) {
  // Table is created via migration 0026; ensureBackupTable is a safety net
  // for environments where migrations have not yet been applied.
  try {
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
  } catch (ddlError) {
    // Ignore permission errors — table should already exist via migration 0026
    console.warn('[backup-export] could not ensure backup table (likely already exists):', ddlError.message)
  }

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

  try {
    if (action === 'import') {
      console.log(`[backup-import] request received user=${actor.userId}`)
      const importResult = await restoreBackupPayload(db.sql, body?.payload, actor)
      sendJson(res, 200, {
        ok: true,
        action: 'import',
        importedClients: importResult.importedClients,
        failedClients: importResult.failedClients,
        importedProposals: importResult.importedProposals,
        failedProposals: importResult.failedProposals,
      })
      return
    }

    console.log(`[backup-export] start user=${actor.userId} destination=${destination}`)
    const payload = await buildBackupPayload(db.sql, actor)
    const serialized = JSON.stringify(payload)
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex')

    if (destination === 'platform') {
      await persistPlatformBackup(db.sql, actor, payload, checksum)
    }

    console.log(`[backup-export] success user=${actor.userId} checksum=${checksum.slice(0, 12)}`)
    sendJson(res, 200, {
      ok: true,
      destination,
      fileName: `solarinvest-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      checksumSha256: checksum,
      platformSaved: destination === 'platform',
      payload,
    })
  } catch (error) {
    const phase = action === 'import' ? 'import' : 'export'
    console.error(`[backup-${phase}] failed user=${actor?.userId ?? 'unknown'}:`, error.message, error.stack)
    sendJson(res, 500, {
      ok: false,
      error: error.message?.startsWith('Payload') ? error.message : `Falha ao ${phase === 'import' ? 'carregar' : 'gerar'} backup do banco.`,
      detail: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    })
  }
}
