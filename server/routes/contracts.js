// server/routes/contracts.js
// Contract generation routes: leasing family, render, and templates.
// Extracted from the handler.js inline if-chain (PR 22).
//
// Routes registered (in specificity order — more-specific paths first):
//   ANY /api/contracts/leasing/availability  — no auth
//   ANY /api/contracts/leasing/smoke         — no auth
//   ANY /api/contracts/leasing               — requires page:financial_analysis (when auth enabled)
//   ANY /api/contracts/render                — requires page:financial_analysis (when auth enabled)
//   ANY /api/contracts/templates             — requires page:financial_analysis (when auth enabled)

import {
  CONTRACT_RENDER_PATH,
  CONTRACT_TEMPLATES_PATH,
  handleContractRenderRequest,
  handleContractTemplatesRequest,
} from '../contracts.js'
import {
  LEASING_CONTRACTS_PATH,
  LEASING_CONTRACTS_AVAILABILITY_PATH,
  LEASING_CONTRACTS_SMOKE_PATH,
  handleLeasingContractsRequest,
  handleLeasingContractsAvailabilityRequest,
  handleLeasingContractsSmokeRequest,
} from '../leasingContracts.js'
import { requireStackPermission } from '../auth/stackPermissions.js'

/**
 * Registers all contract-related routes on the given router.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{ stackAuthEnabled: boolean }} moduleCtx
 */
export function registerContractsRoutes(router, { stackAuthEnabled }) {
  // ── Leasing availability probe — no auth ────────────────────────────────
  router.register('*', LEASING_CONTRACTS_AVAILABILITY_PATH, async (req, res) => {
    await handleLeasingContractsAvailabilityRequest(req, res)
  })

  // ── Leasing smoke test — no auth ────────────────────────────────────────
  router.register('*', LEASING_CONTRACTS_SMOKE_PATH, async (req, res) => {
    await handleLeasingContractsSmokeRequest(req, res)
  })

  // ── Leasing contract generation — requires auth ──────────────────────────
  router.register('*', LEASING_CONTRACTS_PATH, async (req, res) => {
    if (stackAuthEnabled) await requireStackPermission(req, 'page:financial_analysis')
    await handleLeasingContractsRequest(req, res)
  })

  // ── Contract PDF render — requires auth ──────────────────────────────────
  router.register('*', CONTRACT_RENDER_PATH, async (req, res) => {
    if (stackAuthEnabled) await requireStackPermission(req, 'page:financial_analysis')
    await handleContractRenderRequest(req, res)
  })

  // ── Contract templates list — requires auth ──────────────────────────────
  router.register('*', CONTRACT_TEMPLATES_PATH, async (req, res) => {
    if (stackAuthEnabled) await requireStackPermission(req, 'page:financial_analysis')
    await handleContractTemplatesRequest(req, res)
  })
}
