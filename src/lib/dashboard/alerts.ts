// src/lib/dashboard/alerts.ts
// Pure alert engine for operational dashboard.
// Analyzes invoices and tasks to generate actionable alerts.
// NO financial analytics, ROI, or investment indicators.

import type {
  DashboardInvoice,
  DashboardOperationalTask,
  DashboardAlert,
  DashboardNotificationPreference,
  AlertSeverity,
} from '../../types/operationalDashboard.js'

/**
 * Compute alerts from invoices and tasks.
 * Pure function with no side effects.
 */
export function computeAlerts(
  invoices: DashboardInvoice[],
  tasks: DashboardOperationalTask[],
  preferences?: DashboardNotificationPreference
): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const now = new Date()

  // ── Invoice alerts ──────────────────────────────────────────────────────

  for (const invoice of invoices) {
    const dueDate = new Date(invoice.dueDate)
    const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Overdue invoice
    if (daysDiff < 0 && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED') {
      const daysOverdue = Math.abs(daysDiff)
      alerts.push({
        id: `invoice-overdue-${invoice.id}`,
        type: 'INVOICE_OVERDUE',
        severity: daysOverdue > 7 ? 'CRITICAL' : daysOverdue > 3 ? 'ERROR' : 'WARNING',
        title: `Fatura vencida há ${daysOverdue} dias`,
        description: `Cliente ${invoice.clientName} — R$ ${invoice.amount.toFixed(2)} vencida em ${formatDateBR(invoice.dueDate)}`,
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.clientName,
        actionLabel: 'Cobrar cliente',
        actionUrl: `/operational-dashboard?invoice=${invoice.id}`,
        createdAt: now.toISOString(),
      })
    }

    // Due soon
    if (daysDiff >= 0 && daysDiff <= 3 && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED') {
      alerts.push({
        id: `invoice-due-soon-${invoice.id}`,
        type: 'INVOICE_DUE_SOON',
        severity: daysDiff === 0 ? 'ERROR' : 'WARNING',
        title: daysDiff === 0 ? 'Fatura vence hoje' : `Fatura vence em ${daysDiff} dias`,
        description: `Cliente ${invoice.clientName} — R$ ${invoice.amount.toFixed(2)}`,
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.clientName,
        actionLabel: 'Ver fatura',
        actionUrl: `/operational-dashboard?invoice=${invoice.id}`,
        createdAt: now.toISOString(),
      })
    }

    // Partially paid overdue
    if (
      invoice.status === 'PARTIALLY_PAID' &&
      daysDiff < 0 &&
      invoice.paidAmount != null &&
      invoice.paidAmount < invoice.amount
    ) {
      const remaining = invoice.amount - invoice.paidAmount
      alerts.push({
        id: `invoice-partial-overdue-${invoice.id}`,
        type: 'INVOICE_PARTIALLY_PAID_OVERDUE',
        severity: 'ERROR',
        title: 'Fatura parcialmente paga e vencida',
        description: `Cliente ${invoice.clientName} — Saldo R$ ${remaining.toFixed(2)}`,
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.clientName,
        actionLabel: 'Cobrar saldo',
        actionUrl: `/operational-dashboard?invoice=${invoice.id}`,
        createdAt: now.toISOString(),
      })
    }
  }

  // ── Task alerts ─────────────────────────────────────────────────────────

  for (const task of tasks) {
    // Delivery not scheduled
    if (
      task.type === 'KIT_DELIVERY' &&
      task.status === 'NOT_SCHEDULED' &&
      !task.scheduledFor
    ) {
      alerts.push({
        id: `task-delivery-not-scheduled-${task.id}`,
        type: 'DELIVERY_NOT_SCHEDULED',
        severity: task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'ERROR' : 'WARNING',
        title: 'Entrega de kit sem agendamento',
        description: `Cliente ${task.clientName} — ${task.title}`,
        entityType: 'task',
        entityId: task.id,
        entityName: task.clientName,
        actionLabel: 'Agendar entrega',
        actionUrl: `/operational-dashboard?task=${task.id}`,
        createdAt: now.toISOString(),
      })
    }

    // Installation not scheduled
    if (
      task.type === 'INSTALLATION' &&
      task.status === 'NOT_SCHEDULED' &&
      !task.scheduledFor
    ) {
      alerts.push({
        id: `task-installation-not-scheduled-${task.id}`,
        type: 'INSTALLATION_NOT_SCHEDULED',
        severity: task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'ERROR' : 'WARNING',
        title: 'Instalação sem agendamento',
        description: `Cliente ${task.clientName} — ${task.title}`,
        entityType: 'task',
        entityId: task.id,
        entityName: task.clientName,
        actionLabel: 'Agendar instalação',
        actionUrl: `/operational-dashboard?task=${task.id}`,
        createdAt: now.toISOString(),
      })
    }

    // Critical support
    if (
      task.type === 'TECH_SUPPORT' &&
      task.priority === 'CRITICAL' &&
      task.status !== 'DONE' &&
      task.status !== 'CANCELLED'
    ) {
      alerts.push({
        id: `task-support-critical-${task.id}`,
        type: 'SUPPORT_CRITICAL',
        severity: 'CRITICAL',
        title: 'Suporte técnico crítico pendente',
        description: `Cliente ${task.clientName} — ${task.title}`,
        entityType: 'task',
        entityId: task.id,
        entityName: task.clientName,
        actionLabel: 'Atender suporte',
        actionUrl: `/operational-dashboard?task=${task.id}`,
        createdAt: now.toISOString(),
      })
    }

    // Task blocked
    if (task.status === 'BLOCKED') {
      alerts.push({
        id: `task-blocked-${task.id}`,
        type: 'TASK_BLOCKED',
        severity: task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'CRITICAL' : 'ERROR',
        title: 'Tarefa bloqueada',
        description: `${task.clientName} — ${task.blockedReason || 'Motivo não especificado'}`,
        entityType: 'task',
        entityId: task.id,
        entityName: task.clientName,
        actionLabel: 'Desbloquear',
        actionUrl: `/operational-dashboard?task=${task.id}`,
        createdAt: now.toISOString(),
      })
    }

    // Reschedule required
    if (task.status === 'RESCHEDULE_REQUIRED') {
      alerts.push({
        id: `task-reschedule-${task.id}`,
        type: 'TASK_RESCHEDULE_REQUIRED',
        severity: 'WARNING',
        title: 'Reagendamento necessário',
        description: `Cliente ${task.clientName} — ${task.title}`,
        entityType: 'task',
        entityId: task.id,
        entityName: task.clientName,
        actionLabel: 'Reagendar',
        actionUrl: `/operational-dashboard?task=${task.id}`,
        createdAt: now.toISOString(),
      })
    }
  }

  // Filter alerts based on preferences
  if (preferences?.criticalOnly) {
    return alerts.filter((a) => a.severity === 'CRITICAL')
  }

  // Filter by notification type preferences
  if (preferences) {
    return alerts.filter((alert) => {
      if (!preferences.overdueInvoices && alert.type === 'INVOICE_OVERDUE') return false
      if (!preferences.dueSoonInvoices && alert.type === 'INVOICE_DUE_SOON') return false
      if (!preferences.kitDeliveryUpdates && alert.type === 'DELIVERY_NOT_SCHEDULED') return false
      if (!preferences.installationUpdates && alert.type === 'INSTALLATION_NOT_SCHEDULED') return false
      if (!preferences.supportUpdates && alert.type === 'SUPPORT_CRITICAL') return false
      return true
    })
  }

  return alerts
}

