// server/routes/purgeOldProposals.js
//
// GET /api/internal/purge-old-proposals
//
// Internal cron endpoint that triggers a hard-delete purge of proposals whose
// created_at is older than 30 days (default).
//
// Security:
//   - Protected by CRON_SECRET (Authorization: Bearer <CRON_SECRET>)
//   - Only accepts GET (Vercel cron calls routes via HTTP GET)
//   - Does NOT depend on user session or RLS context
//
// Vercel cron jobs pass the secret via the Authorization header automatically
// when CRON_SECRET is set in the project environment variables.

import { getDatabaseClient } from '../database/neonClient.js'
import { purgeOldProposals } from '../proposals/purgeOldProposals.js'
import { jsonResponse, noContentResponse } from '../response.js'

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
 * GET /api/internal/purge-old-proposals
 *
 * Query params:
 *   dryRun=true  — count and report without deleting (default: false)
 *
 * Response 200:
 *   {
 *     ok: true,
 *     retentionDays: 30,
 *     hardDeleted: 12,
 *     durationMs: 45,
 *     errors: [],
 *     dryRun: false
 *   }
 *
 * @param {object} req
 * @param {object} res
 * @param {object} ctx
 * @param {Function} ctx.sendJson
 * @param {URL}      ctx.requestUrl
 */
export async function handlePurgeOldProposalsRequest(req, res, { sendJson, requestUrl }) {
  console.info('[purge][proposals][cron] start')

  // ── Auth ────────────────────────────────────────────────────────────────────
  try {
    assertCronAuthorized(req)
  } catch (err) {
    const status = err.statusCode === 401 ? 401 : 403
    console.warn('[purge][proposals][cron] unauthorized', { message: err.message })
    sendJson(res, status, { error: { code: 'UNAUTHORIZED', message: err.message } })
    return
  }

  // ── DB ──────────────────────────────────────────────────────────────────────
  const db = getDatabaseClient()
  if (!db) {
    console.error('[purge][proposals][cron] failed — no database client')
    sendJson(res, 503, { error: { code: 'DB_UNAVAILABLE', message: 'Database not configured' } })
    return
  }

  // ── Options ─────────────────────────────────────────────────────────────────
  const dryRun = requestUrl?.searchParams?.get('dryRun') === 'true'

  // ── Run purge ───────────────────────────────────────────────────────────────
  try {
    const result = await purgeOldProposals(db, { dryRun })

    console.info('[purge][proposals][cron] success', {
      hardDeleted: result.hardDeleted,
      durationMs: result.durationMs,
      dryRun,
    })

    sendJson(res, 200, { ok: true, ...result, dryRun })
  } catch (err) {
    console.error('[purge][proposals][cron] failed', { message: err?.message })
    sendJson(res, 500, { error: { code: 'PURGE_FAILED', message: err?.message ?? 'Unknown error' } })
  }
}

/**
 * Registers the GET /api/internal/purge-old-proposals route on the given router.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 */
export function registerPurgeOldProposalsRoute(router) {
  // ── GET /api/internal/purge-old-proposals ────────────────────────────────
  // Vercel cron endpoint — protected by CRON_SECRET bearer token.
  router.register('*', '/api/internal/purge-old-proposals', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const requestUrl = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handlePurgeOldProposalsRequest(req, res, { sendJson: jsonResponse, requestUrl })
  })
}
