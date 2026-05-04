// server/middleware/withErrorHandler.js
// Error-handling middleware.
//
// Wraps route handlers in a try/catch to prevent unhandled promise rejections
// from crashing the server and ensures a consistent JSON error response shape.
// Sensitive details (stack traces, internal messages) are never leaked in
// production.
//
// The HTTP status code is taken from `error.statusCode` when present;
// otherwise it defaults to 500.

/** @param {object} res @param {number} status @param {object} payload */
const sendJson = (res, status, payload) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/** @type {Record<number, string>} */
const STATUS_MESSAGES = {
  401: 'Autenticação necessária.',
  403: 'Sem permissão para acessar este recurso.',
  404: 'Recurso não encontrado.',
  500: 'Erro interno do servidor.',
}

/**
 * Error-handling middleware.
 *
 * Catches any uncaught error thrown by `handler` and returns a standardised
 * JSON error response.  If the response has already started (res.headersSent),
 * the error is logged and swallowed to avoid a double-write.
 *
 * Use `error.statusCode` to propagate a custom HTTP status code:
 *   const err = new Error('Not found')
 *   err.statusCode = 404
 *   throw err
 *
 * @param {(req: object, res: object, reqCtx: object) => Promise<void>} handler
 * @returns {(req: object, res: object, reqCtx: object) => Promise<void>}
 *
 * @example
 * withErrorHandler(myHandler)
 * withErrorHandler(withRateLimit(withAuth(myHandler, options), rlOptions))
 */
export function withErrorHandler(handler) {
  return async (req, res, reqCtx) => {
    try {
      await handler(req, res, reqCtx)
    } catch (err) {
      if (res.headersSent) {
        console.error('[withErrorHandler] response already sent, error swallowed:', err?.message)
        return
      }
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500
      const message =
        STATUS_MESSAGES[status] ??
        (process.env.NODE_ENV !== 'production' && err?.message
          ? err.message
          : 'Erro interno do servidor.')

      sendJson(res, status, { ok: false, error: message })
    }
  }
}
