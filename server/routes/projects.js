// server/routes/projects.js
// Route registrations for /api/projects (including /api/projects/:id/finance
// which is handled by the project-finance domain handler).
//
// Routes covered:
//   GET    /api/projects
//   GET    /api/projects/summary
//   POST   /api/projects/from-plan/:planId
//   GET    /api/projects/:id
//   PATCH  /api/projects/:id
//   GET    /api/projects/:id/finance
//   PUT    /api/projects/:id/finance
//   PATCH  /api/projects/:id/status
//   PATCH  /api/projects/:id/pv-data

import { jsonResponse, noContentResponse } from '../response.js'
import {
  handleProjectsList,
  handleProjectsSummary,
  handleProjectById,
  handleProjectStatus,
  handleProjectPvData,
  handleProjectFromPlan,
} from '../projects/handler.js'
import { handleProjectFinance } from '../project-finance/handler.js'

/**
 * @param {import('../router.js').Router} router
 * @param {{ readJsonBody: Function }} moduleCtx
 */
export function registerProjectsRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  // GET /api/projects/summary — exact, registered before /:id
  router.register('*', '/api/projects/summary', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleProjectsSummary(req, res, { method, sendJson })
  })

  // POST /api/projects/from-plan/:planId — exact prefix registered before /:id
  router.register('*', '/api/projects/from-plan/:planId', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    const planId = decodeURIComponent(reqCtx.params?.planId ?? '')
    await handleProjectFromPlan(req, res, { method, planId, readJsonBody, sendJson })
  })

  // GET|PUT /api/projects/:id/finance
  router.register('*', '/api/projects/:id/finance', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,PUT,OPTIONS' }); return }
    if (method !== 'GET' && method !== 'PUT') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    const projectId = reqCtx.params?.id ?? ''
    await handleProjectFinance(req, res, { method, projectId, readJsonBody, sendJson })
  })

  // PATCH /api/projects/:id/status
  router.register('*', '/api/projects/:id/status', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    const projectId = reqCtx.params?.id ?? ''
    await handleProjectStatus(req, res, { method, projectId, readJsonBody, sendJson })
  })

  // PATCH /api/projects/:id/pv-data
  router.register('*', '/api/projects/:id/pv-data', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    const projectId = reqCtx.params?.id ?? ''
    await handleProjectPvData(req, res, { method, projectId, readJsonBody, sendJson })
  })

  // GET|PATCH /api/projects/:id
  router.register('*', '/api/projects/:id', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,PATCH,OPTIONS' }); return }
    if (method !== 'GET' && method !== 'PATCH') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    const projectId = reqCtx.params?.id ?? ''
    await handleProjectById(req, res, { method, projectId, readJsonBody, sendJson })
  })

  // GET /api/projects
  router.register('*', '/api/projects', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleProjectsList(req, res, { method, sendJson, requestUrl: req.url ?? '' })
  })
}
