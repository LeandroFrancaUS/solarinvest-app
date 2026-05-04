// server/middleware/withRateLimit.js
// Rate-limiting middleware.
//
// Returns 429 Too Many Requests when the configured limit is exceeded.
// OPTIONS pre-flight requests are always passed through without rate-limit
// checks, ensuring CORS pre-flights are never blocked.
//
// Two modes:
//   check mode      — { check: (req) => boolean }
//   standalone mode — { limit: number, windowMs: number }

/** @param {object} res @param {number} status @param {object} payload */
const sendJson = (res, status, payload) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/**
 * Extracts the best-effort client IP from the request.
 *
 * @param {object} req
 * @returns {string}
 */
function getClientIp(req) {
  const forwarded =
    typeof req.headers?.['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : ''
  return forwarded || req.socket?.remoteAddress || ''
}

/**
 * Rate-limiting middleware.
 *
 * **check mode** (`{ check }`)
 *   Delegates to an existing rate-limit function such as `isAdminRateLimited`.
 *   Use this when migrating routes that already share a global bucket.
 *
 * **standalone mode** (`{ limit, windowMs }`)
 *   Creates a per-IP sliding-window bucket scoped to this middleware instance.
 *   Use this for new routes that do not share a bucket.
 *   Defaults: limit = 30 requests, windowMs = 60 000 ms.
 *
 * OPTIONS pre-flight requests are never rate-limited.
 *
 * @param {(req: object, res: object, reqCtx: object) => Promise<void>} handler
 * @param {{
 *   check?:    (req: object) => boolean,
 *   limit?:    number,
 *   windowMs?: number,
 * }} [options]
 * @returns {(req: object, res: object, reqCtx: object) => Promise<void>}
 *
 * @example
 * // Delegate to an existing check function
 * withRateLimit(myHandler, { check: isAdminRateLimited })
 *
 * @example
 * // Self-contained per-route bucket
 * withRateLimit(myHandler, { limit: 10, windowMs: 60_000 })
 */
export function withRateLimit(handler, options = {}) {
  if (options.check) {
    const check = options.check

    return async (req, res, reqCtx) => {
      // OPTIONS pre-flights are never rate-limited.
      if (req.method?.toUpperCase() === 'OPTIONS') {
        await handler(req, res, reqCtx)
        return
      }

      if (check(req)) {
        sendJson(res, 429, { error: 'Too many requests. Try again later.' })
        return
      }

      await handler(req, res, reqCtx)
    }
  }

  // Standalone sliding-window rate limiter, scoped to this instance.
  const limit = options.limit ?? 30
  const windowMs = options.windowMs ?? 60_000
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map()

  return async (req, res, reqCtx) => {
    // OPTIONS pre-flights are never rate-limited.
    if (req.method?.toUpperCase() === 'OPTIONS') {
      await handler(req, res, reqCtx)
      return
    }

    const ip = getClientIp(req)

    if (ip) {
      const now = Date.now()

      // Purge expired buckets when the map grows too large.
      if (buckets.size > 10_000) {
        for (const [key, bucket] of buckets) {
          if (bucket.resetAt <= now) buckets.delete(key)
        }
      }

      let bucket = buckets.get(ip)
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs }
        buckets.set(ip, bucket)
      }

      bucket.count += 1

      if (bucket.count > limit) {
        sendJson(res, 429, { error: 'Too many requests. Try again later.' })
        return
      }
    }

    await handler(req, res, reqCtx)
  }
}
