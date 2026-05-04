// server/routes/auth.js
// Auth route handlers, extracted from the inline if-chain in handler.js (PR 14).
//
// Response shapes, status codes, and rate-limiting behaviour are intentionally
// identical to the originals.  handler.js imports and registers these routes via
// registerAuthRoutes() so it continues to act as the compatibility shim.
//
// Routes covered:
//   GET  /api/auth/me                        — identity + DB authorization status
//   GET  /api/authz/me                       — full authorization snapshot
//   POST /api/auth/logout                    — clear session cookie
//   POST /api/internal/auth/reconcile        — reconcile all users (admin)
//   GET  /api/internal/rbac/inspect          — RBAC diagnostics (admin)
//
// The pattern-parameterised route
//   POST /api/internal/auth/reconcile/:userId
// remains in handler.js because the router only supports exact-path matching.

import { handleAuthMeRequest } from './authMe.js'
import { handleAuthReconcileAll } from './authReconcile.js'
import { handleRbacInspectRequest } from './rbacInspect.js'
import { getAuthorizationSnapshot } from '../auth/authorizationSnapshot.js'

/**
 * Registers all auth routes on the given router.
 *
 * Each route is registered with method `'*'` so that OPTIONS pre-flight
 * requests are handled inline rather than falling through to handler.js.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   sendJson:            (res: object, status: number, payload: object) => void,
 *   sendNoContent:       (res: object) => void,
 *   expireAuthCookie:    (req: object, res: object) => void,
 *   isAuthRateLimited:   (req: object) => boolean,
 *   isAdminRateLimited:  (req: object) => boolean,
 * }} moduleCtx
 */
export function registerAuthRoutes(router, moduleCtx) {
  const {
    sendJson,
    sendNoContent,
    expireAuthCookie,
    isAuthRateLimited,
    isAdminRateLimited,
  } = moduleCtx

  // ── GET /api/auth/me ──────────────────────────────────────────────────────
  // Returns authenticated user info + internal authorization status.
  router.register('*', '/api/auth/me', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? 'GET'
    const requestUrl = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
    if (method !== 'GET') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
    if (isAuthRateLimited(req)) { sendJson(res, 429, { error: 'Too many requests. Try again later.' }); return }
    await handleAuthMeRequest(req, res, { sendJson, requestUrl })
  })

  // ── GET /api/authz/me ─────────────────────────────────────────────────────
  // Full authorization snapshot (role, capabilities, permissions).
  router.register('*', '/api/authz/me', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? 'GET'
    if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
    if (method !== 'GET') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
    if (isAuthRateLimited(req)) { sendJson(res, 429, { error: 'Too many requests. Try again later.' }); return }
    try {
      const snapshot = await getAuthorizationSnapshot(req)
      if (!snapshot) {
        sendJson(res, 401, { ok: false, error: 'Autenticação obrigatória.' })
        return
      }
      sendJson(res, 200, { ok: true, data: snapshot })
    } catch (err) {
      console.error('[authz/me] error:', err)
      sendJson(res, 500, { ok: false, error: 'Falha ao carregar snapshot de autorização.' })
    }
  })

  // ── POST /api/auth/logout ─────────────────────────────────────────────────
  // Clears the session cookie by setting Max-Age=0.
  router.register('*', '/api/auth/logout', (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? 'GET'
    if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
    if (method !== 'POST') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
    expireAuthCookie(req, res)
    sendNoContent(res)
  })

  // ── POST /api/internal/auth/reconcile ────────────────────────────────────
  // Reconcile all users' DB roles against Stack Auth permissions (admin only).
  router.register('*', '/api/internal/auth/reconcile', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? 'GET'
    if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
    if (method !== 'POST') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
    if (isAdminRateLimited(req)) { sendJson(res, 429, { error: 'Too many requests. Try again later.' }); return }
    await handleAuthReconcileAll(req, res, { sendJson })
  })

  // ── GET /api/internal/rbac/inspect ───────────────────────────────────────
  // RBAC diagnostic endpoint — admin only.
  router.register('*', '/api/internal/rbac/inspect', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? 'GET'
    const requestUrl = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
    if (method !== 'GET') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
    if (isAdminRateLimited(req)) { sendJson(res, 429, { error: 'Too many requests. Try again later.' }); return }
    await handleRbacInspectRequest(req, res, { sendJson, requestUrl })
  })
}
