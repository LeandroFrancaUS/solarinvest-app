import { saveDraft, loadDraft, removeDraft, type DraftEnvelope } from './localDraft'

/**
 * Chave principal para o draft do formulário completo (cliente + proposta)
 */
const FORM_DRAFT_KEY = 'solarinvest-form-draft'

/**
 * Versão do schema do draft (incrementar se houver breaking changes)
 */
const DRAFT_VERSION = 1

const __DEV__ = import.meta.env.DEV

/**
 * Salva o snapshot completo do formulário (cliente + proposta) usando IndexedDB
 * 
 * @param snapshotData - Snapshot completo obtido via getCurrentSnapshot()
 * @returns Promise com o envelope salvo
 */
export async function saveFormDraft<T>(snapshotData: T): Promise<DraftEnvelope<T>> {
  try {
    // Check if snapshot is empty/null - treat as clear semantics
    if (!snapshotData || (typeof snapshotData === 'object' && Object.keys(snapshotData as object).length === 0)) {
      if (__DEV__) console.debug('[formDraft] Empty snapshot detected, clearing draft instead of saving')
      await clearFormDraft()
      // Return a dummy envelope to maintain API compatibility
      return {
        version: DRAFT_VERSION,
        updatedAt: new Date().toISOString(),
        data: snapshotData,
      } as DraftEnvelope<T>
    }
    
    const envelope = await saveDraft(FORM_DRAFT_KEY, snapshotData, DRAFT_VERSION)
    const hasData = !!envelope.data && Object.keys(envelope.data as object).length > 0
    
    if (__DEV__) {
      console.debug('[formDraft] Form snapshot saved:', {
        version: envelope.version,
        hasData,
        dataKeys: envelope.data ? Object.keys(envelope.data as object).length : 0,
      })
    }
    
    // READ-AFTER-WRITE VERIFICATION: Only verify if we saved meaningful data
    if (hasData) {
      try {
        const verification = await loadDraft<T>(FORM_DRAFT_KEY)
        if (!verification || !verification.data) {
          console.error('[formDraft] READ-AFTER-WRITE FAILED: Data not found after save!')
          return envelope
        }
        if (__DEV__) console.debug('[formDraft] READ-AFTER-WRITE VERIFICATION SUCCESS')
      } catch (verifyError) {
        console.error('[formDraft] READ-AFTER-WRITE verification failed:', verifyError)
      }
    }
    
    return envelope
  } catch (error) {
    console.error('[formDraft] Failed to save form snapshot:', error)
    throw error
  }
}

/**
 * Carrega o snapshot completo do formulário do IndexedDB
 * 
 * @returns Promise com o envelope do draft ou null se não existir
 */
export async function loadFormDraft<T>(): Promise<DraftEnvelope<T> | null> {
  try {
    const envelope = await loadDraft<T>(FORM_DRAFT_KEY)
    
    if (!envelope) {
      if (__DEV__) console.debug('[formDraft] No saved form snapshot found')
      return null
    }
    
    if (__DEV__) {
      console.debug('[formDraft] Form snapshot loaded:', {
        version: envelope.version,
        hasData: !!envelope.data,
        dataKeys: envelope.data ? Object.keys(envelope.data as object).length : 0,
      })
    }
    
    return envelope
  } catch (error) {
    console.error('[formDraft] Failed to load form snapshot:', error)
    return null
  }
}

/**
 * Remove o snapshot do formulário do IndexedDB
 */
export async function removeFormDraft(): Promise<void> {
  try {
    await removeDraft(FORM_DRAFT_KEY)
    if (__DEV__) console.debug('[formDraft] Form snapshot removed')
  } catch (error) {
    console.error('[formDraft] Failed to remove form snapshot:', error)
    throw error
  }
}

/**
 * Limpa o draft do formulário (alias para removeFormDraft com nome mais claro)
 */
export async function clearFormDraft(): Promise<void> {
  try {
    await removeDraft(FORM_DRAFT_KEY)
  } catch (e) {
    console.warn('[formDraft] Failed to clear draft:', e)
  }
}

/**
 * Verifica se existe um draft salvo
 */
export async function hasFormDraft(): Promise<boolean> {
  try {
    const envelope = await loadDraft(FORM_DRAFT_KEY)
    return envelope !== null
  } catch (error) {
    console.error('[formDraft] Failed to check if form draft exists:', error)
    return false
  }
}
