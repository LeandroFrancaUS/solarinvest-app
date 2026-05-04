// server/router.js
// Route registry foundation.
//
// handler.js remains the primary compatibility shim for all other routes.
// Routes are migrated incrementally via registerXRoutes() helpers.
//
// Supports both exact path matching and parameterized paths (e.g. /api/foo/:id).
// Exact-path routes always take priority over parameterized routes so that
// static segments like /api/consultants/picker are never shadowed by :id patterns.

/**
 * Compiles a path template (which may contain `:param` segments) into a regex
 * and a list of parameter names.
 *
 * @param {string} path - Route path, e.g. '/api/consultants/:id' or '/api/health'
 * @returns {{ regex: RegExp, paramNames: string[], isPattern: boolean }}
 */
function compilePattern(path) {
  const paramNames = []
  const regexStr = path.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name)
    return '([^/]+)'
  })
  return {
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
    isPattern: paramNames.length > 0,
  }
}

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
  /**
   * @type {Array<{
   *   method: string,
   *   path: string,
   *   regex: RegExp,
   *   paramNames: string[],
   *   isPattern: boolean,
   *   fn: Function
   * }>}
   */
  const routes = []

  return {
    /**
     * Register a route handler.
     *
     * Use method `'*'` to match any HTTP method (equivalent to the legacy
     * handler.js behaviour where health routes had no method guard).
     *
     * Paths may contain `:param` segments (e.g. '/api/consultants/:id').
     * Exact-path routes always take precedence over parameterized routes.
     * When a parameterized route matches, extracted params are injected into
     * `reqCtx` as `reqCtx.params` before the handler is called.
     *
     * @param {string}   method - HTTP method ('GET', 'POST', '*', …)
     * @param {string}   path   - Pathname to match, with optional :param segments
     * @param {Function} fn     - async (req, res, reqCtx) => void
     */
    register(method, path, fn) {
      const { regex, paramNames, isPattern } = compilePattern(path)
      routes.push({ method: method.toUpperCase(), path, regex, paramNames, isPattern, fn })
    },

    /**
     * Find the handler for the given method + pathname combination.
     *
     * Exact-path routes are checked first; parameterized routes are checked
     * second.  Routes registered with method `'*'` match any HTTP method.
     *
     * For parameterized routes the returned function is a thin wrapper that
     * injects the extracted path params into `reqCtx.params` before delegating
     * to the original handler — the call signature `(req, res, reqCtx)` is
     * unchanged for all callers.
     *
     * @param {string} method   - Uppercase HTTP method
     * @param {string} pathname - Request pathname
     * @returns {Function | null}
     */
    match(method, pathname) {
      const m = method.toUpperCase()

      // Pass 1: exact-path routes (isPattern=false) — same behaviour as before.
      for (const route of routes) {
        if (route.isPattern) continue
        if (route.method !== '*' && route.method !== m) continue
        if (route.path === pathname) return route.fn
      }

      // Pass 2: parameterized routes (isPattern=true).
      for (const route of routes) {
        if (!route.isPattern) continue
        if (route.method !== '*' && route.method !== m) continue
        const hit = pathname.match(route.regex)
        if (hit) {
          const params = Object.fromEntries(
            route.paramNames.map((name, i) => [name, hit[i + 1]]),
          )
          // Return a stable-signature wrapper so callers need no changes.
          return (req, res, reqCtx) => route.fn(req, res, { ...reqCtx, params })
        }
      }

      return null
    },

    /** Number of registered routes (useful for tests / introspection). */
    get size() {
      return routes.length
    },
  }
}
