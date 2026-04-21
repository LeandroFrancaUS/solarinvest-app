// server/__tests__/projects-service.spec.js
// Service-level tests for createOrReuseProjectFromPlan. The sql function is
// mocked to cover idempotency, race-collision handling, and contract-derived
// creation — without requiring a live database.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub repository before importing the service so the service wires up
// against our mocks (vitest hoists vi.mock calls above imports).
const mockFindProjectByPlanId = vi.fn()
const mockInsertProject = vi.fn()
const mockSeedPvDataFromClient = vi.fn()
const mockGetPlanSnapshotFromContract = vi.fn()

vi.mock('../projects/repository.js', () => ({
  findProjectByPlanId: (...args) => mockFindProjectByPlanId(...args),
  insertProject: (...args) => mockInsertProject(...args),
  seedPvDataFromClient: (...args) => mockSeedPvDataFromClient(...args),
  getPlanSnapshotFromContract: (...args) => mockGetPlanSnapshotFromContract(...args),
  findProjectById: vi.fn(),
  findPvDataByProjectId: vi.fn(),
  updateProject: vi.fn(),
  updateProjectStatus: vi.fn(),
  upsertPvData: vi.fn(),
  listProjects: vi.fn(),
  getProjectSummary: vi.fn(),
  listEffectivatedContractsWithoutProject: vi.fn(),
}))

const {
  createOrReuseProjectFromPlan,
  createOrReuseProjectFromContractId,
} = await import('../projects/service.js')

const sqlStub = vi.fn()

const baseSnapshot = {
  client_id: 7,
  plan_id: 'contract:42',
  contract_id: 42,
  proposal_id: null,
  contract_type: 'leasing',
  client_name: 'ACME',
  cpf_cnpj: '11122233344',
  city: 'São Paulo',
  state: 'SP',
}

beforeEach(() => {
  mockFindProjectByPlanId.mockReset()
  mockInsertProject.mockReset()
  mockSeedPvDataFromClient.mockReset()
  mockGetPlanSnapshotFromContract.mockReset()
  sqlStub.mockReset()
  mockSeedPvDataFromClient.mockResolvedValue({ id: 'pv-1' })
})

describe('createOrReuseProjectFromPlan — idempotency & typing', () => {
  it('reuses the existing project when one is already bound to the same plan_id', async () => {
    mockFindProjectByPlanId.mockResolvedValueOnce({
      id: 'p-1',
      plan_id: 'contract:42',
      project_type: 'leasing',
      status: 'Aguardando',
      client_id: 7,
    })
    const { project, created } = await createOrReuseProjectFromPlan(sqlStub, baseSnapshot)
    expect(created).toBe(false)
    expect(project.id).toBe('p-1')
    expect(mockInsertProject).not.toHaveBeenCalled()
    expect(mockSeedPvDataFromClient).not.toHaveBeenCalled()
  })

  it('creates a LEASING project when contract_type is "leasing"', async () => {
    mockFindProjectByPlanId.mockResolvedValueOnce(null)
    mockInsertProject.mockResolvedValueOnce({
      id: 'p-2',
      plan_id: 'contract:42',
      project_type: 'leasing',
      status: 'Aguardando',
      client_id: 7,
    })
    const { project, created } = await createOrReuseProjectFromPlan(sqlStub, baseSnapshot)
    expect(created).toBe(true)
    expect(project.project_type).toBe('leasing')
    expect(mockInsertProject).toHaveBeenCalledTimes(1)
    const [, fields] = mockInsertProject.mock.calls[0]
    expect(fields.project_type).toBe('leasing')
    expect(fields.status).toBe('Aguardando')
    expect(mockSeedPvDataFromClient).toHaveBeenCalledWith(sqlStub, 'p-2', 7)
  })

  it('creates a VENDA project when contract_type is "sale"', async () => {
    mockFindProjectByPlanId.mockResolvedValueOnce(null)
    mockInsertProject.mockResolvedValueOnce({
      id: 'p-3',
      plan_id: 'contract:99',
      project_type: 'venda',
      status: 'Aguardando',
      client_id: 7,
    })
    const { project, created } = await createOrReuseProjectFromPlan(sqlStub, {
      ...baseSnapshot,
      plan_id: 'contract:99',
      contract_id: 99,
      contract_type: 'sale',
    })
    expect(created).toBe(true)
    expect(project.project_type).toBe('venda')
    const [, fields] = mockInsertProject.mock.calls[0]
    expect(fields.project_type).toBe('venda')
  })

  it('creates a VENDA project when contract_type is "venda"', async () => {
    mockFindProjectByPlanId.mockResolvedValueOnce(null)
    mockInsertProject.mockResolvedValueOnce({
      id: 'p-4',
      project_type: 'venda',
      client_id: 7,
    })
    await createOrReuseProjectFromPlan(sqlStub, { ...baseSnapshot, contract_type: 'venda' })
    const [, fields] = mockInsertProject.mock.calls[0]
    expect(fields.project_type).toBe('venda')
  })

  it('handles race collision: retries lookup when insert raises unique_violation (23505)', async () => {
    mockFindProjectByPlanId
      .mockResolvedValueOnce(null) // initial miss
      .mockResolvedValueOnce({ id: 'p-race', plan_id: 'contract:42', project_type: 'leasing' })
    const uniqueErr = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    })
    mockInsertProject.mockRejectedValueOnce(uniqueErr)

    const { project, created } = await createOrReuseProjectFromPlan(sqlStub, baseSnapshot)
    expect(created).toBe(false)
    expect(project.id).toBe('p-race')
  })

  it('re-throws non-23505 errors', async () => {
    mockFindProjectByPlanId.mockResolvedValueOnce(null)
    mockInsertProject.mockRejectedValueOnce(new Error('network down'))
    await expect(createOrReuseProjectFromPlan(sqlStub, baseSnapshot)).rejects.toThrow('network down')
  })

  it('rejects invalid plans with structured validationErrors', async () => {
    await expect(
      createOrReuseProjectFromPlan(sqlStub, { ...baseSnapshot, contract_type: 'nope' }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN' })
  })
})

describe('createOrReuseProjectFromContractId', () => {
  it('throws CONTRACT_NOT_FOUND when the contract is missing', async () => {
    mockGetPlanSnapshotFromContract.mockResolvedValueOnce(null)
    await expect(createOrReuseProjectFromContractId(sqlStub, 42)).rejects.toMatchObject({
      code: 'CONTRACT_NOT_FOUND',
    })
    expect(mockInsertProject).not.toHaveBeenCalled()
  })

  it('resolves snapshot from contract and delegates to createOrReuseProjectFromPlan', async () => {
    mockGetPlanSnapshotFromContract.mockResolvedValueOnce(baseSnapshot)
    mockFindProjectByPlanId.mockResolvedValueOnce(null)
    mockInsertProject.mockResolvedValueOnce({
      id: 'p-from-contract',
      plan_id: 'contract:42',
      project_type: 'leasing',
      client_id: 7,
    })
    const { project, created } = await createOrReuseProjectFromContractId(sqlStub, 42)
    expect(created).toBe(true)
    expect(project.id).toBe('p-from-contract')
    expect(mockGetPlanSnapshotFromContract).toHaveBeenCalledWith(sqlStub, 42)
  })
})
