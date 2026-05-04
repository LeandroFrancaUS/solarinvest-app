// server/routes/aneel.js
// ANEEL proxy route.
// Extracted from the handler.js inline if-chain (PR 22).

import { handleAneelProxyRequest, DEFAULT_PROXY_BASE } from '../aneelProxy.js'

/**
 * Registers the ANEEL proxy route on the given router.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {object} _moduleCtx  — no shared dependencies required
 */
export function registerAneelRoutes(router, _moduleCtx) {
  router.register('*', DEFAULT_PROXY_BASE, async (req, res) => {
    await handleAneelProxyRequest(req, res)
  })
}
