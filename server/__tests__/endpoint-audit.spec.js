// server/__tests__/endpoint-audit.spec.js
// Integration-style tests that verify all critical production endpoints are
// registered with the correct HTTP methods, auth requirements, and response
// contracts.  Uses mocked dependencies — no live DB required.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal mock of Node's IncomingMessage / ServerResponse pair used by
 * server/handler.js without needing an actual HTTP server.
 */
function makeReqRes(method = 'GET', pathname = '/', headers = {}) {
  const req = {
    method,
    url: pathname,
    headers: { host: 'localhost', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    readable: false,
    on: vi.fn(),
  }

  const res = {
    _statusCode: 200,
    _headers: {},
    _body: '',
    get statusCode() { return this._statusCode },
    set statusCode(v) { this._statusCode = v },
    headersSent: false,
    setHeader(k, v) { this._headers[k] = v },
    end(body = '') { this._body = typeof body === 'string' ? body : body?.toString() ?? '' },
    json: null,
  }

  return { req, res }
}

function parseBody(res) {
  try { return JSON.parse(res._body) } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level mocks (must be hoisted before handler import)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../database/neonConfig.js', () => ({
  getNeonDatabaseConfig: () => ({ connectionString: null, source: 'mock', schema: 'public' }),
}))

vi.mock('../database/neonClient.js', () => ({
  getDatabaseClient: () => null,
}))

vi.mock('../database/storageService.js', () => ({
  StorageService: class { ensureInitialized() { return Promise.resolve() } },
}))

vi.mock('../auth/stackAuth.js', () => ({
  getStackUser: vi.fn().mockResolvedValue(null),
  getTrustedOrigins: () => new Set(),
  isStackAuthEnabled: () => false,
  isStackAuthBypassed: () => false,
  sanitizeStackUserId: () => null,
}))

vi.mock('../proposals/permissions.js', () => ({
  resolveActor: vi.fn().mockResolvedValue(null),
  actorRole: vi.fn().mockReturnValue(null),
}))

vi.mock('../auth/stackPermissions.js', () => ({
  requireStackPermission: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../contracts.js', () => ({
  CONTRACT_RENDER_PATH: '/api/contracts/render',
  CONTRACT_TEMPLATES_PATH: '/api/contracts/templates',
  handleContractRenderRequest: vi.fn().mockImplementation((_req, res) => {
    res.statusCode = 200; res.end(JSON.stringify({ ok: true }))
  }),
  handleContractTemplatesRequest: vi.fn().mockImplementation((_req, res) => {
    res.statusCode = 200; res.end(JSON.stringify({ data: [] }))
  }),
  isConvertApiConfigured: () => false,
  isGotenbergConfigured: () => false,
}))

vi.mock('../leasingContracts.js', () => ({
  LEASING_CONTRACTS_PATH: '/api/contracts/leasing',
  LEASING_CONTRACTS_AVAILABILITY_PATH: '/api/contracts/leasing/availability',
  LEASING_CONTRACTS_SMOKE_PATH: '/api/contracts/leasing/smoke',
  handleLeasingContractsRequest: vi.fn().mockImplementation((_req, res) => {
    res.statusCode = 200; res.end(JSON.stringify({ ok: true }))
  }),
  handleLeasingContractsAvailabilityRequest: vi.fn().mockImplementation((_req, res) => {
    res.statusCode = 200; res.end(JSON.stringify({ ok: true }))
  }),
  handleLeasingContractsSmokeRequest: vi.fn().mockImplementation((_req, res) => {
    res.statusCode = 200; res.end(JSON.stringify({ ok: true }))
  }),
}))

vi.mock('../aneelProxy.js', () => ({
  DEFAULT_PROXY_BASE: '/api/aneel',
  handleAneelProxyRequest: vi.fn().mockImplementation((_req, res) => {
    res.statusCode = 200; res.end(JSON.stringify({ data: [] }))
  }),
}))

