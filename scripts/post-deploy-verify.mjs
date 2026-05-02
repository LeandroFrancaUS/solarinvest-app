/**
 * post-deploy-verify.mjs
 *
 * Compares the current database state against the pre-deploy snapshot saved by
 * pre-deploy-snapshot.mjs and enforces per-table integrity rules.
 *
 * Rules applied (configurable via THRESHOLDS below):
 *
 *   clients                delta == 0   (no client should disappear)
 *   proposals              delta >= 0   (proposals only grow)
 *   client_contracts       delta >= -2  (allows up to 2 dedupe cancellations)
 *   projects               delta >= -5  (allows project dedupe)
 *   client_invoices        delta >= 0   (invoices only grow)
 *                          sum(amount) change <= 0.1%
 *   financial_entries      delta >= 0
 *                          sum(amount) change <= 0.1%
 *   schema_migrations      delta >= 0   (migrations only accumulate)
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed (details printed to stderr)
 *
 * Usage:
 *   node scripts/post-deploy-verify.mjs
 *
 * Environment variables:
 *   DATABASE_URL_UNPOOLED  (preferred)
 *   DATABASE_URL           (fallback)
 *   SNAPSHOT_FILE          (default: tmp/pre-deploy-counts.json)
 *   FINANCIAL_TOLERANCE    (fractional tolerance for sum checks, default 0.001 = 0.1%)
 *   SKIP_VERIFY            (set to '1' to skip all checks — emergency bypass)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Emergency bypass ──────────────────────────────────────────────────────────
if (process.env.SKIP_VERIFY === '1') {
  console.warn('[verify] SKIP_VERIFY=1 — post-deploy verification bypassed.')
  process.exit(0)
}

// ── Connection ────────────────────────────────────────────────────────────────
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL

if (!connectionString) {
  console.error('[verify] ERROR: no database connection string found.')
  process.exit(1)
}

const sql = neon(connectionString)

// ── Snapshot file ─────────────────────────────────────────────────────────────
const snapshotFile = process.env.SNAPSHOT_FILE
  ? path.resolve(process.env.SNAPSHOT_FILE)
  : path.join(ROOT, 'tmp', 'pre-deploy-counts.json')

if (!fs.existsSync(snapshotFile)) {
  console.error(`[verify] ERROR: snapshot file not found: ${snapshotFile}`)
  console.error('[verify] Run scripts/pre-deploy-snapshot.mjs before deploying.')
  process.exit(1)
}

const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'))
console.log(`[verify] Loaded snapshot from: ${snapshotFile}`)
console.log(`[verify] Snapshot captured at: ${snapshot.capturedAt}`)

// ── Financial tolerance ───────────────────────────────────────────────────────
const FINANCIAL_TOLERANCE = Number(process.env.FINANCIAL_TOLERANCE ?? '0.001')

// ── Per-table thresholds ──────────────────────────────────────────────────────
//
// Each entry:
//   minDelta         — minimum allowed change in total (negative = allowed shrinkage)
//   strictNoDecrease — if true, any decrease (even 1) is a hard failure
//   checkAmountSum   — if true, verify totalAmount is within FINANCIAL_TOLERANCE
//
const THRESHOLDS = {
  clients: {
    minDelta: 0,
    strictNoDecrease: true,
    description: 'Clients must never decrease',
  },
  proposals: {
    minDelta: 0,
    description: 'Proposals only grow',
  },
  client_contracts: {
    minDelta: -2,
    description: 'Up to 2 soft-cancelled contracts allowed (dedupe)',
  },
  projects: {
    minDelta: -5,
    description: 'Up to 5 soft-deleted projects allowed (dedupe)',
  },
  client_invoices: {
    minDelta: 0,
    checkAmountSum: true,
    description: 'Invoices only grow; total amount stable within tolerance',
  },
  financial_entries: {
    minDelta: 0,
    checkAmountSum: true,
    description: 'Financial entries only grow; sum(amount) stable within tolerance',
  },
  schema_migrations: {
    minDelta: 0,
    description: 'Migrations only accumulate',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function tableExists(tableName) {
  const [row] = await sql`
    SELECT to_regclass(${'public.' + tableName}) AS full_name
  `
  return Boolean(row?.full_name)
}

async function aggregateTable(tableName, opts = {}) {
  const exists = await tableExists(tableName)
  if (!exists) return { total: 0, totalDistinctIds: 0, totalAmount: null }

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

// Options for tables that have soft-delete or financial sums
const AGGREGATE_OPTS = {
  projects: { filterDeleted: true },
  client_invoices: { sumColumn: 'amount' },
  financial_entries: { sumColumn: 'amount', filterDeleted: true },
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('[verify] Connecting to database…')
  const [metaRow] = await sql`SELECT current_database() AS database_name`
  console.log(`[verify] Connected to: ${metaRow.database_name}`)

  const failures = []
  const warnings = []

  for (const [tableName, rules] of Object.entries(THRESHOLDS)) {
    const before = snapshot.tables?.[tableName]
    if (!before) {
      warnings.push(`[verify] WARN: No pre-deploy snapshot for '${tableName}' — skipping.`)
      continue
    }

    const opts = AGGREGATE_OPTS[tableName] ?? {}
    const after = await aggregateTable(tableName, opts)
    const delta = after.total - before.total

    const statusSymbol = delta === 0 ? '✓' : (delta > 0 ? `+${delta}` : `${delta}`)
    console.log(
      `[verify] ${tableName.padEnd(30)} before=${before.total}  after=${after.total}  delta=${statusSymbol}`,
    )

    // Row count check
    if (delta < rules.minDelta) {
      const msg = `FAIL: '${tableName}' decreased by ${Math.abs(delta)} rows (min allowed: ${rules.minDelta}). ${rules.description}`
      failures.push(msg)
      console.error(`[verify] ❌ ${msg}`)
    } else if (rules.strictNoDecrease && delta < 0) {
      const msg = `FAIL: '${tableName}' must never decrease (lost ${Math.abs(delta)} rows). ${rules.description}`
      failures.push(msg)
      console.error(`[verify] ❌ ${msg}`)
    } else if (delta >= 0) {
      console.log(`[verify] ✅ ${tableName} row count OK`)
    } else {
      console.log(`[verify] ✅ ${tableName} row count OK (within allowed range)`)
    }

    // DISTINCT id check — should never be less than before
    if (after.totalDistinctIds < before.totalDistinctIds) {
      const idDelta = after.totalDistinctIds - before.totalDistinctIds
      const msg = `FAIL: '${tableName}' lost ${Math.abs(idDelta)} distinct IDs. This may indicate hard deletes.`
      // Only fail on clients (no hard deletes allowed anywhere for clients)
      if (tableName === 'clients') {
        failures.push(msg)
        console.error(`[verify] ❌ ${msg}`)
      } else {
        warnings.push(`WARN: ${msg}`)
        console.warn(`[verify] ⚠️  ${msg}`)
      }
    }

    // Financial sum check
    if (rules.checkAmountSum && before.totalAmount !== null && after.totalAmount !== null) {
      const beforeAmt = before.totalAmount
      const afterAmt = after.totalAmount
      const base = Math.abs(beforeAmt) || 1
      const relativeDiff = Math.abs(afterAmt - beforeAmt) / base

      console.log(
        `[verify] ${tableName.padEnd(30)} sum_amount_before=${beforeAmt.toFixed(2)}  sum_amount_after=${afterAmt.toFixed(2)}  rel_diff=${(relativeDiff * 100).toFixed(4)}%`,
      )

      if (relativeDiff > FINANCIAL_TOLERANCE) {
        const msg = `FAIL: '${tableName}' sum(amount) changed by ${(relativeDiff * 100).toFixed(4)}% (tolerance: ${(FINANCIAL_TOLERANCE * 100).toFixed(2)}%). Before: ${beforeAmt.toFixed(2)}, After: ${afterAmt.toFixed(2)}`
        failures.push(msg)
        console.error(`[verify] ❌ ${msg}`)
      } else {
        console.log(`[verify] ✅ ${tableName} sum(amount) within tolerance`)
      }
    }
  }

  // Print warnings
  for (const w of warnings) {
    console.warn(`[verify] ${w}`)
  }

  // Summary
  console.log('')
  if (failures.length === 0) {
    console.log(`[verify] ✅ All post-deploy integrity checks passed.`)
    process.exit(0)
  } else {
    console.error(`[verify] ❌ ${failures.length} check(s) failed:`)
    for (const f of failures) {
      console.error(`[verify]   • ${f}`)
    }
    console.error('[verify] Review the failures above before proceeding.')
    process.exit(1)
  }
}

run().catch((error) => {
  console.error('[verify] Fatal error:', error.message)
  process.exit(1)
})
