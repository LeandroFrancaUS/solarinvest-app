import localforage from 'localforage'

localforage.config({
  name: 'solarinvest-app',
  storeName: 'drafts',
  description: 'Rascunhos do formulario (cliente + proposta)',
})

export type DraftEnvelope<T> = {
  version: number
  updatedAt: number
  data: T
}

export async function saveDraft<T>(key: string, data: T, version = 1): Promise<DraftEnvelope<T>> {
  const envelope: DraftEnvelope<T> = { version, updatedAt: Date.now(), data }
  await localforage.setItem(key, envelope)
  return envelope
}

export async function loadDraft<T>(key: string): Promise<DraftEnvelope<T> | null> {
  try {
    const envelope = await localforage.getItem<DraftEnvelope<T>>(key)
    return envelope
  } catch (error) {
    console.warn(`[localDraft] Failed to load draft "${key}":`, error)
    return null
  }
}

export async function removeDraft(key: string): Promise<void> {
  try {
    await localforage.removeItem(key)
  } catch (error) {
    console.warn(`[localDraft] Failed to remove draft "${key}":`, error)
  }
}

export async function listDraftKeys(): Promise<string[]> {
  try {
    return await localforage.keys()
  } catch (error) {
    console.warn('[localDraft] Failed to list draft keys:', error)
    return []
  }
}

export async function clearAllDrafts(): Promise<void> {
  try {
    await localforage.clear()
  } catch (error) {
    console.warn('[localDraft] Failed to clear all drafts:', error)
  }
}
