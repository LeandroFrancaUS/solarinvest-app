// src/types/operationalDashboard.ts
// Types for the operational dashboard focused on monitoring billing, payments, deliveries,
// installations, and technical support. NO financial analytics, ROI, or investment indicators.

export type InvoiceStatus =
  | 'PENDING'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'CANCELLED'
  | 'DISPUTED'

export type OperationalTaskStatus =
  | 'NOT_SCHEDULED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'CANCELLED'
  | 'RESCHEDULE_REQUIRED'

export type OperationalTaskType =
  | 'KIT_DELIVERY'
  | 'INSTALLATION'
  | 'TECH_SUPPORT'
  | 'DOCUMENTATION'
  | 'BILLING'
  | 'COLLECTION'
  | 'GRID_APPROVAL'
  | 'OTHER'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

export type AlertType =
  | 'INVOICE_OVERDUE'
  | 'INVOICE_DUE_SOON'
  | 'INVOICE_PARTIALLY_PAID_OVERDUE'
  | 'DELIVERY_NOT_SCHEDULED'
  | 'INSTALLATION_NOT_SCHEDULED'
  | 'SUPPORT_CRITICAL'
  | 'TASK_BLOCKED'
  | 'TASK_RESCHEDULE_REQUIRED'
  | 'CLIENT_NO_RESPONSIBLE'
  | 'PROPOSAL_NO_NEXT_STEP'

export interface DashboardInvoice {
  id: string
  clientId?: string
  clientName: string
  proposalId?: string
  amount: number
  paidAmount?: number
  dueDate: string // ISO date string
  paidAt?: string | null
  status: InvoiceStatus
  paymentMethod?: string
  boletoUrl?: string
  pixCode?: string
  notes?: string
  responsibleUserId?: string
  updatedAt: string
}

export interface DashboardOperationalTask {
  id: string
  type: OperationalTaskType
  title: string
  clientId?: string
  clientName: string
  proposalId?: string
  status: OperationalTaskStatus
  scheduledFor?: string | null // ISO datetime string
  completedAt?: string | null
  blockedReason?: string | null
  responsibleUserId?: string
  priority: TaskPriority
  notes?: string
  updatedAt: string
}

export interface DashboardAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  entityType: 'invoice' | 'task' | 'client' | 'proposal'
  entityId: string
  entityName: string
  actionLabel?: string
  actionUrl?: string
  createdAt: string
}

export interface DashboardNotificationPreference {
  visualEnabled: boolean
  soundEnabled: boolean
  pushEnabled: boolean
  overdueInvoices: boolean
  dueSoonInvoices: boolean
  kitDeliveryUpdates: boolean
  installationUpdates: boolean
  supportUpdates: boolean
  criticalOnly?: boolean
  quietHoursStart?: string // HH:mm format
  quietHoursEnd?: string // HH:mm format
}

export interface DashboardFilters {
  timeRange: 'today' | 'this_week' | 'this_month' | 'overdue' | 'critical'
  responsibleUserId?: string
  clientId?: string
  status?: string
}

export interface DashboardKPIs {
  openInvoices: number
  overdueInvoices: number
  dueSoonInvoices: number
  paymentsConfirmedToday: number
  scheduledDeliveries: number
  scheduledInstallations: number
  pendingSupport: number
  criticalPendencies: number
}

export interface DashboardSummary {
  kpis: DashboardKPIs
  invoices: DashboardInvoice[]
  tasks: DashboardOperationalTask[]
  alerts: DashboardAlert[]
}

// ── Activity log for audit trail ──
export interface DashboardActivityEvent {
  id: string
  entityType: 'invoice' | 'task'
  entityId: string
  action:
    | 'created'
    | 'updated'
    | 'status_changed'
    | 'payment_registered'
    | 'scheduled'
    | 'rescheduled'
    | 'completed'
    | 'blocked'
    | 'unblocked'
    | 'cancelled'
  performedBy: string
  performedByName?: string
  metadata?: Record<string, unknown>
  createdAt: string
}
