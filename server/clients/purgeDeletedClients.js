// server/clients/purgeDeletedClients.js
//
// Service: automatic purge of soft-deleted clients after the retention window.
//
// Business rules (migration 0053):
//   - Only targets rows where deleted_at IS NOT NULL
//   - Uses purge_after <= NOW() as the primary eligibility filter when the
//     column exists (migration 0053).  Falls back to the legacy
//     deleted_at + retentionDays calculation for rows without purge_after.
//   - Clients with is_high_value_protected = true are always skipped.
//   - Clients with any operational links are preserved in soft-delete state.
//   - Clients without links are permanently removed (hard delete).
//
// IMPORTANT: This module uses db.sql (no RLS context) because purge is a
// system-level maintenance routine that must operate across all owners.
// Never use createUserScopedSql here.

const DEFAULT_RETENTION_DAYS = 7
const DEFAULT_LIMIT = 500

/**
 * Tables that represent operational links to a client.
 * A client with any matching row in these tables is preserved in soft-delete.
 *
 * Two categories:
 *   1. FK RESTRICT tables (proposals): a hard delete would fail at the DB level
 *      if rows exist, so we check first and skip rather than letting the DELETE
 *      throw an error.
 *   2. ON DELETE CASCADE tables (all others): the DB would silently remove
 *      these rows on a hard delete, but the data they carry (contracts, billing
 *      configuration, project status, notes, energy profile, lifecycle) is
 *      meaningful business data that must not be discarded without explicit
 *      intent.  Checking them here prevents accidental data loss even though
 *      no FK constraint would be violated.
 *
 * This "maximum-safety" approach means a converted client (which always has a
 * client_lifecycle row) will not be auto-purged.  That is intentional: if a
 * client has progressed through the portfolio lifecycle, their record must be
 * cleaned up manually before automatic purge can proceed.  Use
 * is_high_value_protected = true for clients that should be permanently
 * excluded from auto-purge.
 */
const LINK_TABLES = [
  { table: 'proposals',              column: 'client_id' },
  { table: 'client_energy_profile',  column: 'client_id' },
  { table: 'client_lifecycle',       column: 'client_id' },
  { table: 'client_contracts',       column: 'client_id' },
  { table: 'client_billing_profile', column: 'client_id' },
  { table: 'client_project_status',  column: 'client_id' },
  { table: 'client_notes',           column: 'client_id' },
]

// Allowlist of permitted table and column name characters (alphanumeric + underscore).
// Used to validate LINK_TABLES entries before building identifier-safe SQL.
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i

/**
 * Quote a PostgreSQL identifier with double quotes, escaping embedded quotes.
 * This is safe to interpolate into a SQL string only for identifiers
 * validated against SAFE_IDENTIFIER.
 *
 * @param {string} name
 * @returns {string}
 */
function quoteIdentifier(name) {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`[purge] Unsafe SQL identifier rejected: "${name}"`)
  }
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * Returns true when the client has at least one operational link in any of
 * the configured LINK_TABLES.
 *
 * Uses `sql` (service-level, no RLS) so that all owners' data is visible.
 *
 * @param {Function} sql      - neon sql tagged-template (service-level, no RLS)
 * @param {number}   clientId - numeric client PK
 * @returns {Promise<boolean>}
 */
export async function clientHasLinks(sql, clientId) {
  const checks = await Promise.all(
    LINK_TABLES.map(({ table, column }) => {
      const quotedTable = quoteIdentifier(table)
      const quotedColumn = quoteIdentifier(column)
      return sql(`SELECT 1 FROM ${quotedTable} WHERE ${quotedColumn} = $1 LIMIT 1`, [clientId])
    }),
  )
  return checks.some((rows) => rows.length > 0)
}

/**
 * Purge soft-deleted clients that have exceeded their retention window.
 *
 * Uses the purge_after column (migration 0053) when available, with a
 * graceful fallback to the legacy retentionDays-based calculation.
 *
 * @param {object} db                          - database client from getDatabaseClient()
 * @param {object} [options]
 * @param {number} [options.retentionDays=7]   - days to wait before purging (legacy fallback)
 * @param {boolean}[options.dryRun=false]      - when true, scan but do not delete
 * @param {number} [options.limit=500]         - max candidates to process per run
 * @returns {Promise<{
 *   retentionDays: number,
 *   scanned: number,
 *   hardDeleted: number,
 *   keptSoftDeletedDueToLinks: number,
 *   keptSoftDeletedDueToProtection: number,
 *   durationMs: number,
 *   errors: string[],
 * }>}
 */
