/**
 * src/hooks/__tests__/useContractModalState.test.ts
 *
 * Tests for the useContractModalState hook.
 *
 * Covered:
 *   1. Initial state defaults
 *   2. leasingAnexosSelecionados initialised with defaults for tipoContrato
 *   3. handleToggleContractTemplate — add/remove from selectedContractTemplates
 *   4. handleSelectAllContractTemplates — select all / deselect all
 *   5. handleToggleLeasingAnexo — add/remove non-required annexes
 *   6. handleToggleLeasingAnexo — blocked for autoInclude annexes
 *   7. handleSelectAllLeasingAnexos — selectAll=false enforces required set
 *   8. handleFecharModalContratos — closes modal + clears contratoClientePayloadRef
 *   9. handleFecharLeasingContractsModal — closes leasing modal
 *  10. abrirSelecaoContratos — noop when gerandoContratos=true
 *  11. abrirSelecaoContratos — noop when prepararDadosRef.current is null
 *  12. abrirSelecaoContratos — opens modal + calls carregarTemplatesContrato
 *  13. carregarTemplatesContrato — success path: populates contractTemplates
 *  14. carregarTemplatesContrato — error path: sets contractTemplatesError
 *  15. tipoContrato change effect keeps required annexes
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import {
  useContractModalState,
  type UseContractModalStateOptions,
  type UseContractModalStateResult,
} from '../useContractModalState'
import type { ClienteContratoPayload } from '../../types/contratoTypes'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../utils/apiUrl', () => ({
  resolveApiUrl: (path: string) => `http://localhost${path}`,
}))

// ---------------------------------------------------------------------------
// Minimal renderHook
// ---------------------------------------------------------------------------

type HookRef = { current: UseContractModalStateResult }

type RenderOpts = Omit<UseContractModalStateOptions, 'prepararDadosRef'> & {
  prepararDados?: (() => ClienteContratoPayload | null) | null
}

function renderHook(opts: RenderOpts): {
  result: HookRef
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseContractModalStateResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function Harness() {
    const prepararDadosRef = useRef<(() => ClienteContratoPayload | null) | null>(
      opts.prepararDados !== undefined ? opts.prepararDados : null,
    )
    result.current = useContractModalState({
      tipoContrato: opts.tipoContrato,
      corresponsavelAtivo: opts.corresponsavelAtivo,
      clienteUf: opts.clienteUf,
      adicionarNotificacao: opts.adicionarNotificacao,
      prepararDadosRef,
    })
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(Harness))
  })

  return {
    result,
    unmount() {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

const mockNotify = vi.fn()

function makeOpts(override: Partial<RenderOpts> = {}): RenderOpts {
  return {
    tipoContrato: 'residencial',
    corresponsavelAtivo: false,
    clienteUf: 'GO',
    adicionarNotificacao: mockNotify,
    ...override,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useContractModalState', () => {
  let unmount: () => void

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => { unmount?.() })

  it('1. initial state defaults', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    expect(result.current.gerandoContratos).toBe(false)
    expect(result.current.isContractTemplatesModalOpen).toBe(false)
    expect(result.current.isLeasingContractsModalOpen).toBe(false)
    expect(result.current.clientReadinessErrors).toBeNull()
    expect(result.current.contractTemplatesLoading).toBe(false)
    expect(result.current.contractTemplatesError).toBeNull()
    expect(result.current.contractTemplates).toEqual([])
    expect(result.current.selectedContractTemplates).toEqual([])
    expect(result.current.contractTemplatesCategory).toBe('vendas')
  })

  it('2. leasingAnexosSelecionados initialised with defaults for residencial', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    // autoInclude annexes for residencial: ANEXO_II, ANEXO_III, ANEXO_IV, ANEXO_VIII
    expect(result.current.leasingAnexosSelecionados).toContain('ANEXO_II')
    expect(result.current.leasingAnexosSelecionados).toContain('ANEXO_VIII')
    expect(result.current.leasingAnexosSelecionados).not.toContain('ANEXO_X')
  })

  it('3a. handleToggleContractTemplate — adds template when not present', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    act(() => {
      result.current.setContractTemplates(['tpl-a', 'tpl-b'])
    })
    act(() => {
      result.current.handleToggleContractTemplate('tpl-a')
    })
    expect(result.current.selectedContractTemplates).toContain('tpl-a')
  })

  it('3b. handleToggleContractTemplate — removes template when already selected', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    act(() => {
      result.current.setSelectedContractTemplates(['tpl-a', 'tpl-b'])
    })
    act(() => {
      result.current.handleToggleContractTemplate('tpl-a')
    })
    expect(result.current.selectedContractTemplates).not.toContain('tpl-a')
    expect(result.current.selectedContractTemplates).toContain('tpl-b')
  })

  it('4a. handleSelectAllContractTemplates(true) selects all templates', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    act(() => { result.current.setContractTemplates(['a', 'b', 'c']) })
    act(() => { result.current.handleSelectAllContractTemplates(true) })
    expect(result.current.selectedContractTemplates).toEqual(['a', 'b', 'c'])
  })

  it('4b. handleSelectAllContractTemplates(false) deselects all', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    act(() => { result.current.setSelectedContractTemplates(['a', 'b']) })
    act(() => { result.current.handleSelectAllContractTemplates(false) })
    expect(result.current.selectedContractTemplates).toEqual([])
  })

  it('5. handleToggleLeasingAnexo — toggles non-required annexe', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    act(() => { result.current.handleToggleLeasingAnexo('ANEXO_I') })
    const contains = result.current.leasingAnexosSelecionados.includes('ANEXO_I')
    act(() => { result.current.handleToggleLeasingAnexo('ANEXO_I') })
    expect(result.current.leasingAnexosSelecionados.includes('ANEXO_I')).toBe(!contains)
  })

  it('6. handleToggleLeasingAnexo — blocked for autoInclude ANEXO_II', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    const before = [...result.current.leasingAnexosSelecionados]
    act(() => { result.current.handleToggleLeasingAnexo('ANEXO_II') })
    expect(result.current.leasingAnexosSelecionados).toEqual(before)
  })

  it('7. handleSelectAllLeasingAnexos(false) enforces required set', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    act(() => { result.current.handleSelectAllLeasingAnexos(false) })
    // Required autoInclude annexes must remain
    expect(result.current.leasingAnexosSelecionados).toContain('ANEXO_II')
  })

  it('8. handleFecharModalContratos closes modal + clears ref', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    act(() => { result.current.setIsContractTemplatesModalOpen(true) })
    act(() => {
      result.current.contratoClientePayloadRef.current = {
        nomeCompleto: 'Test',
      } as ClienteContratoPayload
    })
    act(() => { result.current.handleFecharModalContratos() })
    expect(result.current.isContractTemplatesModalOpen).toBe(false)
    expect(result.current.contratoClientePayloadRef.current).toBeNull()
  })

  it('9. handleFecharLeasingContractsModal closes leasing modal', () => {
    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u
    act(() => { result.current.setIsLeasingContractsModalOpen(true) })
    act(() => { result.current.handleFecharLeasingContractsModal() })
    expect(result.current.isLeasingContractsModalOpen).toBe(false)
  })

  it('10. abrirSelecaoContratos is noop when gerandoContratos=true', () => {
    const prepararDados = vi.fn().mockReturnValue({ nomeCompleto: 'X' })
    const { result, unmount: u } = renderHook(makeOpts({ prepararDados }))
    unmount = u
    act(() => { result.current.setGerandoContratos(true) })
    act(() => { result.current.abrirSelecaoContratos('vendas') })
    expect(result.current.isContractTemplatesModalOpen).toBe(false)
    expect(prepararDados).not.toHaveBeenCalled()
  })

  it('11. abrirSelecaoContratos is noop when prepararDadosRef.current is null', () => {
    const { result, unmount: u } = renderHook(makeOpts({ prepararDados: null }))
    unmount = u
    act(() => { result.current.abrirSelecaoContratos('vendas') })
    expect(result.current.isContractTemplatesModalOpen).toBe(false)
  })

  it('12. abrirSelecaoContratos opens modal when prepararDados returns payload', async () => {
    const payload: ClienteContratoPayload = { nomeCompleto: 'João Silva' } as ClienteContratoPayload
    const prepararDados = vi.fn().mockReturnValue(payload)

    // Mock fetch for carregarTemplatesContrato
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ templates: ['contrato-a.docx'] }),
      headers: { get: () => 'application/json' },
    }))

    const { result, unmount: u } = renderHook(makeOpts({ prepararDados }))
    unmount = u

    await act(async () => {
      await result.current.carregarTemplatesContrato('vendas')
      result.current.abrirSelecaoContratos('vendas')
    })

    expect(result.current.isContractTemplatesModalOpen).toBe(true)
    expect(result.current.contractTemplatesCategory).toBe('vendas')
    expect(result.current.contratoClientePayloadRef.current).toBe(payload)

    vi.unstubAllGlobals()
  })

  it('13. carregarTemplatesContrato success path — populates contractTemplates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ templates: ['a.docx', 'b.docx'] }),
      headers: { get: () => 'application/json' },
    }))

    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u

    await act(async () => {
      await result.current.carregarTemplatesContrato('vendas')
    })

    expect(result.current.contractTemplates).toEqual(['a.docx', 'b.docx'])
    expect(result.current.selectedContractTemplates).toEqual(['a.docx', 'b.docx'])
    expect(result.current.contractTemplatesLoading).toBe(false)

    vi.unstubAllGlobals()
  })

  it('14. carregarTemplatesContrato error path — sets contractTemplatesError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ error: 'Serviço indisponível' }),
      text: () => Promise.resolve(''),
    }))

    const { result, unmount: u } = renderHook(makeOpts())
    unmount = u

    await act(async () => {
      await result.current.carregarTemplatesContrato('vendas')
    })

    expect(result.current.contractTemplatesError).toBeTruthy()
    expect(result.current.contractTemplates).toEqual([])
    expect(mockNotify).toHaveBeenCalledWith(expect.any(String), 'error')

    vi.unstubAllGlobals()
  })

  it('15. tipoContrato change effect keeps required annexes valid', async () => {
    // Start as residencial
    const { result, unmount: u } = renderHook(makeOpts({ tipoContrato: 'residencial' }))
    unmount = u
    await act(async () => {})
    // ANEXO_IV is residencial-only autoInclude — it should be in the list
    expect(result.current.leasingAnexosSelecionados).toContain('ANEXO_IV')
  })
})
