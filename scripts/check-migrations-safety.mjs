/**
 * check-migrations-safety.mjs
 *
 * Scans database migration files for potentially destructive SQL patterns and
 * fails the pipeline if any are found in pending (not-yet-applied) migrations
 * without an explicit approval annotation.
 *
 * Dangerous patterns detected:
 *   - DELETE FROM           (bulk deletes)
 *   - DROP TABLE            (table removal)
 *   - DROP COLUMN           (column removal — ALTER TABLE … DROP COLUMN)
 *   - TRUNCATE              (full table wipe)
 *
 * To approve a known-safe destructive operation, add this annotation on the
 * line immediately before (or on the same line as) the dangerous statement:
 *
 *   -- SAFETY-APPROVED: <reason>
 *
 * Example:
 *   -- SAFETY-APPROVED: soft-cancel only, no rows deleted, audit trail preserved
 *   UPDATE public.client_contracts SET contract_status = 'cancelled' WHERE id = 36;
 *
 * When the operation is genuinely destructive and has been reviewed:
 *   -- SAFETY-APPROVED: dropping deprecated column safe_to_remove (backfilled in 0058)
 *   ALTER TABLE public.clients DROP COLUMN IF EXISTS safe_to_remove;
 *
 * Emergency bypass (use only after human review):
 *   SAFETY_CHECK_BYPASS=1 node scripts/check-migrations-safety.mjs
 *
 * Database connection (optional — used to determine pending migrations):
 *   DATABASE_URL_UNPOOLED  or  DATABASE_URL
 *   Without a DB connection, ALL migration files are scanned.
 *
 * Exit codes:
 *   0 — no unapproved destructive patterns found
 *   1 — one or more unapproved destructive patterns detected
 *   2 — configuration error
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations')

// ── Emergency bypass ──────────────────────────────────────────────────────────
if (process.env.SAFETY_CHECK_BYPASS === '1') {
  console.warn('[safety] SAFETY_CHECK_BYPASS=1 — migration safety check bypassed.')
  console.warn('[safety] This bypass MUST be removed after the release.')
  process.exit(0)
}

// ── Dangerous pattern definitions ─────────────────────────────────────────────
//
// Each entry: { label, regex }
// The regex is tested line-by-line (case-insensitive).

const DANGEROUS_PATTERNS = [
  {
    label: 'DELETE FROM',
    // Match DELETE FROM but not in a comment and not --SAFETY-APPROVED
    regex: /^\s*DELETE\s+FROM\b/i,
  },
  {
    label: 'DROP TABLE (without IF EXISTS)',
    // Safe form is DROP TABLE IF EXISTS; without IF EXISTS it can break re-runs.
    regex: /\bDROP\s+TABLE\b(?!\s+IF\s+EXISTS)/i,
  },
  {
    label: 'DROP COLUMN (without IF EXISTS)',
    // Catch DROP COLUMN that is missing IF EXISTS — riskier because it throws
    // on missing column in older Postgres and is harder to re-run.
    regex: /\bDROP\s+COLUMN\b(?!\s+IF\s+EXISTS)/i,
  },
  {
    label: 'TRUNCATE',
    regex: /^\s*TRUNCATE\b/i,
  },
]

const APPROVAL_ANNOTATION = /--\s*SAFETY-APPROVED:/i

// ── Migration file discovery ───────────────────────────────────────────────────

function getAllMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[safety] Migrations directory not found: ${MIGRATIONS_DIR}`)
    process.exit(2)
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort()
}

// ── Optional: resolve pending migrations via DB ───────────────────────────────

async function getAppliedMigrations() {
  const connStr =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL

  if (!connStr) return null

  try {
    // Dynamic import to avoid hard-fail when neon is not available
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(connStr)

    // schema_migrations may not exist yet on a fresh DB
    const [tableCheck] = await sql`
      SELECT to_regclass('public.schema_migrations') AS full_name
    `
    if (!tableCheck?.full_name) return null

    const rows = await sql`SELECT filename FROM public.schema_migrations`
    return new Set(rows.map((r) => r.filename))
  } catch (err) {
    console.warn(`[safety] Could not query schema_migrations (${err.message}) — scanning all files.`)
    return null
  }
}

// ── Line-by-line scanner ──────────────────────────────────────────────────────

/**
 * Scans a migration file for unapproved destructive patterns.
 * Returns an array of finding objects { line, lineNumber, patternLabel }.
 */
function scanMigrationFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const findings = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip pure comment lines
    if (/^\s*--/.test(line)) continue

    for (const { label, regex } of DANGEROUS_PATTERNS) {
      if (!regex.test(line)) continue

      // Check for approval: look at the current line and the line immediately above
      const prevLine = i > 0 ? lines[i - 1] : ''
      const isApproved =
        APPROVAL_ANNOTATION.test(line) || APPROVAL_ANNOTATION.test(prevLine)

      if (!isApproved) {
        findings.push({
          lineNumber: i + 1,
          line: line.trim(),
          patternLabel: label,
        })
      }
    }
  }

  return findings
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const allFiles = getAllMigrationFiles()
  console.log(`[safety] Found ${allFiles.length} migration file(s) in ${MIGRATIONS_DIR}`)

  // Try to get applied migrations to narrow scope to pending only
  const appliedMigrations = await getAppliedMigrations()
  let filesToScan

  if (appliedMigrations) {
    filesToScan = allFiles.filter((f) => !appliedMigrations.has(f))
    console.log(
      `[safety] ${appliedMigrations.size} migration(s) already applied — scanning ${filesToScan.length} pending file(s).`,
    )
  } else {
    filesToScan = allFiles
    console.log(`[safety] No DB connection — scanning all ${filesToScan.length} migration file(s).`)
  }

  if (filesToScan.length === 0) {
    console.log('[safety] ✅ No pending migrations to scan.')
    process.exit(0)
  }

  const allFindings = []

  for (const fileName of filesToScan) {
    const filePath = path.join(MIGRATIONS_DIR, fileName)
    const findings = scanMigrationFile(filePath)

    if (findings.length === 0) {
      console.log(`[safety] ✅ ${fileName}`)
      continue
    }

    console.error(`[safety] ⚠️  ${fileName} — ${findings.length} issue(s):`)
    for (const f of findings) {
      console.error(`[safety]   Line ${f.lineNumber}: [${f.patternLabel}] ${f.line}`)
      allFindings.push({ file: fileName, ...f })
    }
  }

  console.log('')

  if (allFindings.length === 0) {
    console.log('[safety] ✅ All pending migrations passed safety check.')
    process.exit(0)
  }

  console.error(`[safety] ❌ Found ${allFindings.length} unapproved destructive pattern(s).`)
  console.error('[safety]')
  console.error('[safety] To approve a known-safe destructive operation, add this annotation')
  console.error('[safety] on the line immediately BEFORE the dangerous statement:')
  console.error('[safety]')
  console.error('[safety]   -- SAFETY-APPROVED: <reason why this is safe>')
  console.error('[safety]')
  console.error('[safety] For emergency bypass: SAFETY_CHECK_BYPASS=1 node scripts/check-migrations-safety.mjs')
  process.exit(1)
}

run().catch((error) => {
  console.error('[safety] Fatal error:', error.message)
  process.exit(2)
})
