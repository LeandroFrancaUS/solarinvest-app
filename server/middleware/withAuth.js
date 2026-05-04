// server/middleware/withAuth.js
// Authentication and authorization middleware.
//
// Resolves the actor from the incoming request, enforces authentication (401)
// and authorization (403), and injects the actor into the handler context so
// downstream handlers do not need to repeat the resolution.
//
// OPTIONS pre-flight requests are always passed through without auth checks,
// so that CORS pre-flights never require credentials.

import { resolveActor } from '../proposals/permissions.js'

/** @param {object} res @param {number} status @param {object} payload */
const sendJson = (res, status, payload) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/**
 * Returns true when the actor holds at least one of the required roles.
 *
 * Supported role names (matching actor boolean flags):
 *   'admin'      → actor.isAdmin
 *   'office'     → actor.isOffice
 *   'financeiro' → actor.isFinanceiro
 *   'comercial'  → actor.isComercial
 *
 * When no roles are specified, authorization is granted unconditionally.
 *
 * @param {object} actor
 * @param {{ role?: string, roles?: string[] }} options
 * @returns {boolean}
 */
function isAuthorized(actor, { role, roles } = {}) {
  const required = roles ?? (role ? [role] : [])
  if (required.length === 0) return true
  return required.some((r) => {
    switch (r) {
      case 'admin':      return actor.isAdmin === true
      case 'office':     return actor.isOffice === true
      case 'financeiro': return actor.isFinanceiro === true
      case 'comercial':  return actor.isComercial === true
      default:           return false
    }
  })
}

/**
 * Authentication + authorization middleware.
 *
 * Wraps a route handler to:
 *   1. Pass through OPTIONS pre-flights without auth checks.
 *   2. Resolve the actor from the request.
 *   3. Return 401 when the request is unauthenticated.
 *   4. Return 403 when the actor lacks the required role.
 *   5. Inject the resolved actor into the handler context as `reqCtx.actor`.
 *
 * @param {(req: object, res: object, reqCtx: object) => Promise<void>} handler
 * @param {{ role?: string, roles?: string[] }} [options]
 * @returns {(req: object, res: object, reqCtx: object) => Promise<void>}
 *
 * @example
 * withAuth(myHandler, { roles: ['admin', 'office'] })
 * withAuth(myHandler, { role: 'admin' })
 */
export function withAuth(handler, options = {}) {
  return async (req, res, reqCtx) => {
    // OPTIONS pre-flights do not carry credentials; pass through without auth.
    if (req.method?.toUpperCase() === 'OPTIONS') {
      await handler(req, res, reqCtx)
      return
    }

    let actor
    try {
      actor = await resolveActor(req)
    } catch {
      sendJson(res, 401, { ok: false, error: 'Autenticação necessária.' })
      return
    }

    if (!actor?.userId) {
      sendJson(res, 401, { ok: false, error: 'Autenticação necessária.' })
      return
    }

    if (!isAuthorized(actor, options)) {
      sendJson(res, 403, { ok: false, error: 'Sem permissão para acessar este recurso.' })
      return
    }

    await handler(req, res, { ...reqCtx, actor })
  }
}
