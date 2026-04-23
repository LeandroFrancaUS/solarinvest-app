// src/types/clientPortfolio.ts
// Type definitions for the Carteira de Clientes feature.

export interface PortfolioClientRow {
  id: number
  name: string | null
  /** Raw metadata JSONB from clients table. Used internally by auto-fill to read/write `autoFilled` flag. */
  metadata?: Record<string, unknown> | null
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
  uc_beneficiarias?: string[] | null
  owner_user_id: string | null
  created_by_user_id: string | null
  client_created_at: string
  client_updated_at?: string | null

  // Portfolio lifecycle — sourced from clients.in_portfolio / clients.portfolio_exported_at.
  is_converted_customer: boolean
  exported_to_portfolio_at: string | null
  exported_by_user_id: string | null

  // Optional: from client_lifecycle (may be absent when table not provisioned)
  lifecycle_id?: number | null
  lifecycle_status?: LifecycleStatus | null
  onboarding_status?: string | null
  is_active_portfolio_client?: boolean | null

  // Optional: from client_energy_profile (may be absent when table not provisioned)
  energy_profile_id?: number | null
  modalidade?: string | null
  tarifa_atual?: number | null
  desconto_percentual?: number | null
  mensalidade?: number | null
  prazo_meses?: number | null
  kwh_contratado?: number | null
  potencia_kwp?: number | null
  tipo_rede?: string | null
  marca_inversor?: string | null
  indicacao?: string | null

  // Optional: from client_project_status (may be absent when table not provisioned)
  project_id?: number | null
  project_status?: ProjectStatus | null
  installation_status?: string | null
  engineering_status?: string | null
  homologation_status?: string | null
  commissioning_status?: string | null
  commissioning_date?: string | null
  first_injection_date?: string | null
  first_generation_date?: string | null
  expected_go_live_date?: string | null
  integrator_name?: string | null
  engineer_name?: string | null
  /** FK to engineers.id (migration 0040) */
  engineer_id?: number | null
  /** FK to installers.id (migration 0040) */
  installer_id?: number | null
  /** ART number for this project (migration 0040) */
  art_number?: string | null
  /** Date the ART was issued (migration 0040) */
  art_issued_at?: string | null
  /** ART status (migration 0040) */
  art_status?: string | null
  timeline_velocity_score?: number | null
  project_notes?: string | null

  // Optional: from client_contracts (may be absent when table not provisioned)
  contract_id?: number | null
  contract_type?: ContractType | null
  contract_status?: ContractStatus | null
  source_proposal_id?: string | null
  source_proposal_record_id?: string | null
  source_proposal_code?: string | null
  source_proposal_client_name?: string | null
  source_proposal_created_at?: string | null
  source_proposal_type?: string | null
  source_proposal_preview_url?: string | null
  source_proposal_download_url?: string | null
  contract_signed_at?: string | null
  contract_start_date?: string | null
  billing_start_date?: string | null
  expected_billing_end_date?: string | null
  contractual_term_months?: number | null
  buyout_eligible?: boolean | null
  buyout_status?: string | null
  buyout_date?: string | null
  buyout_amount_reference?: number | null
  contract_notes?: string | null

  // Optional: from client_billing_profile (may be absent when table not provisioned)
  billing_id?: number | null
  due_day?: number | null
  reading_day?: number | null
  first_billing_date?: string | null
  expected_last_billing_date?: string | null
  recurrence_type?: string | null
  billing_payment_status?: BillingPaymentStatus | null
  delinquency_status?: string | null
  collection_stage?: string | null
  auto_reminder_enabled?: boolean | null

  // ── Installment-level payment tracking ──
  installments_json?: InstallmentPayment[] | null

  // ── Usina fotovoltaica (UF configuration) ──
  potencia_modulo_wp?: number | null
  numero_modulos?: number | null
  modelo_modulo?: string | null
  modelo_inversor?: string | null
  tipo_instalacao?: string | null
  area_instalacao_m2?: number | null
  /**
   * Monthly generation estimate in kWh/month (sourced from client_usina_config.geracao_estimada_kwh).
   * The DB column name omits "_mes" but the value is always monthly, not annual.
   */
  geracao_estimada_kwh?: number | null
  /** Valor atual de mercado do sistema fotovoltaico (sourced from client_usina_config.valordemercado) */
  valordemercado?: number | null

  // ── Contract extensions ──
  contract_file_name?: string | null
  contract_file_url?: string | null
  contract_file_type?: string | null
  consultant_id?: string | null
  consultant_name?: string | null
  /** Multiple contract attachments (migration 0037). null when column not yet available. */
  contract_attachments?: ContractAttachment[] | null

  // ── Leasing plan ──
  kwh_mes_contratado?: number | null
  valor_mensalidade?: number | null

  // ── Billing extensions ──
  commissioning_date_billing?: string | null
  inicio_da_mensalidade?: string | null
  inicio_mensalidade_fixa?: string | null
}

// LifecycleStatus includes 'lead' for backward compatibility when a client
// record exists but has not yet been explicitly exported to the portfolio.
// In practice, the portfolio only lists clients with is_converted_customer = true.
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

export type ContractStatus = 'draft' | 'active' | 'signed' | 'suspended' | 'completed' | 'cancelled'

export type BillingPaymentStatus = 'pending' | 'current' | 'overdue' | 'written_off' | 'cancelled'

/** Per-installment payment record stored in client_billing_profile.installments_json */
export interface InstallmentPayment {
  number: number
  status: 'pendente' | 'pago' | 'confirmado'
  paid_at: string | null
  receipt_number: string | null
  transaction_number: string | null
  attachment_url: string | null
  confirmed_by: string | null
}

/** Single contract attachment record stored inside contract_attachments_json */
export interface ContractAttachment {
  id: string
  fileName: string
  mimeType?: string | null
  sizeBytes?: number | null
  url?: string | null
  storageKey?: string | null
  uploadedAt?: string | null
  category?: string | null
  origin?: string | null
}

export interface ClientNote {
  id: number
  client_id: number
  entry_type: 'note' | 'observation' | 'alert' | 'milestone'
  title: string | null
  content: string
  created_by_user_id: string | null
  created_by_name: string | null
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

/** Pre-defined due-day options for the dropdown. */
export const DUE_DAY_OPTIONS = [5, 10, 15, 25, 30] as const

export type NotificationStatusType = 'a_vencer' | 'vence_hoje' | 'vencida' | 'paga'

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatusType, string> = {
  a_vencer: 'A Vencer',
  vence_hoje: 'Vence Hoje',
  vencida: 'Vencida',
  paga: 'Paga',
}
