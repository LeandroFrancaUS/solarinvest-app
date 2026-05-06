// server/routes/financialAnalyses.js
// Route registration for /api/financial-analyses
//
// The domain handler performs full method dispatch internally.
// The original handler.js entry has no OPTIONS pre-flight or method guard —
// this matches that exact behavior.

import { jsonResponse } from '../response.js'
import { handleFinancialAnalyses } from '../financial-analyses/handler.js'

/**
 * @param {import('../router.js').Router} router
 * @param {{ readJsonBody: Function }} moduleCtx
 */
export function registerFinancialAnalysesRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  router.register('*', '/api/financial-analyses', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    await handleFinancialAnalyses(req, res, {
      method,
      readJsonBody,
      sendJson: (status, payload) => jsonResponse(res, status, payload),
    })
  })
}
