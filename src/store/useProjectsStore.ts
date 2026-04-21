// src/store/useProjectsStore.ts
// Lightweight in-memory cache for the Projects list / detail.
// • No localStorage — data is persisted in DB; cache is session-only.
// • Follows the createStore pattern used by other stores in this directory.
// • Exposes: loadProjects, loadProjectById, updateStatus, clearCache.

import { createStore } from './createStore'
import {
  fetchProjects,
  fetchProjectById,
  patchProjectStatus,
  type ProjectListResponse,
} from '../services/projectsApi'
import type { ProjectListFilters, ProjectRow, ProjectPvData, ProjectStatus } from '../domain/projects/types'

interface ProjectCache {
  project: ProjectRow
  pv_data: ProjectPvData | null
  loadedAt: number
}

interface ProjectsState {
  // List
  list: ProjectRow[]
  listTotal: number
  listLoading: boolean
  listError: string | null
  lastListFilters: ProjectListFilters

  // Detail cache
  cache: Record<string, ProjectCache>
  detailLoading: Record<string, boolean>
  detailError: Record<string, string | null>

  // Actions
  loadProjects: (filters?: ProjectListFilters) => Promise<void>
  loadProjectById: (id: string, forceRefresh?: boolean) => Promise<void>
  updateStatus: (id: string, status: ProjectStatus) => Promise<void>
  clearCache: () => void
}

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1_000

export const useProjectsStore = createStore<ProjectsState>((set, get) => ({
  list: [],
  listTotal: 0,
  listLoading: false,
  listError: null,
  lastListFilters: {},

  cache: {},
  detailLoading: {},
  detailError: {},

  async loadProjects(filters: ProjectListFilters = {}): Promise<void> {
    set({ listLoading: true, listError: null, lastListFilters: filters })
    try {
      const res: ProjectListResponse = await fetchProjects({
        order_by: 'updated_at',
        order_dir: 'desc',
        limit: 100,
        ...filters,
      })
      set({ list: res.rows, listTotal: res.meta.total, listLoading: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar projetos.'
      set({ listLoading: false, listError: msg })
    }
  },

  async loadProjectById(id: string, forceRefresh = false): Promise<void> {
    const state = get()
    const cached = state.cache[id]
    if (!forceRefresh && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return
    }
    set({
      detailLoading: { ...get().detailLoading, [id]: true },
      detailError: { ...get().detailError, [id]: null },
    })
    try {
      const { project, pv_data } = await fetchProjectById(id)
      set({
        cache: { ...get().cache, [id]: { project, pv_data, loadedAt: Date.now() } },
        detailLoading: { ...get().detailLoading, [id]: false },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar projeto.'
      set({
        detailLoading: { ...get().detailLoading, [id]: false },
        detailError: { ...get().detailError, [id]: msg },
      })
    }
  },

  async updateStatus(id: string, status: ProjectStatus): Promise<void> {
    const updated = await patchProjectStatus(id, status)
    const prev = get().cache[id]
    set({
      cache: {
        ...get().cache,
        [id]: { project: updated, pv_data: prev?.pv_data ?? null, loadedAt: Date.now() },
      },
      list: get().list.map((p) => (p.id === id ? updated : p)),
    })
  },

  clearCache(): void {
    set({ cache: {}, detailLoading: {}, detailError: {}, list: [], listTotal: 0 })
  },
}))
