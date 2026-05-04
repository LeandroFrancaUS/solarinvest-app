// src/domain/billing/__tests__/BillingNotificationService.test.ts
import { describe, it, expect } from 'vitest'
import {
  generateNotificationsForClient,
  sendNotification,
} from '../BillingNotificationService'
import type { Installment } from '../monthlyEngine'

function makeInstallment(overrides: Partial<Installment> = {}): Installment {
  return {
    numero: 1,
    data_vencimento: new Date('2025-06-15'),
    valor: 500,
    status: 'pendente',
    ...overrides,
  }
}

describe('generateNotificationsForClient', () => {
  it('generates email and whatsapp notifications for each installment', () => {
    const installments = [makeInstallment({ numero: 1 }), makeInstallment({ numero: 2 })]
    const notifications = generateNotificationsForClient(123, 'João', installments)

    // 2 installments × 2 channels = 4 notifications
    expect(notifications).toHaveLength(4)
    expect(notifications.filter((n) => n.channel === 'email')).toHaveLength(2)
    expect(notifications.filter((n) => n.channel === 'whatsapp')).toHaveLength(2)
  })

  it('includes correct client info', () => {
    const notifications = generateNotificationsForClient(42, 'Maria', [makeInstallment()])

    for (const n of notifications) {
      expect(n.clientId).toBe(42)
      expect(n.clientName).toBe('Maria')
    }
  })

  it('sets pending status by default', () => {
    const notifications = generateNotificationsForClient(1, 'Test', [makeInstallment()])
    for (const n of notifications) {
      expect(n.status).toBe('pending')
    }
  })

  it('returns empty array for empty installments', () => {
    const notifications = generateNotificationsForClient(1, 'Test', [])
    expect(notifications).toHaveLength(0)
  })

  it('includes billing alert level', () => {
    // Past due date → should be 'vencida'
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 10)
    const notifications = generateNotificationsForClient(1, 'Test', [
      makeInstallment({ data_vencimento: pastDate, numero: 1 }),
    ])

    for (const n of notifications) {
      expect(n.level).toBe('vencida')
    }
  })
})

describe('sendNotification', () => {
  it('marks notification as sent', () => {
    const notif = generateNotificationsForClient(1, 'Test', [makeInstallment()])[0]!
    const sent = sendNotification(notif)

    expect(sent.status).toBe('sent')
    expect(sent.sentAt).toBeInstanceOf(Date)
  })
})
