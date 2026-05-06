// server/routes/proposals.js
// Route registrations for /api/proposals
//
// Routes covered:
//   GET|POST           /api/proposals     — list / create proposal
//   GET|PATCH|DELETE   /api/proposals/:id — get / update / soft-delete proposal

import { jsonResponse, noContentResponse } from '../response.js'
import {
  handleProposalsRequest,
  handleProposalByIdRequest,
} from '../proposals/handler.js'

const METHOD_NOT_ALLOWED = { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }

/**
 * @param {import('../router.js').Router} router
 * @param {{ readJsonBody: Function }} moduleCtx
 */
export function registerProposalsRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  // GET|POST /api/proposals
  // Proposal handler wraps ctx.sendJson as (res, s, p) => … so we pass jsonResponse (3-arg).
  router.register('*', '/api/proposals', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    const requestUrl = new URL(req.url ?? '/', 'http://localhost')
    await handleProposalsRequest(req, res, { method, readJsonBody, sendJson: jsonResponse, requestUrl })
  })

  // GET|PATCH|DELETE /api/proposals/:id
  router.register('*', '/api/proposals/:id', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,PATCH,DELETE,OPTIONS' }); return }
    if (method !== 'GET' && method !== 'PATCH' && method !== 'DELETE') {
      jsonResponse(res, 405, METHOD_NOT_ALLOWED); return
    }
    const proposalId = reqCtx.params?.id ?? ''
    await handleProposalByIdRequest(req, res, { method, proposalId, readJsonBody, sendJson: jsonResponse })
  })
}
