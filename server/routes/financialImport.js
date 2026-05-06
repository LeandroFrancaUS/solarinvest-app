// server/routes/financialImport.js
// Route registrations for /api/financial-import
//
// Routes covered:
//   POST /api/financial-import/parse
//   POST /api/financial-import/confirm
//   GET  /api/financial-import/batches

import { jsonResponse, noContentResponse } from '../response.js'
import {
  handleFinancialImportParse,
  handleFinancialImportConfirm,
  handleFinancialImportBatches,
} from '../financial-import/handler.js'

/**
 * @param {import('../router.js').Router} router
 * @param {{}} _moduleCtx
 */
export function registerFinancialImportRoutes(router, _moduleCtx) {
  router.register('*', '/api/financial-import/parse', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleFinancialImportParse(req, res, { method, sendJson })
  })

  router.register('*', '/api/financial-import/confirm', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleFinancialImportConfirm(req, res, { method, sendJson })
  })

  router.register('*', '/api/financial-import/batches', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleFinancialImportBatches(req, res, { method, sendJson, requestUrl: req.url ?? '' })
  })
}
