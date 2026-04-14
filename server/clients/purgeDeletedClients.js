// server/clients/purgeDeletedClients.js
//
// Service: automatic purge of soft-deleted clients after the retention window.
//
// Business rules:
//   - Only targets rows where deleted_at IS NOT NULL
//   - Only targets rows deleted more than `retentionDays` days ago
//   - Clients with operational links (proposals) are preserved in soft-delete
//   - Clients without links are permanently removed (hard delete)
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
 * Only tables with non-cascade, non-null FK behaviour (i.e. whose rows would
 * survive the client's physical deletion) are considered operational links.
 * Tables with ON DELETE CASCADE / ON DELETE SET NULL are excluded because
 * their rows are automatically cleaned up by PostgreSQL on hard delete.
 *
 * Confirmed from migrations:
 *   - proposals (migration 0011): client_id BIGINT REFERENCES clients(id)
 *     — no ON DELETE action → defaults to NO ACTION (restricts deletion)
 */
const LINK_TABLES = [
  { table: 'proposals', column: 'client_id' },
]

/**
 * Returns true when the client has at least one operational link in any of
 * the configured LINK_TABLES.
 *
 * Uses `db.sql` (service-level, no RLS) so that all owners' data is visible.
 *
 * @param {Function} sql      - neon sql tagged-template (service-level, no RLS)
 * @param {number}   clientId - numeric client PK
 * @returns {Promise<boolean>}
 */
export async function clientHasLinks(sql, clientId) {
  const checks = await Promise.all(
    LINK_TABLES.map(({ table, column }) =>
      sql(`SELECT 1 FROM ${table} WHERE ${column} = $1 LIMIT 1`, [clientId]),
    ),
  )
  return checks.some((rows) => rows.length > 0)
}

/**
 * Purge soft-deleted clients that have exceeded the retention window.
 *
 * @param {object} db                          - database client from getDatabaseClient()
 * @param {object} [options]
 * @param {number} [options.retentionDays=7]   - days to wait before purging
 * @param {boolean}[options.dryRun=false]      - when true, scan but do not delete
 * @param {number} [options.limit=500]         - max candidates to process per run
 * @returns {Promise<{
 *   retentionDays: number,
 *   scanned: number,
 *   hardDeleted: number,
 *   keptSoftDeletedDueToLinks: number,
 *   durationMs: number,
 *   errors: string[],
 * }>}
 */
export async function purgeDeletedClients(db, options = {}) {
  const {
    retentionDays = DEFAULT_RETENTION_DAYS,
    dryRun = false,
    limit = DEFAULT_LIMIT,
  } = options

  const startMs = Date.now()
  const sql = db.sql

  const summary = {
    retentionDays,
    scanned: 0,
    hardDeleted: 0,
    keptSoftDeletedDueToLinks: 0,
    durationMs: 0,
    errors: [],
  }

  // ── 1. Select candidates ──────────────────────────────────────────────────
  // Uses parameterised interval arithmetic so retentionDays is never
  // interpolated directly into the SQL string.
  let candidates
  try {
    candidates = await sql(
      `SELECT id
       FROM clients
       WHERE deleted_at IS NOT NULL
         AND deleted_at < NOW() - ($1 || ' days')::INTERVAL
       ORDER BY deleted_at ASC
       LIMIT $2`,
      [String(retentionDays), limit],
    )
  } catch (err) {
    const msg = `[purge][clients] failed to fetch candidates: ${err?.message}`
    console.error(msg)
    summary.errors.push(msg)
    summary.durationMs = Date.now() - startMs
    return summary
  }

  summary.scanned = candidates.length
  console.info('[purge][clients] scanned', { retentionDays, scanned: candidates.length, dryRun })

  // ── 2. Process each candidate ─────────────────────────────────────────────
  for (const row of candidates) {
    const clientId = row.id

    try {
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

      // Defensive delete: re-checks deleted_at and age inside the WHERE clause
      // to guard against race conditions (another request could restore the
      // client between the SELECT and this DELETE).
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
        console.info('[purge][clients] client-hard-deleted', { clientId })
      } else {
        // The row disappeared or was restored between SELECT and DELETE — skip.
        console.info('[purge][clients] client-skipped-no-match', { clientId })
      }
    } catch (err) {
      const msg = `[purge][clients] error processing clientId=${clientId}: ${err?.message}`
      console.error(msg)
      summary.errors.push(msg)
    }
  }

  summary.durationMs = Date.now() - startMs
  console.info('[purge][clients] summary', summary)

  return summary
}
