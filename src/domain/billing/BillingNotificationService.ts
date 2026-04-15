// src/domain/billing/BillingNotificationService.ts
// Notification engine for billing events.
// Supports email, WhatsApp, and push notification channels.
// Statuses: a_vencer, vence_hoje, vencida, paga.

import { getBillingAlert, type BillingAlertLevel, type Installment } from './monthlyEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'whatsapp' | 'push'

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface BillingNotification {
  id: string
  clientId: number
  clientName: string
  installmentNumber: number
  channel: NotificationChannel
  level: BillingAlertLevel
  message: string
  status: NotificationStatus
  createdAt: Date
  sentAt: Date | null
}

export interface NotificationTemplate {
  subject: string
  body: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES: Record<BillingAlertLevel, NotificationTemplate> = {
  a_vencer: {
    subject: 'SolarInvest — Sua mensalidade vence em breve',
    body: 'Olá {clientName}, sua mensalidade #{installment} no valor de R$ {amount} vence em {dueDate}. Efetue o pagamento para evitar atrasos.',
  },
  vence_hoje: {
    subject: 'SolarInvest — Mensalidade vence hoje',
    body: 'Olá {clientName}, sua mensalidade #{installment} no valor de R$ {amount} vence hoje ({dueDate}). Por favor efetue o pagamento.',
  },
  vencida: {
    subject: 'SolarInvest — Mensalidade em atraso',
    body: 'Olá {clientName}, sua mensalidade #{installment} no valor de R$ {amount} venceu em {dueDate}. Regularize o pagamento o mais breve possível.',
  },
  paga: {
    subject: 'SolarInvest — Pagamento confirmado',
    body: 'Olá {clientName}, confirmamos o recebimento da mensalidade #{installment} no valor de R$ {amount}. Obrigado!',
  },
  ok: {
    subject: '',
    body: '',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

function formatAmount(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

function renderTemplate(
  template: NotificationTemplate,
  vars: { clientName: string; installment: number; amount: number; dueDate: Date },
): NotificationTemplate {
  const replacements: Record<string, string> = {
    '{clientName}': vars.clientName,
    '{installment}': String(vars.installment),
    '{amount}': formatAmount(vars.amount),
    '{dueDate}': formatDate(vars.dueDate),
  }

  let subject = template.subject
  let body = template.body

  for (const [key, value] of Object.entries(replacements)) {
    subject = subject.split(key).join(value)
    body = body.split(key).join(value)
  }

  return { subject, body }
}

let notificationIdCounter = 0

function generateId(): string {
  notificationIdCounter++
  return `notif-${Date.now()}-${notificationIdCounter}`
}

/**
 * Generate notifications for a list of installments belonging to a client.
 * Only generates notifications for installments with actionable statuses
 * (a_vencer, vence_hoje, vencida).
 */
export function generateNotificationsForClient(
  clientId: number,
  clientName: string,
  installments: Installment[],
  channels: NotificationChannel[] = ['email', 'whatsapp'],
): BillingNotification[] {
  const notifications: BillingNotification[] = []

  for (const installment of installments) {
    const isPaid = installment.status === 'paga'
    const alert = getBillingAlert(installment.data_vencimento, isPaid)

    // Only generate for actionable levels
    if (alert.level === 'ok') continue

    const template = TEMPLATES[alert.level]
    if (!template.subject) continue

    const rendered = renderTemplate(template, {
      clientName,
      installment: installment.numero,
      amount: installment.valor,
      dueDate: installment.data_vencimento,
    })

    for (const channel of channels) {
      notifications.push({
        id: generateId(),
        clientId,
        clientName,
        installmentNumber: installment.numero,
        channel,
        level: alert.level,
        message: rendered.body,
        status: 'pending',
        createdAt: new Date(),
        sentAt: null,
      })
    }
  }

  return notifications
}

/**
 * Placeholder for sending notifications.
 * In production, this would integrate with email APIs, WhatsApp Business API,
 * and push notification services.
 */
export function sendNotification(
  notification: BillingNotification,
): BillingNotification {
  // Currently a stub — mark as sent for local tracking.
  // Real implementation would call:
  // - email: SendGrid, SES, etc.
  // - whatsapp: WhatsApp Business API
  // - push: Firebase Cloud Messaging, Web Push API
  return {
    ...notification,
    status: 'sent',
    sentAt: new Date(),
  }
}

/**
 * Filter notifications by channel.
 */
export function filterByChannel(
  notifications: BillingNotification[],
  channel: NotificationChannel,
): BillingNotification[] {
  return notifications.filter((n) => n.channel === channel)
}

/**
 * Filter notifications by alert level.
 */
export function filterByLevel(
  notifications: BillingNotification[],
  level: BillingAlertLevel,
): BillingNotification[] {
  return notifications.filter((n) => n.level === level)
}
