/**
 * src/hooks/__tests__/useIbgeMunicipios.test.ts
 *
 * Tests for the useIbgeMunicipios hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial state — empty maps, false flags, empty string terms
 *   2. ensureIbgeMunicipios returns [] for empty UF
 *   3. ensureIbgeMunicipios fetches and caches city list
 *   4. ensureIbgeMunicipios deduplicates in-flight requests (same UF, two calls)
 *   5. ensureIbgeMunicipios returns cached result on second call
 *   6. setUfsDisponiveis is called with sorted UF list on mount
 *   7. cidadeBloqueadaPorCep — setter closes dropdown and clears search term
 *   8. cidadesDisponiveis is derived from ibgeMunicipiosPorUf for the active UF
 *   9. cidadesFiltradas filters by search term using normalizeText
 *  10. cidadeManualDisponivel is true when typed city is not in the loaded list
 */

// Enable React act() flushing in jsdom (React 18 requirement)
// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useIbgeMunicipios,
  type UseIbgeMunicipiosOptions,
  type UseIbgeMunicipiosResult,
} from '../useIbgeMunicipios'

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library)
// ---------------------------------------------------------------------------

type HookRef = { current: UseIbgeMunicipiosResult }

function renderHook(
  buildOptions: () => UseIbgeMunicipiosOptions,
): {
  result: HookRef
  rerender: (buildOptions: () => UseIbgeMunicipiosOptions) => void
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseIbgeMunicipiosResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  let currentOptions = buildOptions()

  function TestComponent() {
    result.current = useIbgeMunicipios(currentOptions)
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(TestComponent))
  })

  return {
    result,
    rerender(newBuildOptions) {
      currentOptions = newBuildOptions()
      act(() => {
        root.render(React.createElement(TestComponent))
      })
    },
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a successful fetch response for a given JSON payload */
function mockJsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  } as unknown as Response
}

