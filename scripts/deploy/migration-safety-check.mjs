/**
 * Migration Safety Check
 *
 * Scans all SQL files in db/migrations for dangerous patterns and produces a
 * structured risk report. Exits 1 when any HIGH-risk pattern is found so that
 * the deploy pipeline can block unreviewed destructive migrations.
 *
 * Risk levels:
 *   HIGH  — unguarded destructive statements (no IF EXISTS / WHERE clause).
 *           Exits with code 1.  Requires explicit human approval before merge.
 *   MEDIUM — guarded destructive statements (IF EXISTS / conditional blocks).
 *           Logged as warnings but does not block the deploy.
 *
 * The check runs purely as static analysis — no database connection required.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations')

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

/** Patterns that indicate a HIGH-risk (blocking) destructive operation. */
const HIGH_RISK_PATTERNS = [
  {
    id: 'drop_table_unguarded',
    label: 'DROP TABLE without IF EXISTS',
    // Matches DROP TABLE that is NOT followed by IF EXISTS
    pattern: /\bDROP\s+TABLE\s+(?!IF\s+EXISTS\b)/i,
  },
  {
    id: 'truncate',
    label: 'TRUNCATE statement',
    pattern: /\bTRUNCATE\b/i,
  },
  {
    id: 'delete_without_where',
    label: 'DELETE FROM without WHERE clause',
    // DELETE FROM <table> ; — no WHERE between the table name and the semicolon
    // This is intentionally conservative: if there is ANY WHERE it won't match.
    pattern: /\bDELETE\s+FROM\s+\S+\s*;/i,
  },
  {
    id: 'drop_column_unguarded',
    label: 'DROP COLUMN without IF EXISTS',
    pattern: /\bDROP\s+COLUMN\s+(?!IF\s+EXISTS\b)/i,
  },
]

/** Patterns that indicate a MEDIUM-risk (warning-only) operation. */
const MEDIUM_RISK_PATTERNS = [
  {
    id: 'drop_table_if_exists',
    label: 'DROP TABLE IF EXISTS',
    pattern: /\bDROP\s+TABLE\s+IF\s+EXISTS\b/i,
  },
  {
    id: 'drop_column_if_exists',
    label: 'DROP COLUMN IF EXISTS',
    pattern: /\bDROP\s+COLUMN\s+IF\s+EXISTS\b/i,
  },
  {
    id: 'alter_column_type',
    label: 'ALTER COLUMN ... TYPE (potential data conversion)',
    pattern: /\bALTER\s+COLUMN\s+\S+\s+TYPE\b/i,
  },
  {
    id: 'drop_index_unguarded',
    label: 'DROP INDEX without IF EXISTS',
    pattern: /\bDROP\s+INDEX\s+(?!CONCURRENTLY\s+IF\s+EXISTS\b)(?!IF\s+EXISTS\b)/i,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips SQL single-line and block comments from a string so that pattern
 * matching does not false-positive on commented-out statements.
 */
function stripComments(sql) {
  // Remove block comments /* ... */ (non-greedy, including newlines)
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, ' ')
  // Remove single-line comments -- ...
  result = result.replace(/--[^\n]*/g, ' ')
  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[safety-check] Migrations directory not found: ${MIGRATIONS_DIR}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    console.log('[safety-check] No migration files found — nothing to check.')
    process.exit(0)
  }

  console.log(`[safety-check] Scanning ${files.length} migration file(s) in ${MIGRATIONS_DIR}\n`)

  const highRiskFindings = []
  const mediumRiskFindings = []

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file)
    const rawSql = fs.readFileSync(filePath, 'utf8')
    const sql = stripComments(rawSql)

    const fileHighRisks = []
    const fileMediumRisks = []

    for (const def of HIGH_RISK_PATTERNS) {
      if (def.pattern.test(sql)) {
        // Avoid double-reporting: if a drop_table_unguarded is flagged but
        // the same file also has a drop_table_if_exists hit, the unguarded
        // match is real (different statement) — keep both.
        fileHighRisks.push(def.label)
      }
    }

    for (const def of MEDIUM_RISK_PATTERNS) {
      if (def.pattern.test(sql)) {
        fileMediumRisks.push(def.label)
      }
    }

    if (fileHighRisks.length > 0) {
      highRiskFindings.push({ file, patterns: fileHighRisks })
    }
    if (fileMediumRisks.length > 0) {
      mediumRiskFindings.push({ file, patterns: fileMediumRisks })
    }
  }

  // Print medium-risk summary (informational)
  if (mediumRiskFindings.length > 0) {
    console.log(`⚠️  MEDIUM-RISK findings (${mediumRiskFindings.length} file(s)) — guarded; no action required:\n`)
    for (const { file, patterns } of mediumRiskFindings) {
      console.log(`   ${file}`)
      for (const p of patterns) {
        console.log(`     · ${p}`)
      }
    }
    console.log()
  }

  // Print high-risk summary (blocking)
  if (highRiskFindings.length > 0) {
    console.error(`🚨 HIGH-RISK findings (${highRiskFindings.length} file(s)) — UNGUARDED destructive statements:\n`)
    for (const { file, patterns } of highRiskFindings) {
      console.error(`   ${file}`)
      for (const p of patterns) {
        console.error(`     · ${p}`)
      }
    }
    console.error()
    console.error(
      '[safety-check] Deploy blocked: one or more migrations contain unguarded destructive SQL.\n' +
        '               Review the files above, ensure the intent is correct, and obtain human\n' +
        '               approval before merging to main.',
    )
    process.exit(1)
  }

  console.log(`✅ [safety-check] All ${files.length} migration file(s) passed. No HIGH-risk patterns detected.`)
  process.exit(0)
}

run()
