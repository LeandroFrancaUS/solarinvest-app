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

export interface DashboardInvoice {
  id: string
  clientId?: string
  clientName: string
  proposalId?: string
  amount: number
  paidAmount?: number
  dueDate: string
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
  scheduledFor?: string | null
  completedAt?: string | null
  blockedReason?: string | null
  responsibleUserId?: string
  priority: TaskPriority
  notes?: string
  updatedAt: string
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
}

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface DashboardAlert {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  entityType: 'invoice' | 'task' | 'client'
  entityId: string
  recommendedAction: string
  actionLabel: string
  actionKey: string
}

export type QuickFilter = 'today' | 'week' | 'month' | 'overdue' | 'critical' | 'all'
