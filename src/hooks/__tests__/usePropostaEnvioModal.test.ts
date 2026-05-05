/**
 * src/hooks/__tests__/usePropostaEnvioModal.test.ts
 *
 * Tests for the usePropostaEnvioModal hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial state — modal closed, no selected contact
 *   2. contatosEnvio is empty when all inputs are empty
 *   3. contatosEnvio includes current cliente when they have contact info
 *   4. contatosEnvio includes clientesSalvos entries
 *   5. contatosEnvio includes crmLeads entries
 *   6. contatosEnvio deduplicates by phone number
 *   7. Auto-selects the first contact when contatosEnvio becomes non-empty
 *   8. selecionarContatoEnvio sets the selected contact ID
 *   9. fecharEnvioPropostaModal closes the modal
 *  10. contatoEnvioSelecionado returns the selected contato object
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, afterEach } from 'vitest'
import {
  usePropostaEnvioModal,
  type UsePropostaEnvioModalResult,
  type UsePropostaEnvioModalParams,
} from '../usePropostaEnvioModal'

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library dependency)
// ---------------------------------------------------------------------------

function renderHook(params: UsePropostaEnvioModalParams): {
  result: { current: UsePropostaEnvioModalResult }
  unmount: () => void
} {
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)
  const result = { current: null as unknown as UsePropostaEnvioModalResult }
  let latestParams = params

  function HookCapture() {
    result.current = usePropostaEnvioModal(latestParams)
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(HookCapture))
  })

  return {
    result,
    unmount: () => {
      act(() => root.unmount())
      document.body.removeChild(container)
    },
  }
}

const emptyParams: UsePropostaEnvioModalParams = {
  cliente: {},
  clientesSalvos: [],
  crmLeads: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePropostaEnvioModal', () => {
  let unmount: () => void

  afterEach(() => {
    unmount?.()
  })

  // 1. Initial state
  it('starts with modal closed and no selected contact', () => {
    const { result, unmount: u } = renderHook(emptyParams)
    unmount = u

    expect(result.current.isEnviarPropostaModalOpen).toBe(false)
    expect(result.current.contatoEnvioSelecionadoId).toBeNull()
  })

  // 2. Empty inputs → empty contatosEnvio
  it('contatosEnvio is empty when all inputs are empty', () => {
    const { result, unmount: u } = renderHook(emptyParams)
    unmount = u

    expect(result.current.contatosEnvio).toHaveLength(0)
  })

  // 3. Cliente with contact info appears in contatosEnvio
  it('includes current cliente when they have contact info', () => {
    const { result, unmount: u } = renderHook({
      cliente: { nome: 'João', telefone: '(11) 99999-0001', email: 'joao@example.com' },
      clientesSalvos: [],
      crmLeads: [],
    })
    unmount = u

    expect(result.current.contatosEnvio).toHaveLength(1)
    expect(result.current.contatosEnvio[0]!.nome).toBe('João')
    expect(result.current.contatosEnvio[0]!.origem).toBe('cliente-atual')
  })

  // 4. clientesSalvos appear in contatosEnvio
  it('includes clientesSalvos entries', () => {
    const { result, unmount: u } = renderHook({
      cliente: {},
      clientesSalvos: [
        { id: 'saved-1', dados: { nome: 'Maria', telefone: '(11) 99999-0002' } },
      ],
      crmLeads: [],
    })
    unmount = u

    expect(result.current.contatosEnvio).toHaveLength(1)
    expect(result.current.contatosEnvio[0]!.nome).toBe('Maria')
    expect(result.current.contatosEnvio[0]!.origem).toBe('cliente-salvo')
  })

  // 5. crmLeads appear in contatosEnvio
  it('includes crmLeads entries', () => {
    const { result, unmount: u } = renderHook({
      cliente: {},
      clientesSalvos: [],
      crmLeads: [{ id: 'lead-1', nome: 'Pedro', telefone: '(11) 99999-0003' }],
    })
    unmount = u

    expect(result.current.contatosEnvio).toHaveLength(1)
    expect(result.current.contatosEnvio[0]!.nome).toBe('Pedro')
    expect(result.current.contatosEnvio[0]!.origem).toBe('crm')
  })

  // 6. Deduplication by phone number
  it('deduplicates contacts with the same phone digits', () => {
    const { result, unmount: u } = renderHook({
      cliente: { nome: 'João', telefone: '(11) 99999-0004' },
      clientesSalvos: [],
      crmLeads: [{ id: 'lead-dup', nome: 'João CRM', telefone: '11999990004' }],
    })
    unmount = u

    // Both have same digits → only one entry
    expect(result.current.contatosEnvio).toHaveLength(1)
  })

  // 7. Auto-selects first contact
  it('auto-selects the first contact when contatosEnvio is non-empty', () => {
    const { result, unmount: u } = renderHook({
      cliente: { nome: 'Ana', telefone: '(11) 99999-0005' },
      clientesSalvos: [],
      crmLeads: [],
    })
    unmount = u

    expect(result.current.contatoEnvioSelecionadoId).not.toBeNull()
    expect(result.current.contatoEnvioSelecionadoId).toBe(result.current.contatosEnvio[0]?.id)
  })

  // 8. selecionarContatoEnvio
  it('selecionarContatoEnvio sets the selected contact ID', () => {
    const { result, unmount: u } = renderHook({
      cliente: { nome: 'A', telefone: '(11) 99999-0006' },
      clientesSalvos: [{ id: 'saved-2', dados: { nome: 'B', telefone: '(11) 99999-0007' } }],
      crmLeads: [],
    })
    unmount = u

    const secondId = result.current.contatosEnvio[1]?.id
    if (!secondId) return // guard

    act(() => {
      result.current.selecionarContatoEnvio(secondId)
    })

    expect(result.current.contatoEnvioSelecionadoId).toBe(secondId)
  })

  // 9. fecharEnvioPropostaModal
  it('fecharEnvioPropostaModal closes the modal', () => {
    const { result, unmount: u } = renderHook(emptyParams)
    unmount = u

    act(() => {
      result.current.setIsEnviarPropostaModalOpen(true)
    })
    expect(result.current.isEnviarPropostaModalOpen).toBe(true)

    act(() => {
      result.current.fecharEnvioPropostaModal()
    })
    expect(result.current.isEnviarPropostaModalOpen).toBe(false)
  })

  // 10. contatoEnvioSelecionado
  it('contatoEnvioSelecionado returns the full contato object for the selected ID', () => {
    const { result, unmount: u } = renderHook({
      cliente: { nome: 'Carlos', telefone: '(11) 99999-0008' },
      clientesSalvos: [],
      crmLeads: [],
    })
    unmount = u

    const selectedId = result.current.contatoEnvioSelecionadoId
    expect(selectedId).not.toBeNull()
    expect(result.current.contatoEnvioSelecionado).not.toBeNull()
    expect(result.current.contatoEnvioSelecionado?.id).toBe(selectedId)
  })
})
