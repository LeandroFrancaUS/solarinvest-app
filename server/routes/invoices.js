// server/routes/invoices.js
// Route registrations for /api/invoices
//
// Routes covered:
//   GET|POST  /api/invoices
//   GET       /api/invoices/notifications
//   GET|POST  /api/invoices/notification-config
//   PATCH|DEL /api/invoices/:invoiceId
//   POST      /api/invoices/:invoiceId/payment

import { jsonResponse, noContentResponse } from '../response.js'
import {
  handleInvoicesListRequest,
  handleInvoicesCreateRequest,
  handleInvoicesUpdateRequest,
  handleInvoicesDeleteRequest,
  handleInvoicePaymentRequest,
  handleInvoiceNotificationsRequest,
  handleInvoiceNotificationConfigGetRequest,
  handleInvoiceNotificationConfigUpdateRequest,
} from '../invoices/handler.js'

/**
 * @param {import('../router.js').Router} router
 * @param {{ readJsonBody: Function }} moduleCtx
 */
export function registerInvoicesRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  // Exact routes registered before parameterised /:invoiceId to ensure priority

  // GET /api/invoices/notifications
  router.register('*', '/api/invoices/notifications', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    await handleInvoiceNotificationsRequest(req, res, { method, sendJson })
  })

  // GET|POST /api/invoices/notification-config
  router.register('*', '/api/invoices/notification-config', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method === 'GET') {
      await handleInvoiceNotificationConfigGetRequest(req, res, { method, sendJson })
    } else if (method === 'POST') {
      const body = await readJsonBody(req)
      await handleInvoiceNotificationConfigUpdateRequest(req, res, { method, sendJson, body })
    } else {
      jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    }
  })

  // POST /api/invoices/:invoiceId/payment — registered before /:invoiceId
  router.register('*', '/api/invoices/:invoiceId/payment', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }); return }
    const invoiceId = Number(reqCtx.params?.invoiceId)
    if (!Number.isFinite(invoiceId) || invoiceId < 1) { jsonResponse(res, 404, { error: { code: 'NOT_FOUND', message: 'Invoice não encontrada.' } }); return }
    const body = await readJsonBody(req)
    await handleInvoicePaymentRequest(req, res, { method, invoiceId, sendJson, body })
  })

  // PATCH|DELETE /api/invoices/:invoiceId
  router.register('*', '/api/invoices/:invoiceId', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,DELETE,OPTIONS' }); return }
    const invoiceId = Number(reqCtx.params?.invoiceId)
    if (!Number.isFinite(invoiceId) || invoiceId < 1) { jsonResponse(res, 404, { error: { code: 'NOT_FOUND', message: 'Invoice não encontrada.' } }); return }
    if (method === 'PATCH') {
      const body = await readJsonBody(req)
      await handleInvoicesUpdateRequest(req, res, { method, invoiceId, sendJson, body })
    } else if (method === 'DELETE') {
      await handleInvoicesDeleteRequest(req, res, { method, invoiceId, sendJson })
    } else {
      jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    }
  })

  // GET|POST /api/invoices
  router.register('*', '/api/invoices', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method === 'GET') {
      await handleInvoicesListRequest(req, res, { method, sendJson, requestUrl: req.url ?? '' })
    } else if (method === 'POST') {
      const body = await readJsonBody(req)
      await handleInvoicesCreateRequest(req, res, { method, sendJson, body })
    } else {
      jsonResponse(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    }
  })
}
