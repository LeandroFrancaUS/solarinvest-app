// server/routes/purgeDeletedClients.js
//
// GET /api/internal/purge-deleted-clients
//
// Internal cron endpoint that triggers the hybrid-retention purge for
// soft-deleted clients that have exceeded the 7-day retention window.
//
// Security:
//   - Protected by CRON_SECRET (Authorization: Bearer <secret>)
//   - Only accepts GET (Vercel cron calls routes via HTTP GET)
//   - Does NOT depend on user session or RLS context
//
// Vercel cron jobs pass the secret via the Authorization header automatically
// when CRON_SECRET is set in the project environment variables.

import { getDatabaseClient } from '../database/neonClient.js'
import { purgeDeletedClients } from '../clients/purgeDeletedClients.js'

/**
 * Validates the Authorization header against CRON_SECRET.
 * Throws an error with statusCode=401 when the token is absent or wrong.
 *
 * @param {object} req - Node.js IncomingMessage
 */
function assertCronAuthorized(req) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    throw new Error(
      'CRON_SECRET environment variable is not configured. ' +
      'Set it in your Vercel project settings to enable cron authentication.',
    )
  }

  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (token !== expected) {
    const err = new Error('Unauthorized cron invocation')
    err.statusCode = 401
    throw err
  }
}

/**
 * GET /api/internal/purge-deleted-clients
 *
 * Query params:
 *   dryRun=true  — scan and report without deleting (default: false)
 *
 * Response 200:
 *   {
 *     ok: true,
 *     retentionDays: 7,
 *     scanned: 21,
 *     hardDeleted: 8,
 *     keptSoftDeletedDueToLinks: 11,
 *     keptSoftDeletedDueToProtection: 2,
 *     durationMs: 120,
 *     errors: []
 *   }
 *
 * @param {object} req
 * @param {object} res
 * @param {object} ctx
 * @param {Function} ctx.sendJson
 * @param {URL}      ctx.requestUrl
 */
export async function handlePurgeDeletedClientsRequest(req, res, { sendJson, requestUrl }) {
  console.info('[purge][cron] start')

  // ── Auth ────────────────────────────────────────────────────────────────────
  try {
    assertCronAuthorized(req)
  } catch (err) {
    const status = err.statusCode === 401 ? 401 : 403
    console.warn('[purge][cron] unauthorized', { message: err.message })
    sendJson(res, status, { error: { code: 'UNAUTHORIZED', message: err.message } })
    return
  }

  // ── DB ──────────────────────────────────────────────────────────────────────
  const db = getDatabaseClient()
  if (!db) {
    console.error('[purge][cron] failed — no database client')
    sendJson(res, 503, { error: { code: 'DB_UNAVAILABLE', message: 'Database not configured' } })
    return
  }

  // ── Options ─────────────────────────────────────────────────────────────────
  const dryRun = requestUrl?.searchParams?.get('dryRun') === 'true'

  // ── Run purge ───────────────────────────────────────────────────────────────
  try {
    const result = await purgeDeletedClients(db, { dryRun })

    console.info('[purge][cron] success', {
      scanned: result.scanned,
      hardDeleted: result.hardDeleted,
      keptSoftDeletedDueToLinks: result.keptSoftDeletedDueToLinks,
      keptSoftDeletedDueToProtection: result.keptSoftDeletedDueToProtection,
      durationMs: result.durationMs,
      dryRun,
    })

    sendJson(res, 200, { ok: true, ...result, dryRun })
  } catch (err) {
    console.error('[purge][cron] failed', { message: err?.message })
    sendJson(res, 500, { error: { code: 'PURGE_FAILED', message: err?.message ?? 'Unknown error' } })
  }
}
