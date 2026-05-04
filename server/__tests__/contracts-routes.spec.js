// server/__tests__/contracts-routes.spec.js
// Tests for server/routes/contracts.js (registerContractsRoutes).
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerContractsRoutes } from '../routes/contracts.js'

vi.mock('../contracts.js', () => ({
  CONTRACT_RENDER_PATH: '/api/contracts/render',
  CONTRACT_TEMPLATES_PATH: '/api/contracts/templates',
  handleContractRenderRequest: vi.fn().mockResolvedValue(undefined),
  handleContractTemplatesRequest: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../leasingContracts.js', () => ({
  LEASING_CONTRACTS_PATH: '/api/contracts/leasing',
  LEASING_CONTRACTS_AVAILABILITY_PATH: '/api/contracts/leasing/availability',
  LEASING_CONTRACTS_SMOKE_PATH: '/api/contracts/leasing/smoke',
  handleLeasingContractsRequest: vi.fn().mockResolvedValue(undefined),
  handleLeasingContractsAvailabilityRequest: vi.fn().mockResolvedValue(undefined),
  handleLeasingContractsSmokeRequest: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../auth/stackPermissions.js', () => ({
  requireStackPermission: vi.fn().mockResolvedValue(undefined),
}))

function makeReq(url = '/', method = 'GET') {
  return { url, method }
}

function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    get headersSent() { return res.body !== null },
    setHeader(key, val) { res.headers[key] = val },
    end(body) { res.body = body },
  }
  return res
}

describe('registerContractsRoutes — route registration', () => {
  it('registers all 5 contract paths', () => {
    const router = createRouter()
    registerContractsRoutes(router, { stackAuthEnabled: false })

    expect(router.match('GET', '/api/contracts/leasing/availability')).toBeTypeOf('function')
    expect(router.match('GET', '/api/contracts/leasing/smoke')).toBeTypeOf('function')
    expect(router.match('GET', '/api/contracts/leasing')).toBeTypeOf('function')
    expect(router.match('GET', '/api/contracts/render')).toBeTypeOf('function')
    expect(router.match('GET', '/api/contracts/templates')).toBeTypeOf('function')
    expect(router.size).toBe(5)
  })
})

describe('/api/contracts/leasing/availability', () => {
  it('delegates to handleLeasingContractsAvailabilityRequest', async () => {
    const { handleLeasingContractsAvailabilityRequest } = await import('../leasingContracts.js')
    const router = createRouter()
    registerContractsRoutes(router, { stackAuthEnabled: false })

    const req = makeReq('/api/contracts/leasing/availability')
    const res = makeRes()
    await router.match('GET', '/api/contracts/leasing/availability')(req, res, {})

    expect(handleLeasingContractsAvailabilityRequest).toHaveBeenCalledWith(req, res)
  })

  it('does not call requireStackPermission regardless of stackAuthEnabled', async () => {
    const { requireStackPermission } = await import('../auth/stackPermissions.js')
    requireStackPermission.mockClear()
    const router = createRouter()
    registerContractsRoutes(router, { stackAuthEnabled: true })

    await router.match('GET', '/api/contracts/leasing/availability')(makeReq(), makeRes(), {})

    expect(requireStackPermission).not.toHaveBeenCalled()
  })
})

describe('/api/contracts/leasing/smoke', () => {
  it('delegates to handleLeasingContractsSmokeRequest', async () => {
    const { handleLeasingContractsSmokeRequest } = await import('../leasingContracts.js')
    const router = createRouter()
    registerContractsRoutes(router, { stackAuthEnabled: false })

    const req = makeReq('/api/contracts/leasing/smoke')
    const res = makeRes()
    await router.match('GET', '/api/contracts/leasing/smoke')(req, res, {})

    expect(handleLeasingContractsSmokeRequest).toHaveBeenCalledWith(req, res)
  })
})

describe('/api/contracts/leasing — auth guarded', () => {
  beforeEach(async () => {
    const { requireStackPermission } = await import('../auth/stackPermissions.js')
    requireStackPermission.mockClear()
  })

  it('calls requireStackPermission when stackAuthEnabled=true', async () => {
    const { requireStackPermission } = await import('../auth/stackPermissions.js')
    const { handleLeasingContractsRequest } = await import('../leasingContracts.js')
    const router = createRouter()
    registerContractsRoutes(router, { stackAuthEnabled: true })

    const req = makeReq('/api/contracts/leasing', 'POST')
    const res = makeRes()
    await router.match('POST', '/api/contracts/leasing')(req, res, {})

    expect(requireStackPermission).toHaveBeenCalledWith(req, 'page:financial_analysis')
    expect(handleLeasingContractsRequest).toHaveBeenCalledWith(req, res)
  })

  it('skips requireStackPermission when stackAuthEnabled=false', async () => {
    const { requireStackPermission } = await import('../auth/stackPermissions.js')
    const router = createRouter()
    registerContractsRoutes(router, { stackAuthEnabled: false })

    await router.match('POST', '/api/contracts/leasing')(makeReq(), makeRes(), {})

    expect(requireStackPermission).not.toHaveBeenCalled()
  })
})

describe('/api/contracts/render — auth guarded', () => {
  it('calls requireStackPermission when stackAuthEnabled=true', async () => {
    const { requireStackPermission } = await import('../auth/stackPermissions.js')
    requireStackPermission.mockClear()
    const { handleContractRenderRequest } = await import('../contracts.js')
    const router = createRouter()
    registerContractsRoutes(router, { stackAuthEnabled: true })

    const req = makeReq('/api/contracts/render', 'POST')
    const res = makeRes()
    await router.match('POST', '/api/contracts/render')(req, res, {})

    expect(requireStackPermission).toHaveBeenCalledWith(req, 'page:financial_analysis')
    expect(handleContractRenderRequest).toHaveBeenCalledWith(req, res)
  })
})

describe('/api/contracts/templates — auth guarded', () => {
  it('calls requireStackPermission when stackAuthEnabled=true', async () => {
    const { requireStackPermission } = await import('../auth/stackPermissions.js')
    requireStackPermission.mockClear()
    const { handleContractTemplatesRequest } = await import('../contracts.js')
    const router = createRouter()
    registerContractsRoutes(router, { stackAuthEnabled: true })

    const req = makeReq('/api/contracts/templates', 'GET')
    const res = makeRes()
    await router.match('GET', '/api/contracts/templates')(req, res, {})

    expect(requireStackPermission).toHaveBeenCalledWith(req, 'page:financial_analysis')
    expect(handleContractTemplatesRequest).toHaveBeenCalledWith(req, res)
  })
})
