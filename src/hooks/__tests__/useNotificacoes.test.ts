/**
 * src/hooks/__tests__/useNotificacoes.test.ts
 *
 * Tests for the useNotificacoes hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial state — notificacoes is empty
 *   2. adicionarNotificacao adds a notification with the given message and tipo
 *   3. adicionarNotificacao defaults tipo to 'info'
 *   4. adicionarNotificacao assigns incrementing IDs
 *   5. removerNotificacao removes the notification by ID
 *   6. removerNotificacao no-ops when ID not found
 *   7. Multiple notifications can coexist; each has a unique ID
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useNotificacoes,
  type UseNotificacoesResult,
} from '../useNotificacoes'

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library)
// ---------------------------------------------------------------------------

function renderHook(): {
  result: { current: UseNotificacoesResult }
  unmount: () => void
} {
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)
  const result = { current: null as unknown as UseNotificacoesResult }

  function TestComponent() {
    result.current = useNotificacoes()
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(TestComponent))
  })

  return {
    result,
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNotificacoes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 1. Initial state
  it('starts with an empty notificacoes array', () => {
    const { result, unmount } = renderHook()
    expect(result.current.notificacoes).toEqual([])
    unmount()
  })

  // 2. adicionarNotificacao adds a notification
  it('adicionarNotificacao adds a notification with the correct message and tipo', () => {
    const { result, unmount } = renderHook()

    act(() => {
      result.current.adicionarNotificacao('Operação concluída', 'success')
    })

    expect(result.current.notificacoes).toHaveLength(1)
    expect(result.current.notificacoes[0]!.mensagem).toBe('Operação concluída')
    expect(result.current.notificacoes[0]!.tipo).toBe('success')

    unmount()
  })

  // 3. Default tipo is 'info'
  it('adicionarNotificacao defaults tipo to "info"', () => {
    const { result, unmount } = renderHook()

    act(() => {
      result.current.adicionarNotificacao('Mensagem padrão')
    })

    expect(result.current.notificacoes[0]!.tipo).toBe('info')

    unmount()
  })

  // 4. Incrementing IDs
  it('assigns incrementing IDs to notifications', () => {
    const { result, unmount } = renderHook()

    act(() => {
      result.current.adicionarNotificacao('Primeira')
      result.current.adicionarNotificacao('Segunda')
    })

    const ids = result.current.notificacoes.map((n) => n.id)
    expect(ids[0]!).toBeLessThan(ids[1]!)
    expect(new Set(ids).size).toBe(2)

    unmount()
  })

  // 5. removerNotificacao removes by ID
  it('removerNotificacao removes the notification with the given ID', () => {
    const { result, unmount } = renderHook()

    act(() => {
      result.current.adicionarNotificacao('Para remover', 'error')
    })

    const id = result.current.notificacoes[0]!.id

    act(() => {
      result.current.removerNotificacao(id)
    })

    expect(result.current.notificacoes).toHaveLength(0)

    unmount()
  })

  // 6. removerNotificacao no-ops for unknown ID
  it('removerNotificacao is a no-op when the ID is not in the list', () => {
    const { result, unmount } = renderHook()

    act(() => {
      result.current.adicionarNotificacao('Permanece')
    })

    act(() => {
      result.current.removerNotificacao(9999)
    })

    expect(result.current.notificacoes).toHaveLength(1)

    unmount()
  })

  // 7. Multiple notifications can coexist
  it('multiple notifications can coexist in the queue', () => {
    const { result, unmount } = renderHook()

    act(() => {
      result.current.adicionarNotificacao('Um', 'info')
      result.current.adicionarNotificacao('Dois', 'success')
      result.current.adicionarNotificacao('Três', 'error')
    })

    expect(result.current.notificacoes).toHaveLength(3)

    unmount()
  })

  // 8. Auto-dismiss after 5 seconds
  it('notification is automatically removed after 5000 ms', () => {
    const { result, unmount } = renderHook()

    act(() => {
      result.current.adicionarNotificacao('Auto-dismiss')
    })

    expect(result.current.notificacoes).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.notificacoes).toHaveLength(0)

    unmount()
  })
})
