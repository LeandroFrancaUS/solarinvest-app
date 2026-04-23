// server/proposals/purgeOldProposals.js
//
// Service: complete hard-delete purge of proposals older than the retention window.
//
// Business rules:
//   - Targets ALL proposals (any status, including soft-deleted ones) where
//     created_at < NOW() - retentionDays interval.
//   - Rows are permanently removed — no backup, no soft-delete step required.
//   - The proposal_audit_log rows cascade-delete automatically (ON DELETE CASCADE
//     defined in migration 0009).
//   - Default retention window: 30 days.
//
// IMPORTANT: This module uses db.sql (no RLS context) because purge is a
// system-level maintenance routine that must operate across all owners.
// Never use createUserScopedSql here.

const DEFAULT_RETENTION_DAYS = 30
const DEFAULT_LIMIT = 500

/**
 * Hard-delete proposals that have exceeded the creation-date retention window.
 *
 * @param {object} db                           - database client from getDatabaseClient()
 * @param {object} [options]
 * @param {number} [options.retentionDays=30]   - days from created_at before a proposal is eligible
 * @param {boolean}[options.dryRun=false]       - when true, count candidates but do not delete
 * @param {number} [options.limit=500]          - max rows to delete per run
 * @returns {Promise<{
 *   retentionDays: number,
 *   hardDeleted: number,
 *   durationMs: number,
 *   errors: string[],
 * }>}
 */
export async function purgeOldProposals(db, options = {}) {
  const {
    retentionDays: rawRetentionDays = DEFAULT_RETENTION_DAYS,
    dryRun = false,
    limit = DEFAULT_LIMIT,
  } = options

  // Validate retentionDays is a safe positive integer before using it in SQL.
  const retentionDays = Math.max(1, Math.floor(Number(rawRetentionDays)))
  if (!Number.isFinite(retentionDays)) {
    throw new TypeError(`[purge][proposals] retentionDays must be a finite number, got: ${rawRetentionDays}`)
  }

  const startMs = Date.now()
  const sql = db.sql

  const summary = {
    retentionDays,
    hardDeleted: 0,
    durationMs: 0,
    errors: [],
  }

  try {
    if (dryRun) {
      // In dry-run mode just count how many rows would be affected.
      const rows = await sql(
        `SELECT COUNT(*) AS total
         FROM proposals
         WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
        [String(retentionDays)],
      )
      summary.hardDeleted = parseInt(rows[0]?.total ?? 0, 10)
      console.info('[purge][proposals] dry-run count', {
        retentionDays,
        wouldDelete: summary.hardDeleted,
      })
    } else {
      // Hard-delete in a single batched DELETE … RETURNING to get the count.
      // retentionDays is never interpolated directly into the SQL string;
      // it is always passed as a parameterised value.
      const deleted = await sql(
        `DELETE FROM proposals
         WHERE id IN (
           SELECT id FROM proposals
           WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
           ORDER BY created_at ASC
           LIMIT $2
         )
         RETURNING id`,
        [String(retentionDays), limit],
      )
      summary.hardDeleted = deleted.length
      console.info('[purge][proposals] hard-deleted', {
        retentionDays,
        hardDeleted: summary.hardDeleted,
      })
    }
  } catch (err) {
    const msg = `[purge][proposals] failed: ${err?.message}`
    console.error(msg)
    summary.errors.push(msg)
  }

  summary.durationMs = Date.now() - startMs
  console.info('[purge][proposals] summary', summary)

  return summary
}
