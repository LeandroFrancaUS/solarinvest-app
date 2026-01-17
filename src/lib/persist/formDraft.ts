import { saveDraft, loadDraft, removeDraft, type DraftEnvelope } from './localDraft'

/**
 * Chave principal para o draft do formulário completo (cliente + proposta)
 */
const FORM_DRAFT_KEY = 'solarinvest-form-draft'

/**
 * Versão do schema do draft (incrementar se houver breaking changes)
 */
const DRAFT_VERSION = 1

/**
 * Salva o snapshot completo do formulário (cliente + proposta) usando IndexedDB
 * 
 * @param snapshotData - Snapshot completo obtido via getCurrentSnapshot()
 * @returns Promise com o envelope salvo
 */
export async function saveFormDraft<T>(snapshotData: T): Promise<DraftEnvelope<T>> {
  try {
    console.log('[formDraft] Saving complete form snapshot to IndexedDB')
    const envelope = await saveDraft(FORM_DRAFT_KEY, snapshotData, DRAFT_VERSION)
    console.log('[formDraft] Form snapshot saved successfully:', {
      version: envelope.version,
      updatedAt: new Date(envelope.updatedAt).toISOString(),
      hasData: !!envelope.data,
      dataKeys: envelope.data ? Object.keys(envelope.data as object).length : 0,
    })
    
    // READ-AFTER-WRITE VERIFICATION: Immediately read back to verify
    try {
      const verification = await loadDraft<T>(FORM_DRAFT_KEY)
      if (!verification || !verification.data) {
        console.error('[formDraft] READ-AFTER-WRITE FAILED: Data not found after save!')
        return envelope
      }
      
      const verifyData = verification.data as unknown as Record<string, unknown>
      const clienteData = verifyData.cliente as Record<string, unknown> | undefined
      console.log('[formDraft] READ-AFTER-WRITE VERIFICATION SUCCESS:', {
        hasCliente: !!clienteData,
        clienteNome: clienteData?.nome,
        clienteEndereco: clienteData?.endereco,
        clienteCidade: clienteData?.cidade,
        kcKwhMes: verifyData.kcKwhMes,
        tarifaCheia: verifyData.tarifaCheia,
        totalFields: Object.keys(verifyData).length,
      })
    } catch (verifyError) {
      console.error('[formDraft] READ-AFTER-WRITE verification failed:', verifyError)
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
    console.log('[formDraft] Loading form snapshot from IndexedDB')
    const envelope = await loadDraft<T>(FORM_DRAFT_KEY)
    
    if (!envelope) {
      console.log('[formDraft] No saved form snapshot found')
      return null
    }
    
    const FIELD_NAME_LIMIT = 20
    const loadedData = envelope.data as unknown as Record<string, unknown>
    console.log('[formDraft] Form snapshot loaded successfully:', {
      version: envelope.version,
      updatedAt: new Date(envelope.updatedAt).toISOString(),
      hasData: !!envelope.data,
      dataKeys: envelope.data ? Object.keys(envelope.data as object).length : 0,
    })
    
    // Detailed verification of critical fields
    if (loadedData) {
      const clienteData = loadedData.cliente as Record<string, unknown> | undefined
      console.log('[formDraft] LOADED DATA DETAILS:', {
        hasCliente: !!clienteData,
        clienteNome: clienteData?.nome || '(empty)',
        clienteEndereco: clienteData?.endereco || '(empty)',
        clienteCidade: clienteData?.cidade || '(empty)',
        clienteDocumento: clienteData?.documento || '(empty)',
        kcKwhMes: loadedData.kcKwhMes,
        tarifaCheia: loadedData.tarifaCheia,
        potenciaModulo: loadedData.potenciaModulo,
        numeroModulosManual: loadedData.numeroModulosManual,
        totalFields: Object.keys(loadedData).length,
        allFieldNames: Object.keys(loadedData).slice(0, FIELD_NAME_LIMIT).join(', ') + '...',
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
    console.log('[formDraft] Removing form snapshot from IndexedDB')
    await removeDraft(FORM_DRAFT_KEY)
    console.log('[formDraft] Form snapshot removed successfully')
  } catch (error) {
    console.error('[formDraft] Failed to remove form snapshot:', error)
    throw error
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
