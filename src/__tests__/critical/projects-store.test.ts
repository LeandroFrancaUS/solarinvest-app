// src/__tests__/critical/projects-store.test.ts
// Unit tests for useProjectsStore cache logic and state transitions.
// All external fetches are mocked — no network calls.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — vi.mock is hoisted; use vi.fn() inside the factory, then retrieve
// the references via vi.mocked() after the import.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../../services/projectsApi', () => ({
  fetchProjects: vi.fn(),
  fetchProjectById: vi.fn(),
  patchProjectStatus: vi.fn(),
  patchProjectPvData: vi.fn(),
  fetchProjectsSummary: vi.fn(),
  setProjectsTokenProvider: vi.fn(),
}))

import * as projectsApi from '../../services/projectsApi'
import { useProjectsStore } from '../../store/useProjectsStore'
import type { ProjectRow, ProjectPvData } from '../../domain/projects/types'

const mockFetchProjects = vi.mocked(projectsApi.fetchProjects)
const mockFetchProjectById = vi.mocked(projectsApi.fetchProjectById)
const mockPatchProjectStatus = vi.mocked(projectsApi.patchProjectStatus)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 'proj-1',
    client_id: 1,
    plan_id: 'contract:1',
    contract_id: 1,
    proposal_id: null,
    project_type: 'leasing',
    status: 'Aguardando',
    client_name_snapshot: 'ACME',
    cpf_cnpj_snapshot: '000.000.000-00',
    city_snapshot: 'São Paulo',
    state_snapshot: 'SP',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by_user_id: null,
    updated_by_user_id: null,
    deleted_at: null,
    ...overrides,
  }
}

function makePvData(): ProjectPvData {
  return {
    id: 'pv-1',
    project_id: 'proj-1',
    consumo_kwh_mes: 500,
    potencia_modulo_wp: 550,
    numero_modulos: 10,
    tipo_rede: 'monofasico',
    potencia_sistema_kwp: 5.5,
    geracao_estimada_kwh_mes: 600,
    area_utilizada_m2: 30,
    modelo_modulo: 'JA Solar 550W',
    modelo_inversor: 'WEG 5kW',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset store between tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useProjectsStore.getState().clearCache()
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// loadProjects
// ─────────────────────────────────────────────────────────────────────────────

describe('useProjectsStore — loadProjects', () => {
  it('populates list and total on success', async () => {
    const project = makeProject()
    mockFetchProjects.mockResolvedValueOnce({ rows: [project], meta: { total: 1 } })

    await useProjectsStore.getState().loadProjects()
    const state = useProjectsStore.getState()

    expect(state.list).toHaveLength(1)
    expect(state.list[0].id).toBe('proj-1')
    expect(state.listTotal).toBe(1)
    expect(state.listLoading).toBe(false)
    expect(state.listError).toBeNull()
  })

  it('sets listError on failure without clobbering the previous list', async () => {
    // Pre-populate list
    const project = makeProject()
    mockFetchProjects.mockResolvedValueOnce({ rows: [project], meta: { total: 1 } })
    await useProjectsStore.getState().loadProjects()

    // Simulate a network failure
    mockFetchProjects.mockRejectedValueOnce(new Error('Network timeout'))
    await useProjectsStore.getState().loadProjects()

    const state = useProjectsStore.getState()
    expect(state.listError).toBe('Network timeout')
    expect(state.listLoading).toBe(false)
    // Previous list is preserved on failure (store does not clear stale data when reload fails)
    expect(state.list).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// loadProjectById — cache TTL
// ─────────────────────────────────────────────────────────────────────────────

describe('useProjectsStore — loadProjectById cache', () => {
  it('fetches on first call and caches the result', async () => {
    const project = makeProject()
    const pv = makePvData()
    mockFetchProjectById.mockResolvedValueOnce({ project, pv_data: pv })

    await useProjectsStore.getState().loadProjectById('proj-1')

    expect(mockFetchProjectById).toHaveBeenCalledTimes(1)
    const cached = useProjectsStore.getState().cache['proj-1']
    expect(cached?.project.id).toBe('proj-1')
    expect(cached?.pv_data?.modelo_modulo).toBe('JA Solar 550W')
  })

  it('serves from cache on second call within TTL', async () => {
    const project = makeProject()
    mockFetchProjectById.mockResolvedValueOnce({ project, pv_data: null })

    await useProjectsStore.getState().loadProjectById('proj-1')
    await useProjectsStore.getState().loadProjectById('proj-1')

    expect(mockFetchProjectById).toHaveBeenCalledTimes(1)
  })

  it('re-fetches when forceRefresh=true', async () => {
    const project = makeProject()
    mockFetchProjectById.mockResolvedValue({ project, pv_data: null })

    await useProjectsStore.getState().loadProjectById('proj-1')
    await useProjectsStore.getState().loadProjectById('proj-1', true)

    expect(mockFetchProjectById).toHaveBeenCalledTimes(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// updateStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('useProjectsStore — updateStatus', () => {
  it('updates cache and list after a successful patch', async () => {
    // Seed list and cache
    const project = makeProject()
    useProjectsStore.setState({
      list: [project],
      listTotal: 1,
      cache: { 'proj-1': { project, pv_data: null, loadedAt: Date.now() } },
    })

    const updated = makeProject({ status: 'Em andamento' })
    mockPatchProjectStatus.mockResolvedValueOnce(updated)

    await useProjectsStore.getState().updateStatus('proj-1', 'Em andamento')

    const state = useProjectsStore.getState()
    expect(state.cache['proj-1']?.project.status).toBe('Em andamento')
    expect(state.list[0].status).toBe('Em andamento')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// clearCache
// ─────────────────────────────────────────────────────────────────────────────

describe('useProjectsStore — clearCache', () => {
  it('resets all list and cache state', async () => {
    const project = makeProject()
    mockFetchProjectById.mockResolvedValueOnce({ project, pv_data: null })
    await useProjectsStore.getState().loadProjectById('proj-1')

    useProjectsStore.getState().clearCache()

    const state = useProjectsStore.getState()
    expect(state.list).toHaveLength(0)
    expect(Object.keys(state.cache)).toHaveLength(0)
    expect(state.listTotal).toBe(0)
  })
})
