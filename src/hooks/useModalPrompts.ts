// src/hooks/useModalPrompts.ts
//
// Extracted from App.tsx. Encapsulates the modal-prompt pair used throughout
// the proposal workflow:
//
//   • saveDecisionPrompt / requestSaveDecision / resolveSaveDecisionPrompt
//     — imperative promise-based API for the "save or discard?" dialog.
//
//   • confirmDialog / requestConfirmDialog / resolveConfirmDialog
//     — imperative promise-based API for the generic confirm dialog.
//
// Zero behavioural change — exact same logic as the original App.tsx blocks.

import { useCallback, useState } from 'react'
import type {
  SaveDecisionChoice,
  SaveDecisionPromptRequest,
  SaveDecisionPromptState,
} from '../components/modals/SaveChangesDialog'
import type { ConfirmDialogState } from '../components/modals/ConfirmDialog'

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseModalPromptsResult {
  // Save-decision prompt
  saveDecisionPrompt: SaveDecisionPromptState | null
  requestSaveDecision: (options: SaveDecisionPromptRequest) => Promise<SaveDecisionChoice>
  resolveSaveDecisionPrompt: (choice: SaveDecisionChoice) => void
  // Confirm dialog
  confirmDialog: ConfirmDialogState | null
  requestConfirmDialog: (options: Omit<ConfirmDialogState, 'resolve'>) => Promise<boolean>
  resolveConfirmDialog: (confirmed: boolean) => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useModalPrompts(): UseModalPromptsResult {
  // ── Save-decision prompt ────────────────────────────────────────────────────
  const [saveDecisionPrompt, setSaveDecisionPrompt] =
    useState<SaveDecisionPromptState | null>(null)

  const requestSaveDecision = useCallback(
    (options: SaveDecisionPromptRequest): Promise<SaveDecisionChoice> => {
      if (typeof window === 'undefined') {
        return Promise.resolve('discard')
      }

      return new Promise<SaveDecisionChoice>((resolve) => {
        setSaveDecisionPrompt({
          ...options,
          resolve,
        })
      })
    },
    [],
  )

  const resolveSaveDecisionPrompt = useCallback((choice: SaveDecisionChoice) => {
    setSaveDecisionPrompt((current) => {
      if (current) {
        current.resolve(choice)
      }

      return null
    })
  }, [])

  // ── Confirm dialog ──────────────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const requestConfirmDialog = useCallback(
    (options: Omit<ConfirmDialogState, 'resolve'>): Promise<boolean> => {
      if (typeof window === 'undefined') {
        return Promise.resolve(false)
      }

      return new Promise<boolean>((resolve) => {
        setConfirmDialog({ ...options, resolve })
      })
    },
    [],
  )

  const resolveConfirmDialog = useCallback((confirmed: boolean) => {
    setConfirmDialog((current) => {
      if (current) {
        current.resolve(confirmed)
      }

      return null
    })
  }, [])

  return {
    saveDecisionPrompt,
    requestSaveDecision,
    resolveSaveDecisionPrompt,
    confirmDialog,
    requestConfirmDialog,
    resolveConfirmDialog,
  }
}
