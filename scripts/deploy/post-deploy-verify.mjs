/**
 * Post-Deploy Verification
 *
 * Reads the snapshot captured by pre-deploy-snapshot.mjs and compares it
 * against current database row counts to detect unexpected data loss after
 * migrations and deployment.
 *
 * Requires DATABASE_URL_UNPOOLED (or DATABASE_URL / NEON_DATABASE_URL) to be
 * set in the environment.  The snapshot file path is read from
 * DEPLOY_SNAPSHOT_PATH (default: /tmp/deploy-snapshot.json).
 *
 * Exit codes:
 *   0 — verification passed (no data loss detected)
 *   1 — database connection failed, or row counts decreased unexpectedly
 *   2 — snapshot file not found (pre-deploy step may have been skipped)
 */

import fs from 'fs'
import { neon } from '@neondatabase/serverless'

const SNAPSHOT_PATH = process.env.DEPLOY_SNAPSHOT_PATH ?? '/tmp/deploy-snapshot.json'

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
  // ------------------------------------------------------------------
  // Load snapshot
  // ------------------------------------------------------------------
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(
      `[verify] Snapshot file not found at ${SNAPSHOT_PATH}.\n` +
        '         The pre-deploy snapshot step may have been skipped.',
    )
    process.exit(2)
  }

  let snapshot
  try {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
  } catch (err) {
    console.error('[verify] Failed to parse snapshot file:', err.message)
    process.exit(1)
  }

  console.log(`[verify] Snapshot captured at: ${snapshot.capturedAt}\n`)

  // ------------------------------------------------------------------
  // Connect to database
  // ------------------------------------------------------------------
  const connectionString = resolveConnectionString()
  if (!connectionString) {
    console.error(
      '[verify] No database connection string found.\n' +
        '         Set DATABASE_URL_UNPOOLED (or DATABASE_URL) and retry.',
    )
    process.exit(1)
  }

  // fullResults: true makes the response shape include { rows: [...] }
  const sql = neon(connectionString, { fullResults: true })

  // ------------------------------------------------------------------
  // Compare counts
  // ------------------------------------------------------------------
  const tables = Object.keys(snapshot.counts)
  const findings = []
  let hasLoss = false

  console.log('[verify] Comparing row counts (pre-deploy → post-deploy):\n')

  const COL_TABLE = 26
  const COL_BEFORE = 14
  const COL_AFTER = 14

  const header =
    'Table'.padEnd(COL_TABLE) +
    'Before'.padStart(COL_BEFORE) +
    'After'.padStart(COL_AFTER) +
    '  Status'
  console.log('  ' + header)
  console.log('  ' + '-'.repeat(header.length))

  for (const table of tables) {
    const before = snapshot.counts[table]

    let after = null
    let queryError = null
    try {
      const result = await sql(`SELECT COUNT(*)::bigint AS n FROM public.${table}`)
      after = Number(result.rows[0].n)
    } catch (err) {
      queryError = err.message
    }

    const beforeStr = before === null ? 'N/A' : before.toLocaleString('pt-BR')
    const afterStr = after === null ? (queryError ? 'ERROR' : 'N/A') : after.toLocaleString('pt-BR')

    let status = '✅ OK'
    if (queryError) {
      status = `⚠️  query error: ${queryError}`
    } else if (before !== null && after !== null && after < before) {
      status = `🚨 LOSS  (-${(before - after).toLocaleString('pt-BR')} rows)`
      hasLoss = true
      findings.push({ table, before, after, delta: after - before })
    } else if (before !== null && after !== null && after > before) {
      status = `➕ +${(after - before).toLocaleString('pt-BR')} rows`
    }

    const line =
      table.padEnd(COL_TABLE) +
      beforeStr.padStart(COL_BEFORE) +
      afterStr.padStart(COL_AFTER) +
      '  ' +
      status
    console.log('  ' + line)
  }

  console.log()

  // ------------------------------------------------------------------
  // Final verdict
  // ------------------------------------------------------------------
  if (hasLoss) {
    console.error('[verify] ❌ VERIFICATION FAILED — unexpected row count decrease(s) detected:')
    for (const { table, before, after, delta } of findings) {
      console.error(`         ${table}: ${before} → ${after} (${delta})`)
    }
    console.error(
      '\n         Investigate the production database before declaring the deploy successful.',
    )
    process.exit(1)
  }

  console.log('[verify] ✅ Post-deploy verification passed. No data loss detected.')
  process.exit(0)
}

run().catch((err) => {
  console.error('[verify] Unexpected error:', err)
  process.exit(1)
})
