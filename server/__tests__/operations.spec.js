// server/__tests__/operations.spec.js
// Unit tests for the operations domain handler.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Validators (pure domain — no mocks needed)
// ─────────────────────────────────────────────────────────────────────────────

// We import the compiled JS path that the server handler uses.
// In tests the TS source is loaded by vitest directly.
import {
  isTicketPriority,
  isTicketStatus,
  isMaintenanceType,
  isMaintenanceStatus,
  isCleaningStatus,
  isInsuranceStatus,
  isOperationEventStatus,
  isOperationEventSourceType,
} from '../../src/domain/operations/operation-status.js'

describe('validators', () => {
  it('isTicketPriority: valid values', () => {
    expect(isTicketPriority('baixa')).toBe(true)
    expect(isTicketPriority('media')).toBe(true)
    expect(isTicketPriority('alta')).toBe(true)
    expect(isTicketPriority('urgente')).toBe(true)
  })

  it('isTicketPriority: invalid values', () => {
    expect(isTicketPriority('critical')).toBe(false)
    expect(isTicketPriority(null)).toBe(false)
  })

  it('isTicketStatus: valid values', () => {
    expect(isTicketStatus('aberto')).toBe(true)
    expect(isTicketStatus('em_andamento')).toBe(true)
    expect(isTicketStatus('aguardando_cliente')).toBe(true)
    expect(isTicketStatus('resolvido')).toBe(true)
    expect(isTicketStatus('cancelado')).toBe(true)
  })

  it('isTicketStatus: invalid values', () => {
    expect(isTicketStatus('open')).toBe(false)
  })

  it('isMaintenanceType: valid values', () => {
    expect(isMaintenanceType('preventiva')).toBe(true)
    expect(isMaintenanceType('corretiva')).toBe(true)
  })

  it('isMaintenanceStatus: valid values', () => {
    expect(isMaintenanceStatus('planejada')).toBe(true)
    expect(isMaintenanceStatus('agendada')).toBe(true)
    expect(isMaintenanceStatus('realizada')).toBe(true)
    expect(isMaintenanceStatus('cancelada')).toBe(true)
  })

  it('isCleaningStatus: valid values', () => {
    expect(isCleaningStatus('planejada')).toBe(true)
    expect(isCleaningStatus('realizada')).toBe(true)
  })

  it('isInsuranceStatus: valid values', () => {
    expect(isInsuranceStatus('ativa')).toBe(true)
    expect(isInsuranceStatus('vencida')).toBe(true)
    expect(isInsuranceStatus('cancelada')).toBe(true)
    expect(isInsuranceStatus('pendente')).toBe(true)
  })

  it('isInsuranceStatus: invalid value', () => {
    expect(isInsuranceStatus('expired')).toBe(false)
  })

  it('isOperationEventStatus: valid values', () => {
    expect(isOperationEventStatus('agendado')).toBe(true)
    expect(isOperationEventStatus('concluido')).toBe(true)
    expect(isOperationEventStatus('cancelado')).toBe(true)
  })

  it('isOperationEventSourceType: valid values', () => {
    expect(isOperationEventSourceType('ticket')).toBe(true)
    expect(isOperationEventSourceType('maintenance')).toBe(true)
    expect(isOperationEventSourceType('cleaning')).toBe(true)
    expect(isOperationEventSourceType('insurance')).toBe(true)
    expect(isOperationEventSourceType('manual')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Handler — RBAC and validation behaviour (no real DB)
// ─────────────────────────────────────────────────────────────────────────────

// Mock the three server-only modules that the handler imports so we can run
// the tests without a live database or Stack Auth instance.

vi.mock('../operations/repository.js', () => ({
  listServiceTickets:   vi.fn(async () => []),
  createServiceTicket:  vi.fn(async (_, data) => ({ id: 'fake-uuid', ...data })),
  updateServiceTicket:  vi.fn(async (_, id, patch) => ({ id, ...patch })),
  listMaintenanceJobs:  vi.fn(async () => []),
  createMaintenanceJob: vi.fn(async (_, data) => ({ id: 'fake-uuid', ...data })),
  updateMaintenanceJob: vi.fn(async (_, id, patch) => ({ id, ...patch })),
  listCleaningJobs:     vi.fn(async () => []),
  createCleaningJob:    vi.fn(async (_, data) => ({ id: 'fake-uuid', ...data })),
  updateCleaningJob:    vi.fn(async (_, id, patch) => ({ id, ...patch })),
  listInsurancePolicies: vi.fn(async () => []),
  createInsurancePolicy: vi.fn(async (_, data) => ({ id: 'fake-uuid', ...data })),
  updateInsurancePolicy: vi.fn(async (_, id, patch) => ({ id, ...patch })),
  listOperationEvents:   vi.fn(async () => []),
  createOperationEvent:  vi.fn(async (_, data) => ({ id: 'fake-uuid', ...data })),
  updateOperationEvent:  vi.fn(async (_, id, patch) => ({ id, ...patch })),
}))

vi.mock('../database/neonClient.js', () => ({
  getDatabaseClient: vi.fn(() => ({
    sql: Object.assign(
      (strings, ...values) => Promise.resolve([]),
      { transaction: (queries) => Promise.all(queries).then((r) => r) },
    ),
  })),
}))

vi.mock('../proposals/permissions.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    resolveActor: vi.fn(),
  }
})

import { resolveActor } from '../proposals/permissions.js'
import {
  handleTicketsList,
  handleTicketsCreate,
  handleTicketsPatch,
  handleMaintenanceList,
  handleMaintenanceCreate,
  handleInsuranceCreate,
  handleEventsList,
  handleEventsCreate,
} from '../operations/handler.js'

/** Build a minimal fake req object. */
function fakeReq() {
  return { headers: {} }
}

/** Capture sendJson calls into { status, body }. */
function captureSendJson() {
  let captured = null
  const sendJson = (status, body) => { captured = { status, body } }
  const getResult = () => captured
  return { sendJson, getResult }
}

const adminActor = {
  userId: 'user-admin',
  isAdmin: true,
  isOffice: false,
  isFinanceiro: false,
  isComercial: false,
  hasAnyRole: true,
}

const comercialActor = {
  userId: 'user-comercial',
  isAdmin: false,
  isOffice: false,
  isFinanceiro: false,
  isComercial: true,
  hasAnyRole: true,
}

describe('handleTicketsList', () => {
  it('returns 200 with data for authenticated actor', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsList(fakeReq(), {}, { method: 'GET', sendJson, requestUrl: '/api/operations/tickets' })
    expect(getResult().status).toBe(200)
    expect(getResult().body).toHaveProperty('data')
  })

  it('returns 401 when actor is null', async () => {
    resolveActor.mockResolvedValue(null)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsList(fakeReq(), {}, { method: 'GET', sendJson, requestUrl: '/api/operations/tickets' })
    expect(getResult().status).toBe(401)
  })

  it('returns 405 for non-GET method', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsList(fakeReq(), {}, { method: 'POST', sendJson, requestUrl: '/api/operations/tickets' })
    expect(getResult().status).toBe(405)
  })

  it('applies client_id filter from query string', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsList(fakeReq(), {}, { method: 'GET', sendJson, requestUrl: '/api/operations/tickets?client_id=42&status=aberto' })
    expect(getResult().status).toBe(200)
  })
})

