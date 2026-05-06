// server/routes/portfolio.js
// Route registrations for Carteira de Clientes (client portfolio)
//
// Routes covered:
//   PATCH          /api/clients/:clientId/portfolio-export  — convert client to portfolio
//   PATCH          /api/clients/:clientId/portfolio-remove  — remove from portfolio
//   GET            /api/dashboard/portfolio/summary         — dashboard summary
//   GET            /api/client-portfolio                    — list portfolio clients
//   GET            /api/client-portfolio/:clientId          — get single portfolio client
//   PATCH          /api/client-portfolio/:clientId/profile  — update profile
//   PATCH          /api/client-portfolio/:clientId/contract — update contract data
//   PATCH          /api/client-portfolio/:clientId/project  — update project data
//   PATCH          /api/client-portfolio/:clientId/billing  — update billing data
//   PATCH          /api/client-portfolio/:clientId/plan     — update plan data
//   GET|POST       /api/client-portfolio/:clientId/notes    — get / add client notes

import { jsonResponse, noContentResponse } from '../response.js'
import {
  handlePortfolioListRequest,
  handlePortfolioGetRequest,
  handlePortfolioExportRequest,
  handlePortfolioRemoveRequest,
  handlePortfolioProfilePatch,
  handlePortfolioContractPatch,
  handlePortfolioProjectPatch,
  handlePortfolioBillingPatch,
  handlePortfolioPlanPatch,
  handlePortfolioNotesRequest,
  handleDashboardPortfolioSummary,
} from '../client-portfolio/handler.js'

const METHOD_NOT_ALLOWED = { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }

/**
 * @param {import('../router.js').Router} router
 * @param {{ readJsonBody: Function }} moduleCtx
 */
export function registerPortfolioRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  // ── Routes under /api/clients/:clientId ──────────────────────────────────
  // Registered with a distinct sub-segment so they never conflict with
  // /api/clients/:id (which has no trailing segment).

  // PATCH /api/clients/:clientId/portfolio-export
  // Portfolio handlers use sendJson as a 2-arg (status, body) closure.
  router.register('*', '/api/clients/:clientId/portfolio-export', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioExportRequest(req, res, { method, clientId, sendJson })
  })

  // PATCH /api/clients/:clientId/portfolio-remove
  router.register('*', '/api/clients/:clientId/portfolio-remove', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioRemoveRequest(req, res, { method, clientId, sendJson })
  })

  // ── Exact routes ──────────────────────────────────────────────────────────

  // GET /api/dashboard/portfolio/summary
  router.register('*', '/api/dashboard/portfolio/summary', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    await handleDashboardPortfolioSummary(req, res, { method, sendJson })
  })

  // GET /api/client-portfolio
  router.register('*', '/api/client-portfolio', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    // handlePortfolioListRequest expects requestUrl as a string (calls new URL(requestUrl, …) internally).
    await handlePortfolioListRequest(req, res, { method, sendJson, requestUrl: req.url ?? '' })
  })

  // ── Parameterised sub-routes (must be registered before /:clientId) ───────

  // PATCH /api/client-portfolio/:clientId/profile
  router.register('*', '/api/client-portfolio/:clientId/profile', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioProfilePatch(req, res, { method, clientId, readJsonBody, sendJson })
  })

  // PATCH /api/client-portfolio/:clientId/contract
  router.register('*', '/api/client-portfolio/:clientId/contract', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioContractPatch(req, res, { method, clientId, readJsonBody, sendJson })
  })

  // PATCH /api/client-portfolio/:clientId/project
  router.register('*', '/api/client-portfolio/:clientId/project', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioProjectPatch(req, res, { method, clientId, readJsonBody, sendJson })
  })

  // PATCH /api/client-portfolio/:clientId/billing
  router.register('*', '/api/client-portfolio/:clientId/billing', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioBillingPatch(req, res, { method, clientId, readJsonBody, sendJson })
  })

  // PATCH /api/client-portfolio/:clientId/plan
  router.register('*', '/api/client-portfolio/:clientId/plan', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioPlanPatch(req, res, { method, clientId, readJsonBody, sendJson })
  })

  // GET|POST /api/client-portfolio/:clientId/notes
  router.register('*', '/api/client-portfolio/:clientId/notes', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method !== 'GET' && method !== 'POST') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioNotesRequest(req, res, { method, clientId, readJsonBody, sendJson })
  })

  // GET /api/client-portfolio/:clientId — registered last among parameterised routes
  router.register('*', '/api/client-portfolio/:clientId', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const clientId = Number(reqCtx.params?.clientId)
    await handlePortfolioGetRequest(req, res, { method, clientId, sendJson })
  })
}
