// server/router.js
// Route registry foundation.
//
// handler.js remains the primary compatibility shim for all other routes.
// Only health endpoints are registered here in this initial phase; other routes
// will be migrated incrementally in subsequent PRs.

/**
 * Creates a new route registry.
 *
 * Registered routes are matched before handler.js falls through to its legacy
 * if-chain, allowing gradual migration without changing endpoint behaviour.
 *
 * @returns {{
 *   register: (method: string, path: string, fn: Function) => void,
 *   match:    (method: string, pathname: string) => Function | null,
 *   size:     number,
 * }}
 */
export function createRouter() {
  /** @type {Array<{method: string, path: string, fn: Function}>} */
  const routes = []

  return {
    /**
     * Register a route handler.
     *
     * Use method `'*'` to match any HTTP method (equivalent to the legacy
     * handler.js behaviour where health routes had no method guard).
     *
     * @param {string}   method - HTTP method ('GET', 'POST', '*', …)
     * @param {string}   path   - Exact pathname to match (e.g. '/api/health')
     * @param {Function} fn     - async (req, res, reqCtx) => void
     */
    register(method, path, fn) {
      routes.push({ method: method.toUpperCase(), path, fn })
    },

    /**
     * Find the handler for the given method + pathname combination.
     *
     * Routes registered with method `'*'` match any HTTP method.
     *
     * @param {string} method   - Uppercase HTTP method
     * @param {string} pathname - Request pathname
     * @returns {Function | null}
     */
    match(method, pathname) {
      const m = method.toUpperCase()
      return (
        routes.find((r) => (r.method === '*' || r.method === m) && r.path === pathname)?.fn ??
        null
      )
    },

    /** Number of registered routes (useful for tests / introspection). */
    get size() {
      return routes.length
    },
  }
}
