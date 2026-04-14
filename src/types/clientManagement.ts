// src/types/clientManagement.ts
// TypeScript interfaces for the Gestão de Clientes V2 feature.

export type LifecycleStatus =
  | 'lead'
  | 'negotiating'
  | 'contracted'
  | 'active'
  | 'suspended'
  | 'cancelled'
  | 'completed'

export type ContractType = 'leasing' | 'sale'
export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'signed'
  | 'active'
  | 'suspended'
  | 'cancelled'
  | 'completed'

export type BuyoutStatus =
  | 'not_eligible'
  | 'eligible'
  | 'requested'
  | 'negotiating'
  | 'completed'

export type ProjectStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
export type InstallationStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed'
export type EngineeringStatus = 'pending' | 'in_progress' | 'approved' | 'rejected'
export type HomologationStatus = 'pending' | 'submitted' | 'approved' | 'rejected'

export type PaymentStatus = 'pending' | 'up_to_date' | 'overdue' | 'partially_paid' | 'suspended'
export type DelinquencyStatus = 'none' | 'warning' | 'delinquent' | 'collection'
export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled'

export type NoteEntryType =
  | 'note'
  | 'call'
  | 'email'
  | 'visit'
  | 'status_change'
  | 'billing_event'
  | 'contract_event'
  | 'system'

export type ReminderType = 'general' | 'billing' | 'contract' | 'visit' | 'followup' | 'document' | 'system'
export type ReminderStatus = 'pending' | 'done' | 'dismissed' | 'overdue'

// ─── DB Row shapes ────────────────────────────────────────────────────────────

export interface ClientLifecycle {
  id: number
  client_id: number
  lifecycle_status: LifecycleStatus
  is_converted_customer: boolean
  converted_at: string | null
  converted_from_lead_at: string | null
  onboarding_status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  created_at: string
  updated_at: string
}

export interface ClientContract {
  id: number
  client_id: number
  contract_type: ContractType
  contract_status: ContractStatus
  contract_signed_at: string | null
  contract_start_date: string | null
  billing_start_date: string | null
  expected_billing_end_date: string | null
  contractual_term_months: number | null
  buyout_eligible: boolean
  buyout_status: BuyoutStatus
  buyout_date: string | null
  buyout_amount_reference: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientProjectStatus {
  id: number
  client_id: number
  project_status: ProjectStatus
  installation_status: InstallationStatus
  engineering_status: EngineeringStatus
  homologation_status: HomologationStatus
  commissioning_date: string | null
  first_injection_date: string | null
  first_generation_date: string | null
  expected_go_live_date: string | null
  integrator_name: string | null
  engineer_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientEnergyProfile {
  id: number
  client_id: number
  kwh_contratado: number | null
  potencia_kwp: number | null
  tipo_rede: string | null
  tarifa_atual: number | null
  desconto_percentual: number | null
  mensalidade: number | null
  indicacao: string | null
  modalidade: string | null
  prazo_meses: number | null
  created_at: string
  updated_at: string
}

export interface ClientBillingProfile {
  id: number
  client_id: number
  due_day: number | null
  reading_day: number | null
  first_billing_date: string | null
  expected_last_billing_date: string | null
  recurrence_type: 'monthly' | 'bimonthly' | 'quarterly'
  payment_status: PaymentStatus
  delinquency_status: DelinquencyStatus
  collection_stage: string | null
  auto_reminder_enabled: boolean
  created_at: string
  updated_at: string
}

export interface ClientBillingInstallment {
  id: number
  client_id: number
  contract_id: number | null
  installment_number: number
  competence_month: string | null
  due_date: string
  amount_due: number
  amount_paid: number
  paid_at: string | null
  payment_status: InstallmentStatus
  payment_method: string | null
  late_fee_amount: number
  interest_amount: number
  discount_amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientNote {
  id: number
  client_id: number
  entry_type: NoteEntryType
  title: string | null
  content: string
  created_by_user_id: string | null
  created_at: string
}

export interface ClientReminder {
  id: number
  client_id: number
  title: string
  reminder_type: ReminderType
  due_at: string
  status: ReminderStatus
  assigned_to_user_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Aggregated detail payload (GET /api/client-management/:id) ──────────────

export interface ClientBaseRow {
  id: number
  name: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  address: string | null
  uc: string | null
  distribuidora: string | null
  cpf_raw: string | null
  cnpj_raw: string | null
  document: string | null
  owner_user_id: string | null
  owner_display_name: string | null
  owner_email: string | null
  created_at: string
  updated_at: string
}

export interface ClientManagementDetail {
  client: ClientBaseRow
  lifecycle: ClientLifecycle | null
  contracts: ClientContract[]
  energy: ClientEnergyProfile | null
  project: ClientProjectStatus | null
  billing: ClientBillingProfile | null
}

// ─── List row (GET /api/client-management) ───────────────────────────────────

export interface ManagedClientListRow {
  id: number
  name: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  uc: string | null
  distribuidora: string | null
  lifecycle_status: LifecycleStatus
  is_converted_customer: boolean
  converted_at: string | null
  onboarding_status: string | null
  modalidade: string | null
  mensalidade: number | null
  potencia_kwp: number | null
  prazo_meses: number | null
  desconto_percentual: number | null
  project_status: ProjectStatus | null
  installation_status: InstallationStatus | null
  expected_go_live_date: string | null
  billing_payment_status: PaymentStatus | null
  delinquency_status: DelinquencyStatus | null
  due_day: number | null
  overdue_installments_count: number
  next_due_date: string | null
  owner_display_name: string | null
  created_at: string
  updated_at: string
}

export interface ManagedClientListResult {
  data: ManagedClientListRow[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ─── Dashboard portfolio types ────────────────────────────────────────────────

export interface PortfolioSummary {
  active_clients_count: number
  active_contracts_count: number
  projects_in_implantation: number
  clients_with_billing: number
  monthly_expected_revenue: number
  overdue_amount: number
  received_month_to_date: number
  contracted_clients: number
  active_lifecycle_clients: number
  buyout_eligible_count: number
  clients_with_alerts: number
}

export interface PortfolioUpcomingBilling {
  id: number
  client_id: number
  client_name: string
  due_date: string
  amount_due: number
  payment_status: InstallmentStatus
  competence_month: string | null
  installment_number: number
}

export interface PortfolioStatusBreakdownRow {
  lifecycle_status: LifecycleStatus
  modalidade: string | null
  project_status: ProjectStatus | null
  payment_status: PaymentStatus | null
  count: number
}

export interface PortfolioAlert {
  client_id: number
  client_name: string
  delinquency_status: DelinquencyStatus | null
  payment_status: PaymentStatus | null
  overdue_count: number
  oldest_overdue_date: string | null
  overdue_reminders_count: number
}

// ─── UI state types ───────────────────────────────────────────────────────────

export type ClientManagementTab =
  | 'overview'
  | 'contract'
  | 'energy'
  | 'project'
  | 'billing'
  | 'notes'
  | 'reminders'

export interface ClientManagementFilters {
  search: string
  lifecycleStatus: LifecycleStatus | ''
  modalidade: string
  page: number
}
