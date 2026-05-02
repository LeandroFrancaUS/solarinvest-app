/**
 * pre-deploy-snapshot.mjs
 *
 * Captures a pre-deploy integrity snapshot of the production database and
 * writes it to a JSON file for later comparison by post-deploy-verify.mjs.
 *
 * Each table entry includes:
 *   - total            : COUNT(*)
 *   - totalDistinctIds : COUNT(DISTINCT id)
 *   - totalAmount      : SUM(<amount_column>) when applicable (null otherwise)
 *
 * Usage:
 *   node scripts/pre-deploy-snapshot.mjs
 *
 * Environment variables:
 *   DATABASE_URL_UNPOOLED  (preferred — direct Neon connection)
 *   DATABASE_URL           (fallback pooler connection)
 *   SNAPSHOT_FILE          (default: tmp/pre-deploy-counts.json)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Connection ────────────────────────────────────────────────────────────────

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL

if (!connectionString) {
  console.error('[snapshot] ERROR: no database connection string found.')
  console.error('[snapshot] Set DATABASE_URL_UNPOOLED or DATABASE_URL.')
  process.exit(1)
}

const sql = neon(connectionString)

// ── Allowlists (prevent injection if caller passes untrusted opts) ─────────────

const ALLOWED_TABLE_NAMES = new Set([
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function tableExists(tableName) {
  const [row] = await sql`
    SELECT to_regclass(${'public.' + tableName}) AS full_name
  `
  return Boolean(row?.full_name)
}

/**
 * Returns { total, totalDistinctIds, totalAmount } for a table.
 * Returns zero-values if the table does not exist yet.
 */
async function aggregateTable(tableName, opts = {}) {
  if (!ALLOWED_TABLE_NAMES.has(tableName)) {
    throw new Error(`[snapshot] Table '${tableName}' not in allowlist — refusing to query.`)
  }
  if (opts.sumColumn && !ALLOWED_SUM_COLUMNS.has(opts.sumColumn)) {
    throw new Error(`[snapshot] sumColumn '${opts.sumColumn}' not in allowlist — refusing to query.`)
  }

  const exists = await tableExists(tableName)
  if (!exists) {
    console.warn(`[snapshot] Table public.${tableName} not found — recording zeros.`)
    return { total: 0, totalDistinctIds: 0, totalAmount: null }
  }

  const whereClause = opts.filterDeleted ? 'WHERE deleted_at IS NULL' : ''
  const sumExpr = opts.sumColumn
    ? `, COALESCE(SUM(${opts.sumColumn}), 0) AS total_amount`
    : ''

  const query = `
    SELECT
      COUNT(*)           AS total,
      COUNT(DISTINCT id) AS total_distinct_ids
      ${sumExpr}
    FROM public.${tableName}
    ${whereClause}
  `

  const [row] = await sql(query)
  return {
    total: Number(row?.total ?? 0),
    totalDistinctIds: Number(row?.total_distinct_ids ?? 0),
    totalAmount: opts.sumColumn ? Number(row?.total_amount ?? 0) : null,
  }
}

// ── Table definitions ─────────────────────────────────────────────────────────
//
// Each entry: [tableName, options]
// options.sumColumn      — column to SUM (financial integrity check)
// options.filterDeleted  — skip soft-deleted rows (deleted_at IS NULL)

const TABLES = [
  ['clients',                   {}],
  ['proposals',                 {}],
  ['client_contracts',          {}],
  ['projects',                  { filterDeleted: true }],
  ['client_invoices',           { sumColumn: 'amount' }],
  ['financial_entries',         { sumColumn: 'amount', filterDeleted: true }],
  ['dashboard_operational_tasks', {}],
  ['schema_migrations',         {}],
  ['client_audit_log',          {}],
  ['app_user_access',           {}],
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('[snapshot] Connecting to database…')

  const [metaRow] = await sql`
    SELECT
      now()               AS captured_at,
      current_database()  AS database_name,
      version()           AS postgres_version
  `

  console.log(`[snapshot] Connected to: ${metaRow.database_name}`)
  console.log(`[snapshot] Capturing counts for ${TABLES.length} tables…`)

  const tables = {}
  for (const [tableName, opts] of TABLES) {
    process.stdout.write(`[snapshot]   ${tableName}… `)
    const metrics = await aggregateTable(tableName, opts)
    tables[tableName] = metrics
    const parts = [`total=${metrics.total}`, `distinct=${metrics.totalDistinctIds}`]
    if (metrics.totalAmount !== null) parts.push(`sum_amount=${metrics.totalAmount}`)
    console.log(parts.join(', '))
  }

  const snapshot = {
    capturedAt: metaRow.captured_at,
    databaseName: metaRow.database_name,
    postgresVersion: metaRow.postgres_version,
    tables,
  }

  // ── Write output ────────────────────────────────────────────────────────────
  const outputFile = process.env.SNAPSHOT_FILE
    ? path.resolve(process.env.SNAPSHOT_FILE)
    : path.join(ROOT, 'tmp', 'pre-deploy-counts.json')

  const outputDir = path.dirname(outputFile)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputFile, JSON.stringify(snapshot, null, 2), 'utf8')
  console.log(`[snapshot] Snapshot written to: ${outputFile}`)
  console.log('[snapshot] Done.')
}

run().catch((error) => {
  console.error('[snapshot] Fatal error:', error.message)
  process.exit(1)
})