describe('handleTicketsCreate', () => {
  it('returns 400 when client_id is missing', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsCreate(fakeReq(), {}, { method: 'POST', sendJson, body: { title: 'Test' } })
    expect(getResult().status).toBe(400)
    expect(getResult().body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for invalid priority', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { client_id: 1, title: 'Test', priority: 'critical' },
    })
    expect(getResult().status).toBe(400)
  })

  it('returns 400 for invalid status', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { client_id: 1, title: 'Test', status: 'open' },
    })
    expect(getResult().status).toBe(400)
  })

  it('returns 400 when title is missing', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { client_id: 1 },
    })
    expect(getResult().status).toBe(400)
  })

  it('returns 403 for comercial actor (write-only for admin/office)', async () => {
    resolveActor.mockResolvedValue(comercialActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { client_id: 1, title: 'Test' },
    })
    expect(getResult().status).toBe(403)
  })

  it('returns 201 for valid input with admin actor', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { client_id: 1, title: 'Test ticket', priority: 'alta', status: 'aberto' },
    })
    expect(getResult().status).toBe(201)
  })
})

describe('handleTicketsPatch', () => {
  it('returns 400 for invalid status', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsPatch(fakeReq(), {}, {
      method: 'PATCH',
      sendJson,
      body: { status: 'closed' },
      id: 'some-uuid',
    })
    expect(getResult().status).toBe(400)
  })

  it('returns 403 for comercial actor', async () => {
    resolveActor.mockResolvedValue(comercialActor)
    const { sendJson, getResult } = captureSendJson()
    await handleTicketsPatch(fakeReq(), {}, {
      method: 'PATCH',
      sendJson,
      body: { status: 'resolvido' },
      id: 'some-uuid',
    })
    expect(getResult().status).toBe(403)
  })
})

