/**
 * src/features/crm/__tests__/useCrm.test.ts
 *
 * Validates the useCrm hook surface after Phase 1C extraction.
 *
 * Covered:
 *   3. handleCrmLeadFormSubmit with a valid form creates exactly 1 lead
 *   4. handleMoverLead(leadId, 1) advances the lead to the next pipeline stage
 *   5. handleSelecionarLead(leadId) sets crmLeadSelecionadoId
 *   6. handleAdicionarNotaCrm with text filled adds a timeline entry for the selected lead
 *   7. handleRemoverLead removes the lead from crmDataset.leads
 *   8. persistCrmDataset writes to localStorage['solarinvest-crm-dataset']
 */

// Enable React act() flushing in jsdom (React 18 requirement)
// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCrm } from '../useCrm'
import type { UseCrmDeps, UseCrmState } from '../crmTypes'
import { CRM_LOCAL_STORAGE_KEY } from '../crmConstants'

// ---------------------------------------------------------------------------
// Minimal renderHook that works with React 18 + jsdom (no @testing-library)
// ---------------------------------------------------------------------------
function renderHook(useHook: () => UseCrmState): {
  result: { current: UseCrmState }
  unmount: () => void
} {
  const result = { current: null as unknown as UseCrmState }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function TestComponent() {
    result.current = useHook()
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(TestComponent))
  })

  return {
    result,
    unmount() {
      act(() => root.unmount())
      if (container.parentNode) container.parentNode.removeChild(container)
    },
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const makeDeps = (): UseCrmDeps => ({ adicionarNotificacao: vi.fn() })

const validForm = {
  nome: 'João Teste',
  telefone: '11999998888',
  email: '',
  cidade: 'São Paulo',
  tipoImovel: 'Residencial',
  consumoKwhMes: '450',
  origemLead: 'Site',
  interesse: 'Leasing',
  tipoOperacao: 'LEASING' as const,
  valorEstimado: '25000',
  notas: '',
}

const fakeSubmitEvent = (): React.FormEvent<HTMLFormElement> =>
  ({ preventDefault: vi.fn() }) as unknown as React.FormEvent<HTMLFormElement>

/** Creates a lead via the hook and returns the updated hook state. */
function criarLead(result: { current: UseCrmState }) {
  act(() => result.current.setCrmLeadForm(validForm))
  act(() => result.current.handleCrmLeadFormSubmit(fakeSubmitEvent()))
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useCrm', () => {
  it('handleCrmLeadFormSubmit com form válido cria 1 lead', () => {
    const { result, unmount } = renderHook(() => useCrm(makeDeps()))

    criarLead(result)

    expect(result.current.crmDataset.leads).toHaveLength(1)
    expect(result.current.crmDataset.leads[0]?.nome).toBe('João Teste')
    expect(result.current.crmDataset.leads[0]?.etapa).toBe('novo-lead')

    unmount()
  })

  it('handleMoverLead(leadId, 1) avança etapa do lead', () => {
    const { result, unmount } = renderHook(() => useCrm(makeDeps()))

    criarLead(result)
    const leadId = result.current.crmDataset.leads[0]?.id ?? ''

    expect(result.current.crmDataset.leads[0]?.etapa).toBe('novo-lead')

    act(() => result.current.handleMoverLead(leadId, 1))

    expect(result.current.crmDataset.leads[0]?.etapa).toBe('qualificacao')

    unmount()
  })

  it('handleSelecionarLead(leadId) seta crmLeadSelecionadoId', () => {
    const { result, unmount } = renderHook(() => useCrm(makeDeps()))

    criarLead(result)
    const leadId3 = result.current.crmDataset.leads[0]?.id ?? ''

    // Deselect first (handleCrmLeadFormSubmit auto-selects the new lead)
    act(() => result.current.setCrmLeadSelecionadoId(null))
    expect(result.current.crmLeadSelecionadoId).toBeNull()

    act(() => result.current.handleSelecionarLead(leadId3))

    expect(result.current.crmLeadSelecionadoId).toBe(leadId3)

    unmount()
  })

  it('handleAdicionarNotaCrm com texto preenchido adiciona entrada na timeline', () => {
    const { result, unmount } = renderHook(() => useCrm(makeDeps()))

    criarLead(result)
    const leadId6 = result.current.crmDataset.leads[0]?.id ?? ''
    const timelineAntes = result.current.crmDataset.timeline.length

    // Ensure lead is selected and nota text is set
    act(() => result.current.setCrmLeadSelecionadoId(leadId6))
    act(() => result.current.setCrmNotaTexto('Nota de teste automatizado'))

    act(() => result.current.handleAdicionarNotaCrm())

    expect(result.current.crmDataset.timeline.length).toBeGreaterThan(timelineAntes)

    const nota = result.current.crmDataset.timeline.find(
      (entry) => entry.tipo === 'anotacao' && entry.leadId === leadId6,
    )
    expect(nota).toBeDefined()
    expect(nota?.mensagem).toBe('Nota de teste automatizado')

    unmount()
  })

  it('handleRemoverLead remove o lead de crmDataset.leads', () => {
    const { result, unmount } = renderHook(() => useCrm(makeDeps()))

    criarLead(result)
    expect(result.current.crmDataset.leads).toHaveLength(1)
    const leadId7 = result.current.crmDataset.leads[0]?.id ?? ''

    act(() => result.current.handleRemoverLead(leadId7))

    expect(result.current.crmDataset.leads).toHaveLength(0)

    unmount()
  })

  it('persistCrmDataset salva em localStorage com chave solarinvest-crm-dataset', () => {
    const { result, unmount } = renderHook(() => useCrm(makeDeps()))

    // Create a lead so there is non-empty data to persist
    criarLead(result)
    const dataset = result.current.crmDataset

    // Call persistCrmDataset directly (it is part of the public hook API)
    act(() => {
      void result.current.persistCrmDataset(dataset, 'manual')
    })

    const stored = localStorage.getItem(CRM_LOCAL_STORAGE_KEY)
    expect(stored).not.toBeNull()

    const parsed: unknown = JSON.parse(stored ?? '{}')
    expect(parsed).toMatchObject({ leads: [{ nome: 'João Teste' }] })

    unmount()
  })
})
