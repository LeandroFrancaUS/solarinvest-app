import type { DashboardAlert, DashboardInvoice, DashboardOperationalTask } from '../../types/dashboard'

export function buildAlertsFromInvoices(invoices: DashboardInvoice[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = []

  for (const inv of invoices) {
    if (inv.status === 'OVERDUE') {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24),
      )
      alerts.push({
        id: `invoice-overdue-${inv.id}`,
        severity: daysOverdue > 30 ? 'critical' : 'warning',
        title: `Fatura vencida — ${inv.clientName}`,
        description: `R$ ${inv.amount.toFixed(2)} vencida há ${daysOverdue} dia(s).`,
        entityType: 'invoice',
        entityId: inv.id,
        recommendedAction: 'Acionar cobrança ou verificar acordo de parcelamento.',
        actionLabel: 'Registrar Cobrança',
        actionKey: 'collection',
      })
    }

    if (inv.status === 'DUE_SOON') {
      alerts.push({
        id: `invoice-due-soon-${inv.id}`,
        severity: 'info',
        title: `Fatura a vencer — ${inv.clientName}`,
        description: `R$ ${inv.amount.toFixed(2)} vence em breve.`,
        entityType: 'invoice',
        entityId: inv.id,
        recommendedAction: 'Enviar lembrete de pagamento ao cliente.',
        actionLabel: 'Enviar Lembrete',
        actionKey: 'reminder',
      })
    }
  }

  return alerts
}

export function buildAlertsFromTasks(tasks: DashboardOperationalTask[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = []

  for (const task of tasks) {
    if (task.status === 'BLOCKED') {
      alerts.push({
        id: `task-blocked-${task.id}`,
        severity: task.priority === 'CRITICAL' ? 'critical' : 'warning',
        title: `Tarefa bloqueada — ${task.title}`,
        description: task.blockedReason ?? 'Tarefa bloqueada sem motivo registrado.',
        entityType: 'task',
        entityId: task.id,
        recommendedAction: 'Resolver o impedimento para retomar o andamento.',
        actionLabel: 'Resolver Bloqueio',
        actionKey: 'resolve-block',
      })
    }

    if (task.status === 'RESCHEDULE_REQUIRED') {
      alerts.push({
        id: `task-reschedule-${task.id}`,
        severity: 'warning',
        title: `Reagendamento necessário — ${task.title}`,
        description: `Cliente: ${task.clientName}.`,
        entityType: 'task',
        entityId: task.id,
        recommendedAction: 'Contatar o cliente e definir nova data.',
        actionLabel: 'Reagendar',
        actionKey: 'reschedule',
      })
    }

    if (
      task.priority === 'CRITICAL' &&
      task.status !== 'DONE' &&
      task.status !== 'CANCELLED'
    ) {
      const alreadyAdded = alerts.some((a) => a.entityId === task.id)
      if (!alreadyAdded) {
        alerts.push({
          id: `task-critical-${task.id}`,
          severity: 'critical',
          title: `Tarefa crítica pendente — ${task.title}`,
          description: `Status atual: ${task.status}.`,
          entityType: 'task',
          entityId: task.id,
          recommendedAction: 'Priorizar execução imediata.',
          actionLabel: 'Ver Detalhes',
          actionKey: 'view',
        })
      }
    }
  }

  return alerts
}

export function mergeAndDeduplicateAlerts(
  ...groups: DashboardAlert[][]
): DashboardAlert[] {
  const seen = new Set<string>()
  const result: DashboardAlert[] = []
  for (const group of groups) {
    for (const alert of group) {
      if (!seen.has(alert.id)) {
        seen.add(alert.id)
        result.push(alert)
      }
    }
  }
  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  return result.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
}
