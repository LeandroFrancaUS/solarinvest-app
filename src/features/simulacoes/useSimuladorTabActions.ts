/**
 * useSimuladorTabActions.ts
 *
 * Owns tab-navigation action handlers extracted from App.tsx:
 *   - handleNavigateToProposalTab
 */

import { useCallback } from 'react'
import type React from 'react'
import type { TabKey } from '../../app/config'
import type { SaveDecisionPromptRequest } from '../../components/modals/SaveChangesDialog'

export interface UseSimuladorTabActionsParams {
  activeTabRef: React.MutableRefObject<string | null>
  runWithUnsavedChangesGuard: (action: () => void | Promise<void>, options?: Partial<SaveDecisionPromptRequest>) => Promise<boolean>
  iniciarNovaProposta: () => Promise<void>
  setActiveTab: React.Dispatch<React.SetStateAction<TabKey>>
}

export function useSimuladorTabActions({
  activeTabRef,
  runWithUnsavedChangesGuard,
  iniciarNovaProposta,
  setActiveTab,
}: UseSimuladorTabActionsParams) {
  const handleNavigateToProposalTab = useCallback(
    async (targetTab: 'leasing' | 'vendas') => {
      await runWithUnsavedChangesGuard(async () => {
        // Atualiza a ref ANTES de iniciarNovaProposta para que buildEmptySnapshotForNewProposal
        // use a aba correta ao construir o snapshot vazio inicial.
        activeTabRef.current = targetTab
        await iniciarNovaProposta()
        setActiveTab(targetTab)
      })
    },
    [runWithUnsavedChangesGuard, iniciarNovaProposta, setActiveTab, activeTabRef],
  )

  return {
    handleNavigateToProposalTab,
  }
}