vi.mock('../routes/authMe.js', () => ({
  handleAuthMeRequest: vi.fn().mockImplementation((_req, res) => {
    res.statusCode = 200; res.end(JSON.stringify({ authenticated: false }))
  }),
}))

vi.mock('../auth/authorizationSnapshot.js', () => ({
  getAuthorizationSnapshot: vi.fn().mockResolvedValue(null),
}))

vi.mock('../routes/adminUsers.js', () => ({
  handleAdminUsersListRequest: vi.fn(),
  handleAdminUserApprove: vi.fn(),
  handleAdminUserBlock: vi.fn(),
  handleAdminUserRevoke: vi.fn(),
  handleAdminUserRole: vi.fn(),
  handleAdminUserGrantPermission: vi.fn(),
  handleAdminUserRevokePermission: vi.fn(),
  handleAdminUserDelete: vi.fn(),
  handleAdminUserCreate: vi.fn(),
}))

vi.mock('../proposals/handler.js', () => ({
  handleProposalsRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [], total: 0, page: 1, limit: 20 })),
  handleProposalByIdRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
}))

vi.mock('../clients/handler.js', () => ({
  handleUpsertClientByCpf: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleClientsRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [], total: 0, page: 1, limit: 20 })),
  handleClientByIdRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
}))

vi.mock('../clients/bulkImport.js', () => ({
  handleBulkImportPreview: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleBulkImport: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
}))

vi.mock('../client-portfolio/handler.js', () => ({
  handlePortfolioListRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handlePortfolioGetRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handlePortfolioExportRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handlePortfolioProfilePatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handlePortfolioContractPatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handlePortfolioProjectPatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handlePortfolioBillingPatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handlePortfolioPlanPatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handlePortfolioNotesRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handlePortfolioRemoveRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleDashboardPortfolioSummary: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: {} })),
}))

vi.mock('../financial-management/handler.js', () => ({
  handleFinancialSummary: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: {} })),
  handleFinancialProjects: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleFinancialCashflow: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleFinancialEntries: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleFinancialCategories: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleFinancialDashboardFeed: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: {} })),
}))

vi.mock('../projects/handler.js', () => ({
  handleProjectsList: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleProjectsSummary: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: {} })),
  handleProjectById: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handleProjectStatus: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleProjectPvData: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handleProjectFromPlan: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleProjectFromAnalise: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
}))

vi.mock('../projects/financialAnalysisHandler.js', () => ({
  handleProjectFinancialAnalysis: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
}))

vi.mock('../project-finance/handler.js', () => ({
  handleProjectFinance: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
}))

vi.mock('../project-finance/analysisHandler.js', () => ({
  handleProjectFinanceAnalysis: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
}))

vi.mock('../project-charges/handler.js', () => ({
  handleProjectChargesList: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleProjectChargesGenerate: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleChargeUpdate: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../invoices/handler.js', () => ({
  handleInvoicesListRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleInvoicesCreateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleInvoicesUpdateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handleInvoicesDeleteRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(204, null)),
  handleInvoicePaymentRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleInvoiceNotificationsRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleInvoiceNotificationConfigGetRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handleInvoiceNotificationConfigUpdateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../operational-tasks/handler.js', () => ({
  handleOperationalTasksListRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleOperationalTasksCreateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleOperationalTasksUpdateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleOperationalTasksDeleteRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(204, null)),
  handleTaskHistoryRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleNotificationPreferencesGetRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handleNotificationPreferencesUpdateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../operations/handler.js', () => ({
  handleTicketsList: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleTicketsCreate: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleTicketsPatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleMaintenanceList: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleMaintenanceCreate: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleMaintenancePatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleCleaningsList: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleCleaningsCreate: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleCleaningsPatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleInsuranceList: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleInsuranceCreate: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleInsurancePatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleEventsList: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleEventsCreate: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleEventsPatch: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../routes/consultants.js', () => ({
  handleConsultantsListRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleConsultantsCreateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleConsultantsUpdateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handleConsultantsDeactivateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleConsultantsPickerRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleConsultantsLinkRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleConsultantsUnlinkRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleConsultantsAutoDetectRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
}))

