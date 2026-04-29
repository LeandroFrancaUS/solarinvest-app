// src/types/clientPortfolio.ts
// Type definitions for the Carteira de Clientes feature.

export interface PortfolioClientRow {
  id: number
  name: string | null
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

  is_converted_customer: boolean
  exported_to_portfolio_at: string | null
  exported_by_user_id: string | null

  lifecycle_id?: number | null
  lifecycle_status?: LifecycleStatus | null
  onboarding_status?: string | null
  is_active_portfolio_client?: boolean | null

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
  engineer_id?: number | null
  installer_id?: number | null
  art_number?: string | null
  art_issued_at?: string | null
  art_status?: string | null
  timeline_velocity_score?: number | null
  project_notes?: string | null

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

  installments_json?: InstallmentPayment[] | null

  potencia_modulo_wp?: number | null
  numero_modulos?: number | null
  modelo_modulo?: string | null
  modelo_inversor?: string | null
  tipo_instalacao?: string | null
  area_instalacao_m2?: number | null
  geracao_estimada_kwh?: number | null
  valordemercado?: number | null

  // NEW: WiFi monitoring status
  usina_wifi_status?: string | null

  contract_file_name?: string | null
  contract_file_url?: string | null
  contract_file_type?: string | null
  consultant_id?: string | null
  consultant_name?: string | null
  contract_attachments?: ContractAttachment[] | null

  kwh_mes_contratado?: number | null
  valor_mensalidade?: number | null

  commissioning_date_billing?: string | null
  inicio_da_mensalidade?: string | null
  inicio_mensalidade_fixa?: string | null
  is_contratante_titular?: boolean | null
}

// rest unchanged...
