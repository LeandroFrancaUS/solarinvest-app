// src/lib/dashboard/__tests__/alerts.test.ts
// Tests for the operational dashboard alerts engine.

import { describe, it, expect } from 'vitest'
import { computeAlerts, sortAlertsBySeverity, computeSeverityCounts } from '../alerts.js'
import type { DashboardInvoice, DashboardOperationalTask } from '../../../types/operationalDashboard.js'

describe('computeAlerts', () => {
  it('detects overdue invoices', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const invoices: DashboardInvoice[] = [
      {
        id: '1',
        clientName: 'Cliente Teste',
        amount: 1000,
        dueDate: yesterday.toISOString(),
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      },
    ]

    const alerts = computeAlerts(invoices, [])

    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('INVOICE_OVERDUE')
    expect(alerts[0].severity).toBe('WARNING')
    expect(alerts[0].title).toContain('vencida')
  })

  it('detects invoices due soon', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const invoices: DashboardInvoice[] = [
      {
        id: '2',
        clientName: 'Cliente Teste',
        amount: 500,
        dueDate: tomorrow.toISOString(),
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      },
    ]

    const alerts = computeAlerts(invoices, [])

    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('INVOICE_DUE_SOON')
    expect(alerts[0].title).toContain('vence')
  })

  it('detects tasks not scheduled', () => {
    const tasks: DashboardOperationalTask[] = [
      {
        id: '1',
        type: 'KIT_DELIVERY',
        title: 'Entregar kit',
        clientName: 'Cliente Teste',
        status: 'NOT_SCHEDULED',
        priority: 'HIGH',
        updatedAt: new Date().toISOString(),
      },
    ]

    const alerts = computeAlerts([], tasks)

    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('DELIVERY_NOT_SCHEDULED')
    expect(alerts[0].severity).toBe('ERROR')
  })

  it('detects critical support tasks', () => {
    const tasks: DashboardOperationalTask[] = [
      {
        id: '2',
        type: 'TECH_SUPPORT',
        title: 'Suporte urgente',
        clientName: 'Cliente Teste',
        status: 'SCHEDULED',
        priority: 'CRITICAL',
        updatedAt: new Date().toISOString(),
      },
    ]

    const alerts = computeAlerts([], tasks)

    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('SUPPORT_CRITICAL')
    expect(alerts[0].severity).toBe('CRITICAL')
  })

  it('detects blocked tasks', () => {
    const tasks: DashboardOperationalTask[] = [
      {
        id: '3',
        type: 'INSTALLATION',
        title: 'Instalação bloqueada',
        clientName: 'Cliente Teste',
        status: 'BLOCKED',
        blockedReason: 'Falta de documentação',
        priority: 'HIGH',
        updatedAt: new Date().toISOString(),
      },
    ]

    const alerts = computeAlerts([], tasks)

    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('TASK_BLOCKED')
    expect(alerts[0].severity).toBe('CRITICAL')
    expect(alerts[0].description).toContain('documentação')
  })

  it('filters alerts by preferences', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const invoices: DashboardInvoice[] = [
      {
        id: '1',
        clientName: 'Cliente 1',
        amount: 1000,
        dueDate: yesterday.toISOString(),
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      },
    ]

    const tasks: DashboardOperationalTask[] = [
      {
        id: '1',
        type: 'TECH_SUPPORT',
        title: 'Suporte crítico',
        clientName: 'Cliente 2',
        status: 'SCHEDULED',
        priority: 'CRITICAL',
        updatedAt: new Date().toISOString(),
      },
    ]

    // Filter: only critical
    const alerts = computeAlerts(invoices, tasks, { criticalOnly: true, visualEnabled: false, soundEnabled: false, pushEnabled: false, overdueInvoices: false, dueSoonInvoices: false, kitDeliveryUpdates: false, installationUpdates: false, supportUpdates: false })

    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('CRITICAL')
  })
})

describe('sortAlertsBySeverity', () => {
  it('sorts alerts by severity then by date', () => {
    const alerts = [
      {
        id: '1',
        type: 'INVOICE_OVERDUE' as const,
        severity: 'WARNING' as const,
        title: 'Warning',
        description: '',
        entityType: 'invoice' as const,
        entityId: '1',
        entityName: 'Test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'SUPPORT_CRITICAL' as const,
        severity: 'CRITICAL' as const,
        title: 'Critical',
        description: '',
        entityType: 'task' as const,
        entityId: '2',
        entityName: 'Test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        type: 'TASK_BLOCKED' as const,
        severity: 'ERROR' as const,
        title: 'Error',
        description: '',
        entityType: 'task' as const,
        entityId: '3',
        entityName: 'Test',
        createdAt: new Date().toISOString(),
      },
    ]

    const sorted = sortAlertsBySeverity(alerts)

    expect(sorted[0].severity).toBe('CRITICAL')
    expect(sorted[1].severity).toBe('ERROR')
    expect(sorted[2].severity).toBe('WARNING')
  })
})

describe('computeSeverityCounts', () => {
  it('counts alerts by severity', () => {
    const alerts = [
      {
        id: '1',
        type: 'INVOICE_OVERDUE' as const,
        severity: 'WARNING' as const,
        title: '',
        description: '',
        entityType: 'invoice' as const,
        entityId: '1',
        entityName: 'Test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'SUPPORT_CRITICAL' as const,
        severity: 'CRITICAL' as const,
        title: '',
        description: '',
        entityType: 'task' as const,
        entityId: '2',
        entityName: 'Test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        type: 'TASK_BLOCKED' as const,
        severity: 'CRITICAL' as const,
        title: '',
        description: '',
        entityType: 'task' as const,
        entityId: '3',
        entityName: 'Test',
        createdAt: new Date().toISOString(),
      },
    ]

    const counts = computeSeverityCounts(alerts)

    expect(counts.CRITICAL).toBe(2)
    expect(counts.WARNING).toBe(1)
    expect(counts.ERROR).toBe(0)
    expect(counts.INFO).toBe(0)
  })
})