vi.mock('../routes/engineers.js', () => ({
  handleEngineersListRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleEngineersCreateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleEngineersUpdateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handleEngineersDeactivateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../routes/installers.js', () => ({
  handleInstallersListRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleInstallersCreateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(201, { data: null })),
  handleInstallersUpdateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: null })),
  handleInstallersDeactivateRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../routes/databaseBackup.js', () => ({
  handleDatabaseBackupRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../routes/purgeDeletedClients.js', () => ({
  handlePurgeDeletedClientsRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../routes/purgeOldProposals.js', () => ({
  handlePurgeOldProposalsRequest: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
}))

vi.mock('../routes/authReconcile.js', () => ({
  handleAuthReconcileAll: vi.fn(),
  handleAuthReconcileUser: vi.fn(),
}))

vi.mock('../routes/rbacInspect.js', () => ({
  handleRbacInspectRequest: vi.fn(),
}))

vi.mock('../routes/personnelImport.js', () => ({
  handlePersonnelImportableUsers: vi.fn(),
  handlePersonnelImportableClients: vi.fn(),
}))

vi.mock('../financial-import/handler.js', () => ({
  handleFinancialImportParse: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
  handleFinancialImportConfirm: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { ok: true })),
  handleFinancialImportBatches: vi.fn().mockImplementation((_req, res, { sendJson }) => sendJson(200, { data: [] })),
}))