export async function purgeDeletedClients(db, options = {}) {
  const {
    retentionDays: rawRetentionDays = DEFAULT_RETENTION_DAYS,
    dryRun = false,
    limit = DEFAULT_LIMIT,
  } = options

  // Validate retentionDays is a safe positive integer before using it in SQL.
  const retentionDays = Math.max(1, Math.floor(Number(rawRetentionDays)))
  if (!Number.isFinite(retentionDays)) {
    throw new TypeError(`[purge] retentionDays must be a finite number, got: ${rawRetentionDays}`)
  }

  const startMs = Date.now()
  const sql = db.sql

  const summary = {
    retentionDays,
    scanned: 0,
    hardDeleted: 0,
    keptSoftDeletedDueToLinks: 0,
    keptSoftDeletedDueToProtection: 0,
    durationMs: 0,
    errors: [],
  }

  // ── 1. Select candidates ──────────────────────────────────────────────────
  // Primary: use purge_after <= NOW() when the column exists (migration 0053).
  // Fallback: use the legacy retentionDays interval calculation.
  // Both strategies are parameterised; retentionDays is never interpolated
  // directly into the SQL string.
  let candidates
  try {
    candidates = await sql(
      `SELECT id, COALESCE(is_high_value_protected, false) AS is_high_value_protected
       FROM clients
       WHERE deleted_at IS NOT NULL
         AND (
           (purge_after IS NOT NULL AND purge_after <= NOW())
           OR (purge_after IS NULL AND deleted_at < NOW() - ($1 || ' days')::INTERVAL)
         )
       ORDER BY deleted_at ASC
       LIMIT $2`,
      [String(retentionDays), limit],
    )
  } catch (schemaErr) {
    const schemaMsg = schemaErr?.message ?? ''
    if (schemaMsg.includes('purge_after') || schemaMsg.includes('is_high_value_protected')) {
      // Migration 0053 not yet applied — fall back to legacy retention query.
      console.warn('[purge][clients] purge_after column missing — using legacy retentionDays filter')
      try {
        candidates = await sql(
          `SELECT id, false AS is_high_value_protected
           FROM clients
           WHERE deleted_at IS NOT NULL
             AND deleted_at < NOW() - ($1 || ' days')::INTERVAL
           ORDER BY deleted_at ASC
           LIMIT $2`,
          [String(retentionDays), limit],
        )
      } catch (fallbackErr) {
        const msg = `[purge][clients] failed to fetch candidates (legacy fallback): ${fallbackErr?.message}`
        console.error(msg)
        summary.errors.push(msg)
        summary.durationMs = Date.now() - startMs
        return summary
      }
    } else {
      const msg = `[purge][clients] failed to fetch candidates: ${schemaErr?.message}`
      console.error(msg)
      summary.errors.push(msg)
      summary.durationMs = Date.now() - startMs
      return summary
    }
  }

  summary.scanned = candidates.length
  console.info('[purge][clients] scanned', { retentionDays, scanned: candidates.length, dryRun })

  // ── 2. Process each candidate ─────────────────────────────────────────────
  for (const row of candidates) {
    const clientId = row.id
    const isProtected = Boolean(row.is_high_value_protected)

    try {
      // Safety rule: never purge a client marked as high-value protected.
      if (isProtected) {
        summary.keptSoftDeletedDueToProtection++
        console.info('[purge][clients] client-protected', { clientId })
        continue
      }

      const hasLinks = await clientHasLinks(sql, clientId)

      if (hasLinks) {
        summary.keptSoftDeletedDueToLinks++
        console.info('[purge][clients] client-kept-due-links', { clientId })
        continue
      }

      if (dryRun) {
        summary.hardDeleted++
        console.info('[purge][clients] client-hard-deleted (dry-run)', { clientId })
        continue
      }

      // Defensive delete: re-checks deleted_at, purge_after, and protection flag
      // inside the WHERE clause to guard against race conditions.
      const deleted = await sql(
        `DELETE FROM clients
         WHERE id = $1
           AND deleted_at IS NOT NULL
           AND COALESCE(is_high_value_protected, false) = false
           AND (
             (purge_after IS NOT NULL AND purge_after <= NOW())
             OR (purge_after IS NULL AND deleted_at < NOW() - ($2 || ' days')::INTERVAL)
           )
         RETURNING id`,
        [clientId, String(retentionDays)],
      )

      if (deleted.length > 0) {
        summary.hardDeleted++
        console.info('[purge][clients] client-hard-deleted', { clientId })
      } else {
        // The row disappeared, was restored, or was protected between SELECT
        // and DELETE — skip silently.
        console.info('[purge][clients] client-skipped-no-match', { clientId })
      }
    } catch (err) {
      // Handle legacy DELETE (without purge_after column) by falling back.
      const errMsg = err?.message ?? ''
      if (errMsg.includes('purge_after') || errMsg.includes('is_high_value_protected')) {
        try {
          const deleted = await sql(
            `DELETE FROM clients
             WHERE id = $1
               AND deleted_at IS NOT NULL
               AND deleted_at < NOW() - ($2 || ' days')::INTERVAL
             RETURNING id`,
            [clientId, String(retentionDays)],
          )
          if (deleted.length > 0) {
            summary.hardDeleted++
            console.info('[purge][clients] client-hard-deleted (legacy)', { clientId })
          }
        } catch (legacyErr) {
          const msg = `[purge][clients] error processing clientId=${clientId}: ${legacyErr?.message}`
          console.error(msg)
          summary.errors.push(msg)
        }
      } else {
        const msg = `[purge][clients] error processing clientId=${clientId}: ${err?.message}`
        console.error(msg)
        summary.errors.push(msg)
      }
    }
  }

  summary.durationMs = Date.now() - startMs
  console.info('[purge][clients] summary', summary)

  return summary
}
