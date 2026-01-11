import apiClient from '../lib/apiClient'

export interface Client {
  id: number
  user_id: string
  name: string
  document?: string
  email?: string
  phone?: string
  city?: string
  state?: string
  address?: string
  uc?: string
  distribuidora?: string
  metadata?: Record<string, unknown>
  tipo?: string
  nome_razao?: string
  telefone_secundario?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  origem?: string
  observacoes?: string
  responsavel_id?: string
  created_at: string
  updated_at: string
}

export interface ClientCreateInput {
  name: string
  document?: string
  email?: string
  phone?: string
  city?: string
  state?: string
  address?: string
  uc?: string
  distribuidora?: string
  metadata?: Record<string, unknown>
  tipo?: string
  nome_razao?: string
  telefone_secundario?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  origem?: string
  observacoes?: string
}

export interface ClientUpdateInput extends Partial<ClientCreateInput> {}

export interface ClientsListResponse {
  clients: Client[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
}

export interface ClientsListParams {
  page?: number
  perPage?: number
  search?: string
}

/**
 * Service para gerenciar clientes via API
 */
export const clientsService = {
  /**
   * Listar clientes
   * @param params - Parâmetros de paginação e busca
   */
  async list(params?: ClientsListParams): Promise<ClientsListResponse> {
    const queryParams: Record<string, string | number> = {}
    
    if (params?.page) queryParams.page = params.page
    if (params?.perPage) queryParams.perPage = params.perPage
    if (params?.search) queryParams.search = params.search

    return apiClient.get<ClientsListResponse>('/api/clients', queryParams)
  },

  /**
   * Obter cliente específico
   * @param id - ID do cliente
   */
  async get(id: number | string): Promise<Client> {
    return apiClient.get<Client>(`/api/clients/${id}`)
  },

  /**
   * Criar novo cliente
   * @param data - Dados do cliente
   */
  async create(data: ClientCreateInput): Promise<Client> {
    return apiClient.post<Client>('/api/clients', data)
  },

  /**
   * Atualizar cliente
   * @param id - ID do cliente
   * @param data - Dados a atualizar
   */
  async update(id: number | string, data: ClientUpdateInput): Promise<Client> {
    return apiClient.put<Client>(`/api/clients/${id}`, data)
  },

  /**
   * Deletar cliente
   * @param id - ID do cliente
   */
  async delete(id: number | string): Promise<void> {
    return apiClient.delete(`/api/clients/${id}`)
  }
}

export default clientsService
