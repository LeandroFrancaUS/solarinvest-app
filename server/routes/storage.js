// server/routes/storage.js
// /api/storage route handlers, extracted from handler.js (PR 13).
//
// Response shapes, status codes, and auth behaviour are intentionally
// identical to the originals.  handler.js imports and registers these routes
// via registerStorageRoutes() so it continues to act as the compatibility shim.

import { getStackUser, sanitizeStackUserId } from '../auth/stackAuth.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'

const CORS_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS'

/**
 * Registers all /api/storage routes on the given router.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   storageService:   object | null,
 *   stackAuthEnabled: boolean,
 *   sendJson:         (res: object, status: number, payload: object) => void,
 *   sendNoContent:    (res: object) => void,
 *   readJsonBody:     (req: object) => Promise<object>,
 * }} moduleCtx
 */
export function registerStorageRoutes(router, moduleCtx) {
  const { storageService, stackAuthEnabled, sendJson, sendNoContent, readJsonBody } = moduleCtx

  router.register('*', '/api/storage', async (req, res, { requestId }) => {
    if (!storageService) {
      sendJson(res, 503, { ok: false, code: 'STORAGE_UNAVAILABLE', message: 'Persistência indisponível' })
      return
    }

    const stackUser = await getStackUser(req)
    const fallbackUserId = stackAuthEnabled
      ? sanitizeStackUserId(stackUser && stackUser.payload ? stackUser : null)
      : sanitizeStackUserId(stackUser)

    let actor = null
    try {
      actor = await resolveActor(req)
    } catch (actorErr) {
      const errMsg = actorErr?.message ?? String(actorErr)
      const isAuthError =
        errMsg.includes('Unauthorized') ||
        errMsg.includes('401') ||
        errMsg.includes('unauthenticated') ||
        errMsg.includes('token')
      console.error('[storage] resolveActor failed:', {
        message: actorErr?.message,
        code: actorErr?.code,
        stack: actorErr?.stack,
      })
      if (isAuthError) {
        sendJson(res, 401, { ok: false, code: 'UNAUTHORIZED', message: 'Autenticação obrigatória.' })
      } else {
        sendJson(res, 503, { ok: false, code: 'STORAGE_UNAVAILABLE', message: 'Não foi possível verificar permissões. Tente novamente.' })
      }
      return
    }

    const userId = actor?.userId ?? fallbackUserId
    const resolvedRole = actorRole(actor)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[storage] auth context', { userId, resolvedRole })
    }

    const method = req.method?.toUpperCase() ?? 'GET'

    if (method === 'OPTIONS') {
      res.setHeader('Allow', CORS_ALLOWED_METHODS)
      sendNoContent(res)
      return
    }

    if (stackAuthEnabled && !userId) {
      sendJson(res, 401, { ok: false, code: 'UNAUTHORIZED', message: 'Autenticação obrigatória.' })
      return
    }
    if (stackAuthEnabled && !resolvedRole) {
      sendJson(res, 403, {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Unable to resolve internal app role for SQL session.',
      })
      return
    }

    if (method === 'GET') {
      try {
        if (process.env.NODE_ENV !== 'production') console.log('[storage] applying rls context', { userId, userRole: resolvedRole })
        const entries = await storageService.listEntries({ userId, userRole: resolvedRole })
        sendJson(res, 200, { entries })
      } catch (storageErr) {
        console.error('[storage] failed', {
          userId,
          userRole: resolvedRole,
          message: storageErr?.message,
          code: storageErr?.code,
        })
        sendJson(res, 503, { ok: false, code: 'STORAGE_UNAVAILABLE', message: 'Falha ao acessar armazenamento. Tente novamente.', requestId })
      }
      return
    }

    if (method === 'PUT' || method === 'POST') {
      let body = {}
      try {
        body = await readJsonBody(req)
      } catch (parseError) {
        if (parseError?.code === 'PAYLOAD_TOO_LARGE') {
          sendJson(res, 413, { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Payload acima do limite permitido.' })
          return
        }
        if (parseError?.code === 'INVALID_JSON') {
          sendJson(res, 400, { ok: false, code: 'INVALID_JSON', message: 'JSON inválido na requisição.' })
          return
        }
        throw parseError
      }
      const key = typeof body.key === 'string' ? body.key.trim() : ''
      const value = body.value === undefined ? null : body.value
      if (!key) {
        sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', message: 'Chave de armazenamento inválida.' })
        return
      }
      try {
        if (process.env.NODE_ENV !== 'production') console.log('[storage] applying rls context', { userId, userRole: resolvedRole })
        await storageService.setEntry({ userId, userRole: resolvedRole }, key, value)
        sendNoContent(res)
      } catch (storageErr) {
        if (storageErr?.code === 'STORAGE_PAYLOAD_TOO_LARGE') {
          sendJson(res, 413, { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Payload acima do limite permitido.' })
          return
        }
        console.error('[storage] failed', {
          userId,
          userRole: resolvedRole,
          message: storageErr?.message,
          code: storageErr?.code,
        })
        sendJson(res, 503, { ok: false, code: 'STORAGE_UNAVAILABLE', message: 'Falha ao salvar no armazenamento. Tente novamente.', requestId })
      }
      return
    }

    if (method === 'DELETE') {
      let body = {}
      try {
        body = await readJsonBody(req)
      } catch (parseError) {
        if (parseError?.code === 'PAYLOAD_TOO_LARGE') {
          sendJson(res, 413, { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Payload acima do limite permitido.' })
          return
        }
        if (parseError?.code === 'INVALID_JSON') {
          sendJson(res, 400, { ok: false, code: 'INVALID_JSON', message: 'JSON inválido na requisição.' })
          return
        }
        throw parseError
      }
      const key = typeof body.key === 'string' ? body.key.trim() : ''
      try {
        if (process.env.NODE_ENV !== 'production') console.log('[storage] applying rls context', { userId, userRole: resolvedRole })
        if (!key) {
          await storageService.clear({ userId, userRole: resolvedRole })
        } else {
          await storageService.removeEntry({ userId, userRole: resolvedRole }, key)
        }
        sendNoContent(res)
      } catch (storageErr) {
        console.error('[storage] failed', {
          userId,
          userRole: resolvedRole,
          message: storageErr?.message,
          code: storageErr?.code,
        })
        sendJson(res, 503, { ok: false, code: 'STORAGE_UNAVAILABLE', message: 'Falha ao remover do armazenamento. Tente novamente.', requestId })
      }
      return
    }

    sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Método não suportado.' })
  })
}
