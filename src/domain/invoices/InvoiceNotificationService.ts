// src/domain/invoices/InvoiceNotificationService.ts
// Service for generating invoice due date notifications

import type { ClientInvoice, InvoiceNotificationAlert } from '../../types/clientPortfolio'

export interface NotificationConfig {
  days_before_due: number[]
  notify_on_due_date: boolean
  days_after_due: number[]
}

const DEFAULT_CONFIG: NotificationConfig = {
  days_before_due: [7, 3, 1],
  notify_on_due_date: true,
  days_after_due: [1, 3, 5, 7],
}

/**
 * Calculate days until due date
 */
function calculateDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Determine alert type based on days until due
 */
function getAlertType(daysUntilDue: number): 'a_vencer' | 'vence_hoje' | 'vencida' {
  if (daysUntilDue < 0) return 'vencida'
  if (daysUntilDue === 0) return 'vence_hoje'
  return 'a_vencer'
}

/**
 * Generate notifications for invoices based on configuration
 */
export function generateInvoiceNotifications(
  invoices: ClientInvoice[],
  config: NotificationConfig = DEFAULT_CONFIG,
): InvoiceNotificationAlert[] {
  const alerts: InvoiceNotificationAlert[] = []

  for (const invoice of invoices) {
    // Skip already paid invoices
    if (invoice.payment_status === 'pago' || invoice.payment_status === 'confirmado') {
      continue
    }

    const daysUntilDue = calculateDaysUntilDue(invoice.due_date)
    const alertType = getAlertType(daysUntilDue)

    // Check if this invoice should trigger a notification
    let shouldNotify = false

    if (alertType === 'vencida') {
      // Check if we should notify for this many days overdue
      const daysOverdue = Math.abs(daysUntilDue)
      shouldNotify = config.days_after_due.includes(daysOverdue)
    } else if (alertType === 'vence_hoje') {
      shouldNotify = config.notify_on_due_date
    } else {
      // a_vencer
      shouldNotify = config.days_before_due.includes(daysUntilDue)
    }

    if (shouldNotify) {
      alerts.push({
        invoice,
        daysUntilDue,
        alertType,
      })
    }
  }

  // Sort by urgency: vencida first, then vence_hoje, then a_vencer (closest first)
  alerts.sort((a, b) => {
    const priorityOrder = { vencida: 0, vence_hoje: 1, a_vencer: 2 }
    const priorityDiff = priorityOrder[a.alertType] - priorityOrder[b.alertType]
    if (priorityDiff !== 0) return priorityDiff

    // Within same priority, sort by days (most urgent first)
    if (a.alertType === 'vencida' || a.alertType === 'a_vencer') {
      return a.daysUntilDue - b.daysUntilDue
    }
    return 0
  })

  return alerts
}

/**
 * Play notification sound (simple beep)
 */
export function playNotificationSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  } catch (err) {
    console.warn('Failed to play notification sound:', err)
  }
}

/**
 * Show browser notification (if permission granted)
 */
export async function showBrowserNotification(
  title: string,
  body: string,
  options?: NotificationOptions,
): Promise<void> {
  if (!('Notification' in window)) {
    return
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { ...options, body })
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      new Notification(title, { ...options, body })
    }
  }
}
