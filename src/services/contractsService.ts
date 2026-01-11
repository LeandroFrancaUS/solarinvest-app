import apiClient from '../lib/apiClient'

export interface Contract {
  id: string
  user_id: string
  client_id?: number
  client_name?: string
  uf: string
  template_key: string
  status: string
  contract_type?: string
  file_url?: string
  file_path?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ContractGenerateInput {
  clientId?: number
  uf: string
  templateKey: string
  contractType?: string
  metadata?: Record<string, unknown>
}

export interface ContractGenerateResponse {
  success: boolean
  contract: Contract
  message: string
}

export interface ContractsListResponse {
  contracts: Contract[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
}

export interface ContractsListParams {
  page?: number
  perPage?: number
}

/**
 * Service para gerenciar contratos via API
 */
export const contractsService = {
  /**
   * Gerar e salvar registro de contrato
   * @param data - Dados para geração do contrato
   */
  async generate(data: ContractGenerateInput): Promise<ContractGenerateResponse> {
    return apiClient.post<ContractGenerateResponse>('/api/contracts/generate', data)
  },

  /**
   * Listar contratos
   * @param params - Parâmetros de paginação
   */
  async list(params?: ContractsListParams): Promise<ContractsListResponse> {
    const queryParams: Record<string, string | number> = {}
    
    if (params?.page) queryParams.page = params.page
    if (params?.perPage) queryParams.perPage = params.perPage

    return apiClient.get<ContractsListResponse>('/api/contracts', queryParams)
  },

  /**
   * Obter contrato específico
   * @param id - ID do contrato
   */
  async get(id: string): Promise<Contract> {
    return apiClient.get<Contract>(`/api/contracts/${id}`)
  },

  /**
   * Atualizar status do contrato
   * @param id - ID do contrato
   * @param status - Novo status
   */
  async updateStatus(id: string, status: string): Promise<Contract> {
    return apiClient.put<Contract>(`/api/contracts/${id}/status`, { status })
  }
}

export default contractsService
