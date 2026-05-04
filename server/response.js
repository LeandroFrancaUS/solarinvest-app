// server/response.js
// Shared HTTP response helpers.
//
// Thin wrappers around Node.js ServerResponse that standardize status codes,
// Content-Type headers, and response bodies.  All helpers are no-ops when
// res.headersSent is already true.

/**
 * Sends a JSON response with the given status code and optional extra headers.
 *
 * @param {object} res
 * @param {number} statusCode
 * @param {object} payload
 * @param {Record<string, string>} [headers]
 */
export function jsonResponse(res, statusCode, payload, headers = {}) {
  if (res.headersSent) return
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
  res.end(JSON.stringify(payload))
}

/**
 * Sends a 204 No Content response.
 *
 * @param {object} res
 * @param {Record<string, string>} [headers]
 */
export function noContentResponse(res, headers = {}) {
  if (res.headersSent) return
  res.statusCode = 204
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
  res.end()
}

/**
 * Sends a 405 Method Not Allowed response with the Allow header set.
 *
 * @param {object} res
 * @param {string | string[]} allowedMethods
 */
export function methodNotAllowedResponse(res, allowedMethods) {
  const allow = Array.isArray(allowedMethods) ? allowedMethods.join(',') : allowedMethods
  jsonResponse(res, 405, { error: 'Method not allowed' }, { Allow: allow })
}

/**
 * Sends a 401 Unauthorized response.
 *
 * @param {object} res
 * @param {object} [payload]
 */
export function unauthorizedResponse(res, payload = { error: 'Unauthorized' }) {
  jsonResponse(res, 401, payload)
}

/**
 * Sends a 403 Forbidden response.
 *
 * @param {object} res
 * @param {object} [payload]
 */
export function forbiddenResponse(res, payload = { error: 'Forbidden' }) {
  jsonResponse(res, 403, payload)
}

/**
 * Sends a 429 Too Many Requests response.
 *
 * @param {object} res
 * @param {object} [payload]
 */
export function tooManyRequestsResponse(res, payload = { error: 'Too many requests' }) {
  jsonResponse(res, 429, payload)
}

/**
 * Sends a 503 Service Unavailable response.
 *
 * @param {object} res
 * @param {object} [payload]
 */
export function serviceUnavailableResponse(res, payload = { error: 'Service unavailable' }) {
  jsonResponse(res, 503, payload)
}

/**
 * Sends a 500 Internal Server Error response.
 *
 * @param {object} res
 * @param {object} [payload]
 */
export function internalErrorResponse(res, payload = { error: 'Internal server error' }) {
  jsonResponse(res, 500, payload)
}

/**
 * Sends an error response, deriving the HTTP status from the error's
 * `statusCode` or `status` property.  Falls back to 500.
 *
 * Safe to call in production — never leaks raw error messages.
 *
 * @param {object} res
 * @param {unknown} error
 * @param {string} [fallbackMessage]
 */
export function errorResponse(res, error, fallbackMessage = 'Internal server error') {
  if (res.headersSent) return

  const rawStatus =
    typeof /** @type {any} */ (error)?.statusCode === 'number'
      ? /** @type {any} */ (error).statusCode
      : typeof /** @type {any} */ (error)?.status === 'number'
        ? /** @type {any} */ (error).status
        : 500

  const safeStatus = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500

  if (safeStatus === 401) return jsonResponse(res, 401, { error: 'Unauthorized' })
  if (safeStatus === 403) return jsonResponse(res, 403, { error: 'Forbidden' })
  if (safeStatus === 404) return jsonResponse(res, 404, { error: 'Not found' })
  if (safeStatus === 429) return jsonResponse(res, 429, { error: 'Too many requests' })
  if (safeStatus === 503) return jsonResponse(res, 503, { error: fallbackMessage })
  return jsonResponse(res, 500, { error: fallbackMessage })
}
