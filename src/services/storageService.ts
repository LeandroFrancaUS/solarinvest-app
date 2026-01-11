import apiClient from '../lib/apiClient'

export interface StorageEntry {
  key: string
  value: unknown
}

export interface StorageListResponse {
  entries: StorageEntry[]
}

/**
 * Service para gerenciar storage persistente via API
 */
export const storageService = {
  /**
   * Obter valor de uma chave específica
   * @param key - Chave do storage
   */
  async getKey(key: string): Promise<unknown> {
    const response = await apiClient.get<StorageListResponse>('/api/storage')
    const entry = response.entries.find(e => e.key === key)
    return entry?.value
  },

  /**
   * Obter todas as entradas do storage
   */
  async getAll(): Promise<StorageEntry[]> {
    const response = await apiClient.get<StorageListResponse>('/api/storage')
    return response.entries
  },

  /**
   * Salvar valor para uma chave
   * @param key - Chave do storage
   * @param value - Valor a salvar (será serializado como JSON)
   */
  async putKey(key: string, value: unknown): Promise<void> {
    await apiClient.put('/api/storage', { key, value })
  },

  /**
   * Deletar uma chave específica
   * @param key - Chave a deletar
   */
  async deleteKey(key: string): Promise<void> {
    await apiClient.delete('/api/storage', { key })
  },

  /**
   * Limpar todo o storage do usuário
   */
  async clear(): Promise<void> {
    await apiClient.delete('/api/storage')
  }
}

export default storageService
