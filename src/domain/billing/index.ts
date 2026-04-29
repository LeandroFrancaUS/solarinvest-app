// src/domain/billing/index.ts
export {
  buildInstallmentDueDate,
  calculateBillingDates,
  generateInstallments,
  getBillingAlert,
  BILLING_ALERT_LABELS,
  type MonthlyEngineInput,
  type MonthlyEngineOutput,
  type GenerateInstallmentsInput,
  type Installment,
  type BillingAlert,
  type BillingAlertLevel,
} from './monthlyEngine'

export {
  generateNotificationsForClient,
  sendNotification,
  filterByChannel,
  filterByLevel,
  type NotificationChannel,
  type NotificationStatus,
  type BillingNotification,
} from './BillingNotificationService'