function makeOptions(override: Partial<UseIbgeMunicipiosOptions> = {}): UseIbgeMunicipiosOptions {
  return {
    clienteUfNormalizada: '',
    setUfsDisponiveis: vi.fn(),
    ...override,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useIbgeMunicipios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: estados returns empty array, municípios returns empty array
    mockFetch.mockResolvedValue(mockJsonResponse([]))
  })

  afterEach(() => {
    // each test cleans up its own root
  })

  // 1. Initial state
  it('starts with empty maps, false flags, and empty search terms', () => {
    const { result, unmount } = renderHook(() => makeOptions())

    expect(result.current.ibgeMunicipiosPorUf).toEqual({})
    expect(result.current.ibgeMunicipiosLoading).toEqual({})
    expect(result.current.cidadeBloqueadaPorCep).toBe(false)
    expect(result.current.cidadeSearchTerm).toBe('')
    expect(result.current.cidadeSelectOpen).toBe(false)
    expect(result.current.cidadesDisponiveis).toEqual([])
    expect(result.current.cidadesFiltradas).toEqual([])
    expect(result.current.cidadeManualDigitada).toBe('')
    expect(result.current.cidadeManualDisponivel).toBe(false)

    unmount()
  })

  // 2. ensureIbgeMunicipios returns [] for empty UF
  it('ensureIbgeMunicipios returns [] when given empty string', async () => {
    const { result, unmount } = renderHook(() => makeOptions())

    let cities: string[] = []
    await act(async () => {
      cities = await result.current.ensureIbgeMunicipios('')
    })

    expect(cities).toEqual([])
    // fetch should NOT have been called for an empty UF
    const municipiosCalls = mockFetch.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/municipios'),
    )
    expect(municipiosCalls).toHaveLength(0)

    unmount()
  })

  // 3. ensureIbgeMunicipios fetches and caches the city list
  it('ensureIbgeMunicipios fetches and caches sorted city list for given UF', async () => {
    const mockCities = [{ nome: 'São Paulo' }, { nome: 'Campinas' }, { nome: 'Araras' }]
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse([]))          // estados call on mount
      .mockResolvedValueOnce(mockJsonResponse(mockCities))  // municípios call

    const { result, unmount } = renderHook(() => makeOptions({ clienteUfNormalizada: 'SP' }))

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 20))
    })

    // Should have fetched both estados (on mount) and municípios (for SP)
    const municipiosCalls = mockFetch.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/municipios'),
    )
    expect(municipiosCalls.length).toBeGreaterThanOrEqual(1)

    // Cities should be sorted
    expect(result.current.ibgeMunicipiosPorUf['SP']).toEqual(['Araras', 'Campinas', 'São Paulo'])

    unmount()
  })

  // 4. In-flight deduplication — two concurrent calls produce one HTTP request
  it('deduplicates concurrent ensureIbgeMunicipios calls for the same UF', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })

    mockFetch
      .mockResolvedValueOnce(mockJsonResponse([]))  // estados
      .mockReturnValueOnce(pendingPromise)          // municípios (pending)

    const { result, unmount } = renderHook(() =>
      makeOptions({ clienteUfNormalizada: '' }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    // Issue two concurrent calls for the same UF
    let p1: Promise<string[]>, p2: Promise<string[]>
    let cities1: string[] = [], cities2: string[] = []
    act(() => {
      p1 = result.current.ensureIbgeMunicipios('MG')
      p2 = result.current.ensureIbgeMunicipios('MG')
    })

    // Resolve the pending fetch
    resolveFetch(mockJsonResponse([{ nome: 'Belo Horizonte' }]))

    // Both calls should return the same sorted list
    await act(async () => {
      ;[cities1, cities2] = await Promise.all([p1, p2])
    })

    // Both calls should return the same sorted list
    expect(cities1).toEqual(['Belo Horizonte'])
    expect(cities2).toEqual(['Belo Horizonte'])

    // Only ONE fetch for municípios should have been made for MG
    const mgCalls = mockFetch.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/MG/municipios'),
    )
    expect(mgCalls).toHaveLength(1)

    unmount()
  })

  // 5. Returns cached result on second call (no new fetch)
  it('returns cached cities on second ensureIbgeMunicipios call without fetching again', async () => {
    const mockCities = [{ nome: 'Fortaleza' }, { nome: 'Sobral' }]
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse([]))          // estados
      .mockResolvedValueOnce(mockJsonResponse(mockCities))  // first municípios fetch

    const { result, unmount } = renderHook(() =>
      makeOptions({ clienteUfNormalizada: 'CE' }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 20))
    })

    const fetchCountBefore = mockFetch.mock.calls.length

    // Second call
    let cities: string[] = []
    await act(async () => {
      cities = await result.current.ensureIbgeMunicipios('CE')
    })

    expect(cities).toEqual(['Fortaleza', 'Sobral'])
    // No new fetch after the cache is warm
    expect(mockFetch.mock.calls.length).toBe(fetchCountBefore)

    unmount()
  })

  // 6. setUfsDisponiveis is called when IBGE estados loads
  it('calls setUfsDisponiveis with sorted UF siglas when estados load', async () => {
    const mockEstados = [{ sigla: 'SP' }, { sigla: 'MG' }, { sigla: 'BA' }]
    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockEstados))

    const setUfsDisponiveis = vi.fn()
    const { unmount } = renderHook(() => makeOptions({ setUfsDisponiveis }))

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 20))
    })

    expect(setUfsDisponiveis).toHaveBeenCalledOnce()
    // Should be sorted alphabetically
    const [ufs] = setUfsDisponiveis.mock.calls[0] as [string[]]
    expect(ufs).toEqual(['BA', 'MG', 'SP'])

    unmount()
  })

  // 7. setCidadeBloqueadaPorCep closes dropdown and clears search term
  it('closes the city dropdown and clears search term when cidadeBloqueadaPorCep becomes true', async () => {
    const { result, unmount } = renderHook(() => makeOptions())

    // Open the dropdown and set a search term first
    act(() => {
      result.current.setCidadeSelectOpen(true)
      result.current.setCidadeSearchTerm('São')
    })

    expect(result.current.cidadeSelectOpen).toBe(true)
    expect(result.current.cidadeSearchTerm).toBe('São')

    // Now flag the city as resolved by CEP
    act(() => {
      result.current.setCidadeBloqueadaPorCep(true)
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(result.current.cidadeSelectOpen).toBe(false)
    expect(result.current.cidadeSearchTerm).toBe('')

    unmount()
  })

  // 8. cidadesDisponiveis is derived from loaded data for the active UF
  it('cidadesDisponiveis reflects the loaded city list for clienteUfNormalizada', async () => {
    const mockCities = [{ nome: 'Recife' }, { nome: 'Olinda' }]
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse([]))          // estados
      .mockResolvedValueOnce(mockJsonResponse(mockCities))  // municípios PE

    const { result, unmount } = renderHook(() =>
      makeOptions({ clienteUfNormalizada: 'PE' }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 20))
    })

    expect(result.current.cidadesDisponiveis).toEqual(['Olinda', 'Recife'])

    unmount()
  })

  // 9. cidadesFiltradas filters by search term
  it('cidadesFiltradas returns only cities matching the search term (accent-insensitive)', async () => {
    const mockCities = [{ nome: 'São Paulo' }, { nome: 'Santos' }, { nome: 'Campinas' }]
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse([]))          // estados
      .mockResolvedValueOnce(mockJsonResponse(mockCities))  // municípios SP

    const { result, unmount } = renderHook(() =>
      makeOptions({ clienteUfNormalizada: 'SP' }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 20))
    })

    act(() => {
      result.current.setCidadeSearchTerm('san')
    })

    // 'san' should match 'Santos' (and also 'São Paulo' via accent-insensitive 'sao')
    expect(result.current.cidadesFiltradas).toContain('Santos')
    expect(result.current.cidadesFiltradas).not.toContain('Campinas')

    unmount()
  })

  // 10. cidadeManualDisponivel is true for a typed city not in the list
  it('cidadeManualDisponivel is true when typed city is not in cidadesDisponiveis', async () => {
    const mockCities = [{ nome: 'Natal' }, { nome: 'Mossoró' }]
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse([]))          // estados
      .mockResolvedValueOnce(mockJsonResponse(mockCities))  // municípios RN

    const { result, unmount } = renderHook(() =>
      makeOptions({ clienteUfNormalizada: 'RN' }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 20))
    })

    act(() => {
      result.current.setCidadeSearchTerm('Cidade Inexistente')
    })

    expect(result.current.cidadeManualDigitada).toBe('Cidade Inexistente')
    expect(result.current.cidadeManualDisponivel).toBe(true)

    // Typing a city that IS in the list should set it to false
    act(() => {
      result.current.setCidadeSearchTerm('Natal')
    })

    expect(result.current.cidadeManualDisponivel).toBe(false)

    unmount()
  })
})
