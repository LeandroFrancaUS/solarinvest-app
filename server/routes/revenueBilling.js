// server/routes/revenueBilling.js
// Route registration for /api/revenue-billing
//
// Routes covered:
//   GET /api/revenue-billing/clients

import { jsonResponse, noContentResponse } from '../response.js'
import { handleRevenueClients } from '../revenue-billing/handler.js'

/**
 * @param {import('../router.js').Router} router
 * @param {{}} _moduleCtx
 */
export function registerRevenueBillingRoutes(router, _moduleCtx) {
  router.register('*', '/api/revenue-billing/clients', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleRevenueClients(req, res, { method, sendJson, requestUrl: req.url ?? '' })
  })
}
