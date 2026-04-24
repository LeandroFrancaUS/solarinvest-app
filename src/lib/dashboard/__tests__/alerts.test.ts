import { describe, it, expect } from 'vitest'
import { buildAlertsFromInvoices, buildAlertsFromTasks, mergeAndDeduplicateAlerts } from '../alerts'
import type { DashboardInvoice, DashboardOperationalTask } from '../../../types/dashboard'

const overdueInvoice: DashboardInvoice = {
  id: 'inv-1',
  clientName: 'Cliente Teste',
  amount: 1500,
  dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'OVERDUE',
  updatedAt: new Date().toISOString(),
}

const dueSoonInvoice: DashboardInvoice = {
  id: 'inv-2',
  clientName: 'Cliente B',
  amount: 800,
  dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'DUE_SOON',
  updatedAt: new Date().toISOString(),
}

const blockedTask: DashboardOperationalTask = {
  id: 'task-1',
  type: 'INSTALLATION',
  title: 'Instalação Bloqueada',
  clientName: 'Cliente C',
  status: 'BLOCKED',
  priority: 'HIGH',
  blockedReason: 'Aguardando aprovação da concessionária',
  updatedAt: new Date().toISOString(),
}

describe('buildAlertsFromInvoices', () => {
  it('returns overdue alert for overdue invoice', () => {
    const alerts = buildAlertsFromInvoices([overdueInvoice])
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('warning')
    expect(alerts[0].entityId).toBe('inv-1')
  })

  it('returns info alert for due-soon invoice', () => {
    const alerts = buildAlertsFromInvoices([dueSoonInvoice])
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('info')
  })

  it('returns empty array for paid invoices', () => {
    const paid: DashboardInvoice = { ...overdueInvoice, status: 'PAID' }
    expect(buildAlertsFromInvoices([paid])).toHaveLength(0)
  })
})

describe('buildAlertsFromTasks', () => {
  it('returns warning alert for blocked task', () => {
    const alerts = buildAlertsFromTasks([blockedTask])
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('warning')
    expect(alerts[0].entityId).toBe('task-1')
  })

  it('returns critical alert for critical blocked task', () => {
    const critical = { ...blockedTask, priority: 'CRITICAL' as const }
    const alerts = buildAlertsFromTasks([critical])
    expect(alerts[0].severity).toBe('critical')
  })
})

describe('mergeAndDeduplicateAlerts', () => {
  it('deduplicates alerts with same id', () => {
    const a1 = buildAlertsFromInvoices([overdueInvoice])
    const merged = mergeAndDeduplicateAlerts(a1, a1)
    expect(merged).toHaveLength(1)
  })

  it('sorts critical before warning before info', () => {
    const inv = buildAlertsFromInvoices([overdueInvoice, dueSoonInvoice])
    const task = buildAlertsFromTasks([{ ...blockedTask, priority: 'CRITICAL' as const }])
    const merged = mergeAndDeduplicateAlerts(inv, task)
    expect(merged[0].severity).toBe('critical')
  })
})
