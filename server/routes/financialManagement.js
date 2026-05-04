// server/routes/financialManagement.js
// Route registrations for /api/financial-management
//
// Routes covered:
//   GET              /api/financial-management/summary
//   GET              /api/financial-management/projects
//   GET              /api/financial-management/cashflow
//   GET              /api/financial-management/categories
//   GET              /api/financial-management/dashboard-feed
//   GET|POST|PUT|DEL /api/financial-management/entries
//   GET|POST|PUT|DEL /api/financial-management/entries/:id

import { jsonResponse, noContentResponse } from '../response.js'
import {
  handleFinancialSummary,
  handleFinancialProjects,
  handleFinancialCashflow,
  handleFinancialEntries,
  handleFinancialCategories,
  handleFinancialDashboardFeed,
} from '../financial-management/handler.js'

/**
 * @param {import('../router.js').Router} router
 * @param {{ readJsonBody: Function }} moduleCtx
 */
export function registerFinancialManagementRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  router.register('*', '/api/financial-management/summary', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleFinancialSummary(req, res, { method, sendJson, requestUrl: req.url ?? '' })
  })

  router.register('*', '/api/financial-management/projects', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleFinancialProjects(req, res, { method, sendJson, requestUrl: req.url ?? '' })
  })

  router.register('*', '/api/financial-management/cashflow', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleFinancialCashflow(req, res, { method, sendJson, requestUrl: req.url ?? '' })
  })

  router.register('*', '/api/financial-management/categories', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleFinancialCategories(req, res, { method, sendJson })
  })

  router.register('*', '/api/financial-management/dashboard-feed', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleFinancialDashboardFeed(req, res, { method, sendJson, requestUrl: req.url ?? '' })
  })

  // /api/financial-management/entries/:id — parameterised, registered before exact /entries
  router.register('*', '/api/financial-management/entries/:id', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => {
      if (b === null) { noContentResponse(res); return }
      jsonResponse(res, s, b)
    }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,PUT,DELETE,OPTIONS' }); return }
    const body = ['POST', 'PUT'].includes(method) ? await readJsonBody(req) : undefined
    // Pass the full URL so the handler can extract the ID from the path itself
    await handleFinancialEntries(req, res, { method, sendJson, requestUrl: req.url ?? '', body })
  })

  // /api/financial-management/entries — exact collection endpoint
  router.register('*', '/api/financial-management/entries', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => {
      if (b === null) { noContentResponse(res); return }
      jsonResponse(res, s, b)
    }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,PUT,DELETE,OPTIONS' }); return }
    const body = ['POST', 'PUT'].includes(method) ? await readJsonBody(req) : undefined
    await handleFinancialEntries(req, res, { method, sendJson, requestUrl: req.url ?? '', body })
  })
}
