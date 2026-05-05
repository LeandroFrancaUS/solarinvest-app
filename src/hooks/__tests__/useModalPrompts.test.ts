/**
 * src/hooks/__tests__/useModalPrompts.test.ts
 *
 * Tests for the useModalPrompts hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial state — saveDecisionPrompt=null, confirmDialog=null
 *   2. requestSaveDecision opens the prompt; resolveSaveDecisionPrompt resolves it
 *   3. resolveSaveDecisionPrompt clears saveDecisionPrompt back to null
 *   4. requestConfirmDialog opens the dialog; resolveConfirmDialog resolves it
 *   5. resolveConfirmDialog clears confirmDialog back to null
 *   6. SSR safety — requestSaveDecision resolves 'discard' when window is undefined
 *   7. SSR safety — requestConfirmDialog resolves false when window is undefined
 */

// Enable React act() flushing in jsdom (React 18 requirement)
// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useModalPrompts, type UseModalPromptsResult } from '../useModalPrompts'

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library)
// ---------------------------------------------------------------------------

type HookRef = { current: UseModalPromptsResult }

function renderHook(): {
  result: HookRef
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseModalPromptsResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function TestComponent() {
    result.current = useModalPrompts()
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

describe('useModalPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // each test creates and tears down its own root
  })

  // 1. Initial state
  it('starts with saveDecisionPrompt=null and confirmDialog=null', () => {
    const { result, unmount } = renderHook()

    expect(result.current.saveDecisionPrompt).toBeNull()
    expect(result.current.confirmDialog).toBeNull()

    unmount()
  })

  // 2. requestSaveDecision opens the prompt with the provided options
  it('requestSaveDecision sets saveDecisionPrompt with title and description', async () => {
    const { result, unmount } = renderHook()

    let resolved = false
    act(() => {
      void result.current
        .requestSaveDecision({ title: 'Salvar?', description: 'Você quer salvar?' })
        .then(() => {
          resolved = true
        })
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(result.current.saveDecisionPrompt).not.toBeNull()
    expect(result.current.saveDecisionPrompt?.title).toBe('Salvar?')
    expect(result.current.saveDecisionPrompt?.description).toBe('Você quer salvar?')
    expect(resolved).toBe(false)

    unmount()
  })

  // 3. resolveSaveDecisionPrompt resolves the promise and clears the prompt
  it('resolveSaveDecisionPrompt resolves with the given choice and clears the prompt', async () => {
    const { result, unmount } = renderHook()

    let choice: string | undefined
    act(() => {
      void result.current
        .requestSaveDecision({ title: 'Salvar?', description: 'Desc' })
        .then((c) => {
          choice = c
        })
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    act(() => {
      result.current.resolveSaveDecisionPrompt('save')
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(choice).toBe('save')
    expect(result.current.saveDecisionPrompt).toBeNull()

    unmount()
  })

  // 4. requestConfirmDialog opens the dialog with the provided options
  it('requestConfirmDialog sets confirmDialog with title and description', async () => {
    const { result, unmount } = renderHook()

    act(() => {
      void result.current.requestConfirmDialog({ title: 'Tem certeza?', description: 'Ação irreversível' })
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(result.current.confirmDialog).not.toBeNull()
    expect(result.current.confirmDialog?.title).toBe('Tem certeza?')
    expect(result.current.confirmDialog?.description).toBe('Ação irreversível')

    unmount()
  })

  // 5. resolveConfirmDialog resolves and clears the dialog
  it('resolveConfirmDialog resolves with the given boolean and clears the dialog', async () => {
    const { result, unmount } = renderHook()

    let confirmed: boolean | undefined
    act(() => {
      void result.current
        .requestConfirmDialog({ title: 'Confirmar?', description: 'Ação' })
        .then((c) => {
          confirmed = c
        })
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    act(() => {
      result.current.resolveConfirmDialog(true)
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(confirmed).toBe(true)
    expect(result.current.confirmDialog).toBeNull()

    unmount()
  })

  // 6. SSR safety — requestSaveDecision resolves 'discard' without window
  it('requestSaveDecision immediately resolves "discard" in SSR environment', async () => {
    const { result, unmount } = renderHook()

    const originalWindow = globalThis.window
    // @ts-expect-error simulating SSR by removing window
    delete globalThis.window

    let choice: string | undefined
    await act(async () => {
      choice = await result.current.requestSaveDecision({ title: 'T', description: 'D' })
    })

    // Restore window before potential cleanup errors
    globalThis.window = originalWindow

    expect(choice).toBe('discard')
    // saveDecisionPrompt should remain null (no dialog was opened)
    expect(result.current.saveDecisionPrompt).toBeNull()

    unmount()
  })

  // 7. SSR safety — requestConfirmDialog resolves false without window
  it('requestConfirmDialog immediately resolves false in SSR environment', async () => {
    const { result, unmount } = renderHook()

    const originalWindow = globalThis.window
    // @ts-expect-error simulating SSR by removing window
    delete globalThis.window

    let confirmed: boolean | undefined
    await act(async () => {
      confirmed = await result.current.requestConfirmDialog({ title: 'T', description: 'D' })
    })

    globalThis.window = originalWindow

    expect(confirmed).toBe(false)
    expect(result.current.confirmDialog).toBeNull()

    unmount()
  })
})
