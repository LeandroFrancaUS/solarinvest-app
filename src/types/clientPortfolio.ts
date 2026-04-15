// src/types/clientPortfolio.ts
// Type definitions for the Carteira de Clientes feature.

export interface PortfolioClientRow {
  id: number
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  address?: string | null
  document: string | null
  document_type: string | null
  consumption_kwh_month: number | null
  system_kwp: number | null
  term_months: number | null
  distribuidora: string | null
  uc: string | null
  uc_beneficiaria: string | null
  owner_user_id: string | null
  created_by_user_id: string | null
  client_created_at: string
  client_updated_at?: string

  // Lifecycle
  lifecycle_id: number | null
  lifecycle_status: LifecycleStatus
  is_converted_customer: boolean
  exported_to_portfolio_at: string | null
  exported_by_user_id: string | null
  onboarding_status: string | null
  is_active_portfolio_client: boolean

  // Energy profile
  energy_profile_id?: number | null
  modalidade: string | null
  tarifa_atual: number | null
  desconto_percentual: number | null
  mensalidade: number | null
  prazo_meses: number | null
  kwh_contratado: number | null
  potencia_kwp: number | null
  tipo_rede: string | null
  marca_inversor: string | null
  indicacao?: string | null

  // Project status
  project_id?: number | null
  project_status: ProjectStatus | null
  installation_status: string | null
  engineering_status?: string | null
  homologation_status?: string | null
  commissioning_status?: string | null
  commissioning_date: string | null
  first_injection_date?: string | null
  first_generation_date?: string | null
  expected_go_live_date: string | null
  integrator_name?: string | null
  engineer_name?: string | null
  timeline_velocity_score: number | null
  project_notes?: string | null

  // Contract
  contract_id: number | null
  contract_type: ContractType | null
  contract_status: ContractStatus | null
  source_proposal_id?: string | null
  contract_signed_at: string | null
  contract_start_date?: string | null
  billing_start_date: string | null
  expected_billing_end_date?: string | null
  contractual_term_months: number | null
  buyout_eligible: boolean
  buyout_status: string | null
  buyout_date?: string | null
  buyout_amount_reference?: number | null
  contract_notes?: string | null

  // Billing
  billing_id?: number | null
  due_day: number | null
  reading_day?: number | null
  first_billing_date: string | null
  expected_last_billing_date?: string | null
  recurrence_type?: string | null
  billing_payment_status: BillingPaymentStatus | null
  delinquency_status: string | null
  collection_stage?: string | null
  auto_reminder_enabled?: boolean
}

export type LifecycleStatus =
  | 'lead'
  | 'contracted'
  | 'active'
  | 'implementation'
  | 'billing'
  | 'churned'
  | 'cancelled'

export type ProjectStatus =
  | 'pending'
  | 'engineering'
  | 'installation'
  | 'homologation'
  | 'commissioned'
  | 'active'
  | 'issue'

export type ContractType = 'leasing' | 'sale' | 'buyout'

export type ContractStatus = 'draft' | 'active' | 'suspended' | 'completed' | 'cancelled'

export type BillingPaymentStatus = 'pending' | 'current' | 'overdue' | 'written_off' | 'cancelled'

export interface ClientNote {
  id: number
  client_id: number
  entry_type: 'note' | 'observation' | 'alert' | 'milestone'
  title: string | null
  content: string
  created_by_user_id: string | null
  created_at: string
}

export interface PortfolioSummary {
  total_portfolio_clients: number
  active_clients: number
  clients_in_implementation: number
  clients_with_billing: number
  overdue_clients: number
  buyout_eligible_clients: number
  projected_monthly_revenue: number
  active_portfolio_clients: number
}

export const LIFECYCLE_STATUS_LABELS: Record<LifecycleStatus, string> = {
  lead: 'Lead',
  contracted: 'Contratado',
  active: 'Ativo',
  implementation: 'Em Implantação',
  billing: 'Em Cobrança',
  churned: 'Churn',
  cancelled: 'Cancelado',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: 'Pendente',
  engineering: 'Engenharia',
  installation: 'Instalação',
  homologation: 'Homologação',
  commissioned: 'Comissionado',
  active: 'Ativo',
  issue: 'Com Problema',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  leasing: 'Leasing',
  sale: 'Venda',
  buyout: 'Buy Out',
}

export const BILLING_STATUS_LABELS: Record<BillingPaymentStatus, string> = {
  pending: 'Pendente',
  current: 'Em Dia',
  overdue: 'Inadimplente',
  written_off: 'Baixado',
  cancelled: 'Cancelado',
}
