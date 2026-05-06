// server/routes/auth.js
// Auth route handlers, extracted from the inline if-chain in handler.js (PR 14).
//
// Response shapes, status codes, and rate-limiting behaviour are intentionally
// identical to the originals.  handler.js imports and registers these routes via
// registerAuthRoutes() so it continues to act as the compatibility shim.
//
// Routes covered:
//   GET  /api/auth/me                             — identity + DB authorization status
//   GET  /api/authz/me                            — full authorization snapshot
//   POST /api/auth/logout                         — clear session cookie
//   POST /api/internal/auth/reconcile             — reconcile all users (admin)
//   POST /api/internal/auth/reconcile/:userId     — reconcile single user (admin)
//   GET  /api/internal/rbac/inspect               — RBAC diagnostics (admin)

import { handleAuthMeRequest } from './authMe.js'
import { handleAuthReconcileAll, handleAuthReconcileUser } from './authReconcile.js'
import { handleRbacInspectRequest } from './rbacInspect.js'
import { getAuthorizationSnapshot } from '../auth/authorizationSnapshot.js'
import { jsonResponse, noContentResponse } from '../response.js'

/**
 * Registers all auth routes on the given router.
 *
 * Each route is registered with method `'*'` so that OPTIONS pre-flight
 * requests are handled inline rather than falling through to handler.js.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   expireAuthCookie:    (req: object, res: object) => void,
 *   isAuthRateLimited:   (req: object) => boolean,
 *   isAdminRateLimited:  (req: object) => boolean,
 * }} moduleCtx
 */
export function registerAuthRoutes(router, moduleCtx) {
  const {
    expireAuthCookie,
    isAuthRateLimited,
    isAdminRateLimited,
  } = moduleCtx

  // Alias used when passing jsonResponse to sub-handlers that expect { sendJson }.
  // Sub-handlers accept sendJson(res, status, payload) which matches jsonResponse's signature.
  const sendJson = jsonResponse

  // ── GET /api/auth/me ──────────────────────────────────────────────────────
  // Returns authenticated user info + internal authorization status.
  router.register('*', '/api/auth/me', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const requestUrl = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    if (isAuthRateLimited(req)) { jsonResponse(res, 429, { error: 'Too many requests. Try again later.' }); return }
    await handleAuthMeRequest(req, res, { sendJson, requestUrl })
  })

  // ── GET /api/authz/me ─────────────────────────────────────────────────────
  // Full authorization snapshot (role, capabilities, permissions).
  router.register('*', '/api/authz/me', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    if (isAuthRateLimited(req)) { jsonResponse(res, 429, { error: 'Too many requests. Try again later.' }); return }
    try {
      const snapshot = await getAuthorizationSnapshot(req)
      if (!snapshot) {
        jsonResponse(res, 401, { ok: false, error: 'Autenticação obrigatória.' })
        return
      }
      jsonResponse(res, 200, { ok: true, data: snapshot })
    } catch (err) {
      console.error('[authz/me] error:', err)
      jsonResponse(res, 500, { ok: false, error: 'Falha ao carregar snapshot de autorização.' })
    }
  })

  // ── POST /api/auth/logout ─────────────────────────────────────────────────
  // Clears the session cookie by setting Max-Age=0.
  router.register('*', '/api/auth/logout', (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    expireAuthCookie(req, res)
    noContentResponse(res)
  })

  // ── POST /api/internal/auth/reconcile ────────────────────────────────────
  // Reconcile all users' DB roles against Stack Auth permissions (admin only).
  router.register('*', '/api/internal/auth/reconcile', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    if (isAdminRateLimited(req)) { jsonResponse(res, 429, { error: 'Too many requests. Try again later.' }); return }
    await handleAuthReconcileAll(req, res, { sendJson })
  })

  // ── POST /api/internal/auth/reconcile/:userId ───────────────────────────
  // Reconcile a single user's DB role against Stack Auth permissions (admin only).
  router.register('*', '/api/internal/auth/reconcile/:userId', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const userId = reqCtx.params?.userId ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    if (isAdminRateLimited(req)) { jsonResponse(res, 429, { error: 'Too many requests. Try again later.' }); return }
    await handleAuthReconcileUser(req, res, { sendJson, userId })
  })

  // ── GET /api/internal/rbac/inspect ───────────────────────────────────────
  // RBAC diagnostic endpoint — admin only.
  router.register('*', '/api/internal/rbac/inspect', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const requestUrl = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    if (isAdminRateLimited(req)) { jsonResponse(res, 429, { error: 'Too many requests. Try again later.' }); return }
    await handleRbacInspectRequest(req, res, { sendJson, requestUrl })
  })
}