/**
 * Format ISO date to pt-BR format (DD/MM/YYYY)
 */
function formatDateBR(isoDate: string): string {
  const date = new Date(isoDate)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Compute severity counts for dashboard summary
 */
export function computeSeverityCounts(alerts: DashboardAlert[]): Record<AlertSeverity, number> {
  return alerts.reduce(
    (acc, alert) => {
      acc[alert.severity]++
      return acc
    },
    { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 } as Record<AlertSeverity, number>
  )
}

/**
 * Group alerts by entity type for rendering
 */
export function groupAlertsByEntity(alerts: DashboardAlert[]): Record<string, DashboardAlert[]> {
  return alerts.reduce(
    (acc, alert) => {
      if (!acc[alert.entityType]) {
        acc[alert.entityType] = []
      }
      acc[alert.entityType].push(alert)
      return acc
    },
    {} as Record<string, DashboardAlert[]>
  )
}

/**
 * Sort alerts by severity (critical first) and then by creation time
 */
export function sortAlertsBySeverity(alerts: DashboardAlert[]): DashboardAlert[] {
  const severityOrder: Record<AlertSeverity, number> = {
    CRITICAL: 0,
    ERROR: 1,
    WARNING: 2,
    INFO: 3,
  }

  return [...alerts].sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (severityDiff !== 0) return severityDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}
