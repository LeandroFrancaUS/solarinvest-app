/**
 * Pre-Deploy Snapshot
 *
 * Captures row counts from critical production tables before database
 * migrations are applied. The snapshot is written to the path specified by
 * DEPLOY_SNAPSHOT_PATH (default: /tmp/deploy-snapshot.json) and is read by
 * post-deploy-verify.mjs after the deploy completes.
 *
 * Requires DATABASE_URL_UNPOOLED (or DATABASE_URL / NEON_DATABASE_URL) to be
 * set in the environment.
 *
 * Exit codes:
 *   0 — snapshot captured successfully
 *   1 — database connection failed or query error
 */

import fs from 'fs'
import { neon } from '@neondatabase/serverless'

const SNAPSHOT_PATH = process.env.DEPLOY_SNAPSHOT_PATH ?? '/tmp/deploy-snapshot.json'

/** Ordered list of tables to count. All must exist on the production schema. */
const TABLES = [
  'clients',
  'proposals',
  'storage',
  'projects',
  'financial_entries',
  'app_user_access',
  'operational_tasks',
  'schema_migrations',
]

function resolveConnectionString() {
  return (
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.NEON_DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    process.env.NEON_DATABASE_URL ??
    ''
  )
}

async function run() {
  const connectionString = resolveConnectionString()
  if (!connectionString) {
    console.error(
      '[snapshot] No database connection string found.\n' +
        '           Set DATABASE_URL_UNPOOLED (or DATABASE_URL) and retry.',
    )
    process.exit(1)
  }

  // fullResults: true makes the response shape include { rows: [...] }
  const sql = neon(connectionString, { fullResults: true })

  const snapshot = {
    capturedAt: new Date().toISOString(),
    counts: {},
  }

  console.log('[snapshot] Capturing pre-deploy row counts...\n')

  for (const table of TABLES) {
    try {
      // Table names are a hardcoded whitelist — safe to interpolate directly.
      const result = await sql(`SELECT COUNT(*)::bigint AS n FROM public.${table}`)
      const count = Number(result.rows[0].n)
      snapshot.counts[table] = count
      console.log(`  ${table.padEnd(24)} ${count.toLocaleString('pt-BR')} row(s)`)
    } catch (err) {
      // Some tables may not exist in all environments (e.g. operational_tasks).
      // Record null so post-verify can distinguish "table missing" from "zero rows".
      snapshot.counts[table] = null
      console.warn(`  ${table.padEnd(24)} (not available: ${err.message})`)
    }
  }

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8')
  console.log(`\n[snapshot] Snapshot written to ${SNAPSHOT_PATH}`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[snapshot] Unexpected error:', err)
  process.exit(1)
})
