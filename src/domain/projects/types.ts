// src/domain/projects/types.ts
// Pure domain types for the "Projeto" entity. No React, no side effects.
// Safe to consume from both the backend service and the frontend.

export type ProjectType = 'leasing' | 'venda'

export const PROJECT_TYPES: readonly ProjectType[] = ['leasing', 'venda'] as const

export type ProjectStatus = 'Aguardando' | 'Em andamento' | 'Concluído'

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'Aguardando',
  'Em andamento',
  'Concluído',
] as const

/** Input snapshot captured from the originating plan. */
export interface ProjectPlanSnapshot {
  client_id: number
  plan_id: string
  contract_id: number | null
  proposal_id: string | null
  contract_type: string | null
  client_name: string | null
  cpf_cnpj: string | null
  city: string | null
  state: string | null
}

export interface ProjectRow {
  id: string
  client_id: number
  plan_id: string
  contract_id: number | null
  proposal_id: string | null
  project_type: ProjectType
  status: ProjectStatus
  client_name_snapshot: string | null
  cpf_cnpj_snapshot: string | null
  city_snapshot: string | null
  state_snapshot: string | null
  created_at: string
  updated_at: string
  created_by_user_id: string | null
  updated_by_user_id: string | null
  deleted_at: string | null
}

export interface ProjectPvData {
  id: string
  project_id: string
  consumo_kwh_mes: number | null
  potencia_modulo_wp: number | null
  numero_modulos: number | null
  tipo_rede: string | null
  potencia_sistema_kwp: number | null
  geracao_estimada_kwh_mes: number | null
  area_utilizada_m2: number | null
  modelo_modulo: string | null
  modelo_inversor: string | null
  created_at: string
  updated_at: string
}

export interface ProjectListFilters {
  search?: string
  project_type?: ProjectType
  status?: ProjectStatus
  client_id?: number
  limit?: number
  offset?: number
  order_by?: 'updated_at' | 'created_at' | 'client_name'
  order_dir?: 'asc' | 'desc'
}

export interface ProjectSummary {
  total: number
  by_status: Record<ProjectStatus, number>
  by_type: Record<ProjectType, number>
}
