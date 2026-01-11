import { resolveApiUrl } from '../utils/apiUrl'

/**
 * Classe centralizada para chamadas à API
 */
class ApiClient {
  private baseUrl: string
  private getAuthToken: (() => string | null) | null = null

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }

  /**
   * Define função para obter token de autenticação
   * @param getToken - Função que retorna o token JWT
   */
  setAuthTokenGetter(getToken: () => string | null) {
    this.getAuthToken = getToken
  }

  /**
   * Resolve URL completa para a API
   * @param path - Caminho da API (ex: /api/clients)
   * @returns URL completa
   */
  private resolveUrl(path: string): string {
    return resolveApiUrl(path)
  }

  /**
   * Prepara headers para requisição
   * @param customHeaders - Headers customizados
   * @returns Headers completos com autenticação se disponível
   */
  private prepareHeaders(customHeaders: HeadersInit = {}): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders
    }

    // Adiciona token de autenticação se disponível
    if (this.getAuthToken) {
      const token = this.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    return headers
  }

  /**
   * Trata erros de resposta da API
   * @param response - Resposta da fetch
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      // Token inválido ou expirado - redirecionar para login
      if (typeof window !== 'undefined') {
        // Pode disparar evento para o componente de autenticação
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
      throw new Error('Não autorizado. Faça login novamente.')
    }

    if (!response.ok) {
      let errorMessage = `Erro ${response.status}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch {
        // Ignora erro ao parsear JSON de erro
      }
      throw new Error(errorMessage)
    }

    // No content response
    if (response.status === 204) {
      return null as T
    }

    return response.json()
  }

  /**
   * GET request
   * @param path - Caminho da API
   * @param params - Query parameters
   */
  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(this.resolveUrl(path), window.location.origin)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value))
      })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.prepareHeaders(),
      credentials: 'include'
    })

    return this.handleResponse<T>(response)
  }

  /**
   * POST request
   * @param path - Caminho da API
   * @param data - Dados a enviar
   */
  async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await fetch(this.resolveUrl(path), {
      method: 'POST',
      headers: this.prepareHeaders(),
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    })

    return this.handleResponse<T>(response)
  }

  /**
   * PUT request
   * @param path - Caminho da API
   * @param data - Dados a enviar
   */
  async put<T>(path: string, data?: unknown): Promise<T> {
    const response = await fetch(this.resolveUrl(path), {
      method: 'PUT',
      headers: this.prepareHeaders(),
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    })

    return this.handleResponse<T>(response)
  }

  /**
   * DELETE request
   * @param path - Caminho da API
   * @param data - Optional data to send in request body
   */
  async delete<T>(path: string, data?: unknown): Promise<T> {
    const response = await fetch(this.resolveUrl(path), {
      method: 'DELETE',
      headers: this.prepareHeaders(),
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    })

    return this.handleResponse<T>(response)
  }
}

// Instância singleton do cliente
export const apiClient = new ApiClient()

export default apiClient
