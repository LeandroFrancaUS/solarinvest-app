// server/routes/clients.js
// Route registrations for /api/clients
//
// Routes covered:
//   POST     /api/clients/upsert-by-cpf       — offline-first client upsert
//   POST     /api/clients/bulk-import/preview  — deduplication preview (no DB writes)
//   POST     /api/clients/bulk-import          — enterprise bulk import
//   POST     /api/clients/consultor-backfill   — normalize consultant metadata
//   GET|POST /api/clients                      — list / create client
//   GET      /api/clients/:id/proposals        — proposals belonging to a client
//   GET|PUT|DELETE /api/clients/:id            — get / update / soft-delete client

import { jsonResponse, noContentResponse } from '../response.js'
import {
  handleUpsertClientByCpf,
  handleClientsRequest,
  handleClientByIdRequest,
} from '../clients/handler.js'
import {
  handleBulkImportPreview,
  handleBulkImport,
} from '../clients/bulkImport.js'

const METHOD_NOT_ALLOWED = { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }

/**
 * @param {import('../router.js').Router} router
 * @param {{ readJsonBody: Function }} moduleCtx
 */
export function registerClientsRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  // ── Exact routes (registered before parameterised /:id) ───────────────────

  // POST /api/clients/upsert-by-cpf
  // Clients handler wraps ctx.sendJson as (res, s, p) => … so we pass jsonResponse (3-arg).
  router.register('*', '/api/clients/upsert-by-cpf', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    await handleUpsertClientByCpf(req, res, { method, readJsonBody, sendJson: jsonResponse })
  })

  // POST /api/clients/bulk-import/preview
  router.register('*', '/api/clients/bulk-import/preview', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    await handleBulkImportPreview(req, res, { method, readJsonBody, sendJson: jsonResponse })
  })

  // POST /api/clients/bulk-import
  router.register('*', '/api/clients/bulk-import', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    await handleBulkImport(req, res, { method, readJsonBody, sendJson: jsonResponse })
  })

  // POST /api/clients/consultor-backfill
  // Delegated to handleClientsRequest which inspects requestUrl.pathname internally.
  router.register('*', '/api/clients/consultor-backfill', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,OPTIONS' }); return }
    if (method !== 'POST') { jsonResponse(res, 405, METHOD_NOT_ALLOWED); return }
    const requestUrl = new URL(req.url ?? '/', 'http://localhost')
    await handleClientsRequest(req, res, { method, readJsonBody, sendJson: jsonResponse, requestUrl })
  })

  // GET|POST /api/clients
  router.register('*', '/api/clients', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    const requestUrl = new URL(req.url ?? '/', 'http://localhost')
    await handleClientsRequest(req, res, { method, readJsonBody, sendJson: jsonResponse, requestUrl })
  })

  // ── Parameterised routes (exact routes always take priority) ──────────────

  // GET /api/clients/:id/proposals — must be registered before /:id
  router.register('*', '/api/clients/:id/proposals', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,PUT,DELETE,OPTIONS' }); return }
    const clientId = reqCtx.params?.id ?? ''
    await handleClientByIdRequest(req, res, { method, clientId, subpath: 'proposals', readJsonBody, sendJson: jsonResponse })
  })

  // GET|PUT|DELETE /api/clients/:id
  router.register('*', '/api/clients/:id', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,PUT,DELETE,OPTIONS' }); return }
    const clientId = reqCtx.params?.id ?? ''
    await handleClientByIdRequest(req, res, { method, clientId, subpath: null, readJsonBody, sendJson: jsonResponse })
  })
}
