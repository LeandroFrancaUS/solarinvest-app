// server/routes/operationalTasks.js
// Route registrations for /api/operational-tasks and /api/dashboard/notification-preferences
//
// Routes covered:
//   GET|POST  /api/operational-tasks
//   PATCH|DEL /api/operational-tasks/:taskId
//   GET       /api/operational-tasks/:taskId/history
//   GET|POST  /api/dashboard/notification-preferences

import { jsonResponse, noContentResponse } from '../response.js'
import {
  handleOperationalTasksListRequest,
  handleOperationalTasksCreateRequest,
  handleOperationalTasksUpdateRequest,
  handleOperationalTasksDeleteRequest,
  handleTaskHistoryRequest,
  handleNotificationPreferencesGetRequest,
  handleNotificationPreferencesUpdateRequest,
} from '../operational-tasks/handler.js'

/**
 * @param {import('../router.js').Router} router
 * @param {{ readJsonBody: Function }} moduleCtx
 */
export function registerOperationalTasksRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  // GET /api/operational-tasks/:taskId/history — registered before /:taskId
  router.register('*', '/api/operational-tasks/:taskId/history', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    const taskId = parseInt(reqCtx.params?.taskId ?? '', 10)
    if (!Number.isFinite(taskId) || taskId < 1) { jsonResponse(res, 404, { error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada.' } }); return }
    await handleTaskHistoryRequest(req, res, { method, taskId, sendJson, requestUrl: req.url ?? '' })
  })

  // PATCH|DELETE /api/operational-tasks/:taskId
  router.register('*', '/api/operational-tasks/:taskId', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,DELETE,OPTIONS' }); return }
    const taskId = parseInt(reqCtx.params?.taskId ?? '', 10)
    if (!Number.isFinite(taskId) || taskId < 1) { jsonResponse(res, 404, { error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada.' } }); return }
    if (method === 'PATCH') {
      const body = await readJsonBody(req)
      await handleOperationalTasksUpdateRequest(req, res, { method, taskId, sendJson, body })
    } else if (method === 'DELETE') {
      await handleOperationalTasksDeleteRequest(req, res, { method, taskId, sendJson })
    } else {
      jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    }
  })

  // GET|POST /api/operational-tasks
  router.register('*', '/api/operational-tasks', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method === 'GET') {
      await handleOperationalTasksListRequest(req, res, { method, sendJson, requestUrl: req.url ?? '' })
    } else if (method === 'POST') {
      const body = await readJsonBody(req)
      await handleOperationalTasksCreateRequest(req, res, { method, sendJson, body })
    } else {
      jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    }
  })

  // GET|POST /api/dashboard/notification-preferences
  router.register('*', '/api/dashboard/notification-preferences', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method === 'GET') {
      await handleNotificationPreferencesGetRequest(req, res, { method, sendJson })
    } else if (method === 'POST') {
      const body = await readJsonBody(req)
      await handleNotificationPreferencesUpdateRequest(req, res, { method, sendJson, body })
    } else {
      jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    }
  })
}
