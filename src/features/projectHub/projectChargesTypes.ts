// src/features/projectHub/projectChargesTypes.ts
// TypeScript types for the project monthly charges domain.
// Mirrors the server-side row shape returned by /api/projects/:id/charges.

export type ChargeStatus = 'prevista' | 'emitida' | 'paga' | 'vencida' | 'cancelada'

export interface ProjectMonthlyCharge {
  id: string
  project_id: string
  client_id: number | null
  installment_num: number
  reference_month: string   // "YYYY-MM-01"
  due_date: string          // "YYYY-MM-DD"
  valor_previsto: number | null
  valor_cobrado: number | null
  valor_pago: number | null
  status: ChargeStatus
  paid_at: string | null
  receipt_number: string | null
  confirmed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GenerateChargesPayload {
  startDate: string     // "YYYY-MM-DD"
  months: number
  valorMensalidade: number
  dueDay: number
}

export interface UpdateChargePayload {
  status?: ChargeStatus
  valor_pago?: number
  paid_at?: string | null
  receipt_number?: string | null
  confirmed_by?: string | null
  notes?: string | null
}