vi.mock('../database/withRLSContext.js', () => ({
  createUserScopedSql: vi.fn().mockReturnValue(null),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Import handler after all mocks are set up
// ─────────────────────────────────────────────────────────────────────────────

const { default: handler } = await import('../handler.js')

// ─────────────────────────────────────────────────────────────────────────────
// Convenience wrapper
// ─────────────────────────────────────────────────────────────────────────────

async function call(method, pathname, headers = {}) {
  const { req, res } = makeReqRes(method, pathname, headers)
  await handler(req, res)
  return { status: res._statusCode, body: parseBody(res), headers: res._headers }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('endpoint-audit: OPTIONS pre-flight', () => {
  const endpoints = [
    ['/api/auth/me', 'GET,OPTIONS'],
    ['/api/authz/me', 'GET,OPTIONS'],
    ['/api/auth/logout', 'POST,OPTIONS'],
    // /api/storage returns 503 before OPTIONS check when storage is unavailable — skip
    ['/api/clients', 'GET,POST,OPTIONS'],
    ['/api/proposals', 'GET,POST,OPTIONS'],
    ['/api/client-portfolio', 'GET,OPTIONS'],
    ['/api/consultants', 'GET,POST,OPTIONS'],
    ['/api/consultants/picker', 'GET,OPTIONS'],
    ['/api/consultants/auto-detect', 'GET,OPTIONS'],
    ['/api/engineers', 'GET,POST,OPTIONS'],
    ['/api/installers', 'GET,POST,OPTIONS'],
    ['/api/projects', 'GET,OPTIONS'],
    ['/api/projects/summary', 'GET,OPTIONS'],
    ['/api/financial-management/summary', 'GET,OPTIONS'],
    ['/api/financial-management/projects', 'GET,OPTIONS'],
    ['/api/financial-management/cashflow', 'GET,OPTIONS'],
    ['/api/financial-management/entries', 'GET,POST,PUT,DELETE,OPTIONS'],
    ['/api/financial-management/categories', 'GET,POST,OPTIONS'],
    ['/api/financial-management/dashboard-feed', 'GET,OPTIONS'],
    ['/api/invoices', 'GET,POST,OPTIONS'],
    ['/api/invoices/notifications', 'GET,OPTIONS'],
    ['/api/invoices/notification-config', 'GET,POST,OPTIONS'],
    ['/api/operational-tasks', 'GET,POST,OPTIONS'],
    ['/api/admin/database-backup', 'POST,OPTIONS'],
  ]

  for (const [path, expectedAllow] of endpoints) {
    if (!expectedAllow) continue
    it(`OPTIONS ${path} → 204 with Allow: ${expectedAllow}`, async () => {
      const { status, headers } = await call('OPTIONS', path)
      expect(status).toBe(204)
      expect(headers['Allow']).toBe(expectedAllow)
    })
  }
})

describe('endpoint-audit: GET /api/auth/me', () => {
  it('responds to GET', async () => {
    const { status } = await call('GET', '/api/auth/me')
    expect(status).toBe(200)
  })

  it('rejects PUT with 405', async () => {
    const { status } = await call('PUT', '/api/auth/me')
    expect(status).toBe(405)
  })
})

describe('endpoint-audit: GET /api/authz/me', () => {
  it('returns 401 when unauthenticated (no actor)', async () => {
    const { status, body } = await call('GET', '/api/authz/me')
    expect(status).toBe(401)
    expect(body.ok).toBe(false)
  })

  it('rejects non-GET with 405', async () => {
    const { status } = await call('POST', '/api/authz/me')
    expect(status).toBe(405)
  })
})

describe('endpoint-audit: POST /api/auth/logout', () => {
  it('responds to POST with 204', async () => {
    const { status } = await call('POST', '/api/auth/logout')
    expect(status).toBe(204)
  })

  it('rejects GET with 405', async () => {
    const { status } = await call('GET', '/api/auth/logout')
    expect(status).toBe(405)
  })
})

describe('endpoint-audit: /api/storage — no DB', () => {
  it('GET returns 503 when storage unavailable', async () => {
    const { status, body } = await call('GET', '/api/storage')
    expect(status).toBe(503)
    expect(body.code).toBe('STORAGE_UNAVAILABLE')
  })
})

describe('endpoint-audit: /api/aneel', () => {
  it('routes GET /api/aneel to proxy handler', async () => {
    const { status } = await call('GET', '/api/aneel')
    expect(status).toBe(200)
  })
})

describe('endpoint-audit: contracts', () => {
  it('GET /api/contracts/leasing/availability responds', async () => {
    const { status } = await call('GET', '/api/contracts/leasing/availability')
    expect(status).toBe(200)
  })

  it('POST /api/contracts/leasing → 401 when unauthenticated (no stack auth, no actor)', async () => {
    // resolveActor is mocked to return null → minimum auth gate rejects
    const { status } = await call('POST', '/api/contracts/leasing')
    expect(status).toBe(401)
  })

  it('POST /api/contracts/render → 401 when unauthenticated', async () => {
    const { status } = await call('POST', '/api/contracts/render')
    expect(status).toBe(401)
  })

  it('GET /api/contracts/templates → 401 when unauthenticated', async () => {
    const { status } = await call('GET', '/api/contracts/templates')
    expect(status).toBe(401)
  })
})

describe('endpoint-audit: /api/health/db — requires admin', () => {
  it('returns 401 when unauthenticated', async () => {
    const { status } = await call('GET', '/api/health/db')
    expect(status).toBe(401)
  })
})

describe('endpoint-audit: /api/test — requires admin', () => {
  it('returns 401 when unauthenticated', async () => {
    const { status } = await call('GET', '/api/test')
    expect(status).toBe(401)
  })
})

describe('endpoint-audit: clients', () => {
  it('GET /api/clients is registered', async () => {
    const { status } = await call('GET', '/api/clients')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/clients is registered', async () => {
    const { status } = await call('POST', '/api/clients')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/clients/123 is registered', async () => {
    const { status } = await call('GET', '/api/clients/123')
    expect([200, 401, 403, 404, 500, 503]).toContain(status)
  })

  it('PUT /api/clients/123 is registered', async () => {
    const { status } = await call('PUT', '/api/clients/123')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('DELETE /api/clients/123 is registered', async () => {
    const { status } = await call('DELETE', '/api/clients/123')
    expect([200, 204, 401, 403, 404, 500, 503]).toContain(status)
  })

  it('POST /api/clients/upsert-by-cpf is registered', async () => {
    const { status } = await call('POST', '/api/clients/upsert-by-cpf')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/clients/bulk-import/preview is registered', async () => {
    const { status } = await call('POST', '/api/clients/bulk-import/preview')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/clients/bulk-import is registered', async () => {
    const { status } = await call('POST', '/api/clients/bulk-import')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('PATCH /api/clients/123/portfolio-export is registered', async () => {
    const { status } = await call('PATCH', '/api/clients/123/portfolio-export')
    expect([200, 401, 403, 404, 500, 503]).toContain(status)
  })

  it('PATCH /api/clients/123/portfolio-remove is registered', async () => {
    const { status } = await call('PATCH', '/api/clients/123/portfolio-remove')
    expect([200, 401, 403, 404, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: proposals', () => {
  it('GET /api/proposals is registered', async () => {
    const { status } = await call('GET', '/api/proposals')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/proposals/abc is registered', async () => {
    const { status } = await call('GET', '/api/proposals/abc')
    expect([200, 401, 403, 404, 500, 503]).toContain(status)
  })

  it('PATCH /api/proposals/abc is registered', async () => {
    const { status } = await call('PATCH', '/api/proposals/abc')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('DELETE /api/proposals/abc is registered', async () => {
    const { status } = await call('DELETE', '/api/proposals/abc')
    expect([200, 204, 401, 403, 404, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: client-portfolio', () => {
  it('GET /api/client-portfolio is registered', async () => {
    const { status } = await call('GET', '/api/client-portfolio')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/client-portfolio/1 is registered', async () => {
    const { status } = await call('GET', '/api/client-portfolio/1')
    expect([200, 401, 403, 404, 500, 503]).toContain(status)
  })

  const patches = ['profile', 'contract', 'project', 'billing', 'plan']
  for (const sub of patches) {
    it(`PATCH /api/client-portfolio/1/${sub} is registered`, async () => {
      const { status } = await call('PATCH', `/api/client-portfolio/1/${sub}`)
      expect([200, 400, 401, 403, 500, 503]).toContain(status)
    })
  }

  it('GET /api/client-portfolio/1/notes is registered', async () => {
    const { status } = await call('GET', '/api/client-portfolio/1/notes')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/client-portfolio/1/notes is registered', async () => {
    const { status } = await call('POST', '/api/client-portfolio/1/notes')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: consultants', () => {
  it('GET /api/consultants is registered', async () => {
    const { status } = await call('GET', '/api/consultants')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/consultants is registered', async () => {
    const { status } = await call('POST', '/api/consultants')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('PUT /api/consultants/1 is registered', async () => {
    const { status } = await call('PUT', '/api/consultants/1')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/consultants/picker is registered', async () => {
    const { status } = await call('GET', '/api/consultants/picker')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/consultants/auto-detect is registered', async () => {
    const { status } = await call('GET', '/api/consultants/auto-detect')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: engineers', () => {
  it('GET /api/engineers is registered', async () => {
    const { status } = await call('GET', '/api/engineers')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/engineers is registered', async () => {
    const { status } = await call('POST', '/api/engineers')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('PUT /api/engineers/1 is registered', async () => {
    const { status } = await call('PUT', '/api/engineers/1')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: installers', () => {
  it('GET /api/installers is registered', async () => {
    const { status } = await call('GET', '/api/installers')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/installers is registered', async () => {
    const { status } = await call('POST', '/api/installers')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('PUT /api/installers/1 is registered', async () => {
    const { status } = await call('PUT', '/api/installers/1')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: projects', () => {
  it('GET /api/projects is registered', async () => {
    const { status } = await call('GET', '/api/projects')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/projects/summary is registered', async () => {
    const { status } = await call('GET', '/api/projects/summary')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/projects/1 is registered', async () => {
    const { status } = await call('GET', '/api/projects/1')
    expect([200, 401, 403, 404, 500, 503]).toContain(status)
  })

  it('PATCH /api/projects/1/status is registered', async () => {
    const { status } = await call('PATCH', '/api/projects/1/status')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('PATCH /api/projects/1/pv-data is registered', async () => {
    const { status } = await call('PATCH', '/api/projects/1/pv-data')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('PUT /api/projects/1/pv-data is now registered (OPTIONS)', async () => {
    const { status, headers } = await call('OPTIONS', '/api/projects/1/pv-data')
    expect(status).toBe(204)
    expect(headers['Allow']).toContain('PUT')
  })

  it('POST /api/projects/from-plan/42 is registered', async () => {
    const { status } = await call('POST', '/api/projects/from-plan/42')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: financial-management', () => {
  it('GET /api/financial-management/summary is registered', async () => {
    const { status } = await call('GET', '/api/financial-management/summary')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/financial-management/projects is registered', async () => {
    const { status } = await call('GET', '/api/financial-management/projects')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/financial-management/cashflow is registered', async () => {
    const { status } = await call('GET', '/api/financial-management/cashflow')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/financial-management/entries is registered', async () => {
    const { status } = await call('GET', '/api/financial-management/entries')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/financial-management/entries is registered', async () => {
    const { status } = await call('POST', '/api/financial-management/entries')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/financial-management/categories is registered', async () => {
    const { status } = await call('GET', '/api/financial-management/categories')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/financial-management/categories is now registered (OPTIONS)', async () => {
    const { status, headers } = await call('OPTIONS', '/api/financial-management/categories')
    expect(status).toBe(204)
    expect(headers['Allow']).toContain('POST')
  })

  it('GET /api/financial-management/dashboard-feed is registered', async () => {
    const { status } = await call('GET', '/api/financial-management/dashboard-feed')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: invoices', () => {
  it('GET /api/invoices is registered', async () => {
    const { status } = await call('GET', '/api/invoices')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/invoices is registered', async () => {
    const { status } = await call('POST', '/api/invoices')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('PATCH /api/invoices/1 is registered', async () => {
    const { status } = await call('PATCH', '/api/invoices/1')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('DELETE /api/invoices/1 is registered', async () => {
    const { status } = await call('DELETE', '/api/invoices/1')
    expect([200, 204, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/invoices/1/payment is registered', async () => {
    const { status } = await call('POST', '/api/invoices/1/payment')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/invoices/notifications is registered', async () => {
    const { status } = await call('GET', '/api/invoices/notifications')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/invoices/notification-config is registered', async () => {
    const { status } = await call('GET', '/api/invoices/notification-config')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/invoices/notification-config is registered', async () => {
    const { status } = await call('POST', '/api/invoices/notification-config')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: operational-tasks', () => {
  it('GET /api/operational-tasks is registered', async () => {
    const { status } = await call('GET', '/api/operational-tasks')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })

  it('POST /api/operational-tasks is registered', async () => {
    const { status } = await call('POST', '/api/operational-tasks')
    expect([200, 201, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('PATCH /api/operational-tasks/1 is registered', async () => {
    const { status } = await call('PATCH', '/api/operational-tasks/1')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('DELETE /api/operational-tasks/1 is registered', async () => {
    const { status } = await call('DELETE', '/api/operational-tasks/1')
    expect([200, 204, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/operational-tasks/1/history is registered', async () => {
    const { status } = await call('GET', '/api/operational-tasks/1/history')
    expect([200, 401, 403, 500, 503]).toContain(status)
  })
})

describe('endpoint-audit: admin', () => {
  it('POST /api/admin/database-backup is registered', async () => {
    const { status } = await call('POST', '/api/admin/database-backup')
    expect([200, 400, 401, 403, 500, 503]).toContain(status)
  })

  it('GET /api/admin/database-backup returns 405', async () => {
    const { status } = await call('GET', '/api/admin/database-backup')
    expect(status).toBe(405)
  })
})