describe('handleMaintenanceList', () => {
  it('returns 200 for authenticated actor', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleMaintenanceList(fakeReq(), {}, { method: 'GET', sendJson, requestUrl: '/api/operations/maintenance' })
    expect(getResult().status).toBe(200)
  })
})

describe('handleMaintenanceCreate', () => {
  it('returns 400 when client_id is missing', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleMaintenanceCreate(fakeReq(), {}, { method: 'POST', sendJson, body: {} })
    expect(getResult().status).toBe(400)
  })

  it('returns 400 for invalid maintenance_type', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleMaintenanceCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { client_id: 1, maintenance_type: 'routine' },
    })
    expect(getResult().status).toBe(400)
  })
})

describe('handleInsuranceCreate', () => {
  it('returns 400 for invalid status', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleInsuranceCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { client_id: 1, status: 'active' },
    })
    expect(getResult().status).toBe(400)
  })
})

describe('handleEventsList', () => {
  it('returns 200 with data', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleEventsList(fakeReq(), {}, { method: 'GET', sendJson, requestUrl: '/api/operations/events' })
    expect(getResult().status).toBe(200)
    expect(getResult().body).toHaveProperty('data')
  })

  it('returns 401 when actor is null', async () => {
    resolveActor.mockResolvedValue(null)
    const { sendJson, getResult } = captureSendJson()
    await handleEventsList(fakeReq(), {}, { method: 'GET', sendJson, requestUrl: '/api/operations/events' })
    expect(getResult().status).toBe(401)
  })
})

describe('handleEventsCreate', () => {
  it('returns 400 when title is missing', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleEventsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { starts_at: '2025-01-01T10:00:00Z' },
    })
    expect(getResult().status).toBe(400)
  })

  it('returns 400 when starts_at is missing', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleEventsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { title: 'Visit' },
    })
    expect(getResult().status).toBe(400)
  })

  it('returns 400 for invalid source_type', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleEventsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { title: 'Visit', starts_at: '2025-01-01T10:00:00Z', source_type: 'other' },
    })
    expect(getResult().status).toBe(400)
  })

  it('returns 403 for comercial actor', async () => {
    resolveActor.mockResolvedValue(comercialActor)
    const { sendJson, getResult } = captureSendJson()
    await handleEventsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { title: 'Visit', starts_at: '2025-01-01T10:00:00Z' },
    })
    expect(getResult().status).toBe(403)
  })

  it('returns 201 for valid input', async () => {
    resolveActor.mockResolvedValue(adminActor)
    const { sendJson, getResult } = captureSendJson()
    await handleEventsCreate(fakeReq(), {}, {
      method: 'POST',
      sendJson,
      body: { title: 'Site visit', starts_at: '2025-03-15T09:00:00Z', source_type: 'manual', status: 'agendado' },
    })
    expect(getResult().status).toBe(201)
  })
})
