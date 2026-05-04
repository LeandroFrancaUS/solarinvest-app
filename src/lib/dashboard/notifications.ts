// src/lib/dashboard/notifications.ts
// Notification system for operational dashboard with visual, audio, and push support.

import type { DashboardAlert, AlertSeverity } from '../../types/operationalDashboard.js'

export type NotificationType = 'visual' | 'audio' | 'push'

export interface NotificationOptions {
  visualEnabled: boolean
  audioEnabled: boolean
  pushEnabled: boolean
  criticalOnly?: boolean
}

// ── Audio Notifications ──────────────────────────────────────────────────────

let audioContext: AudioContext | null = null
let audioEnabled = false

/**
 * Initialize audio context for sound notifications.
 * Must be called after user interaction due to browser autoplay policies.
 */
export function initializeAudio(): boolean {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    audioEnabled = true
    return true
  } catch (err) {
    console.warn('[notifications] Failed to initialize audio context:', err)
    return false
  }
}

/**
 * Play a sound notification based on alert severity.
 * Uses Web Audio API to generate tones.
 */
export function playNotificationSound(severity: AlertSeverity): void {
  if (!audioEnabled || !audioContext) {
    return
  }

  try {
    // Create oscillator for tone generation
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Configure tone based on severity
    const config = getAudioConfig(severity)
    oscillator.type = config.type
    oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime)

    // Envelope: fade in and fade out
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(config.volume, audioContext.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + config.duration)
  } catch (err) {
    console.warn('[notifications] Failed to play sound:', err)
  }
}

function getAudioConfig(severity: AlertSeverity): {
  type: OscillatorType
  frequency: number
  volume: number
  duration: number
} {
  switch (severity) {
    case 'CRITICAL':
      return { type: 'square', frequency: 880, volume: 0.3, duration: 0.3 }
    case 'ERROR':
      return { type: 'sine', frequency: 660, volume: 0.25, duration: 0.2 }
    case 'WARNING':
      return { type: 'sine', frequency: 440, volume: 0.2, duration: 0.15 }
    case 'INFO':
      return { type: 'sine', frequency: 330, volume: 0.15, duration: 0.1 }
  }
}

// ── Push Notifications ───────────────────────────────────────────────────────

let pushPermission: NotificationPermission = 'default'

/**
 * Check if push notifications are supported by the browser.
 */
export function isPushSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

/**
 * Request permission for push notifications.
 * Only call this when the user explicitly enables push in preferences.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    return 'denied'
  }

  try {
    pushPermission = await Notification.requestPermission()
    return pushPermission
  } catch (err) {
    console.warn('[notifications] Failed to request push permission:', err)
    return 'denied'
  }
}

/**
 * Get current push notification permission status.
 */
export function getPushPermission(): NotificationPermission {
  if (!isPushSupported()) {
    return 'denied'
  }
  return Notification.permission
}

/**
 * Send a push notification.
 * Respects user's notification permission.
 */
export function sendPushNotification(alert: DashboardAlert): void {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return
  }

  try {
    const notification = new Notification(alert.title, {
      body: alert.description,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: alert.id,
      requireInteraction: alert.severity === 'CRITICAL',
      silent: false,
    })

    // Auto-close after 10 seconds for non-critical alerts
    if (alert.severity !== 'CRITICAL') {
      setTimeout(() => notification.close(), 10000)
    }

    // Handle click to navigate
    notification.onclick = () => {
      window.focus()
      if (alert.actionUrl) {
        window.location.href = alert.actionUrl
      }
      notification.close()
    }
  } catch (err) {
    console.warn('[notifications] Failed to send push notification:', err)
  }
}

// ── Visual Notifications (Toast) ─────────────────────────────────────────────

export interface ToastNotification {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

type ToastListener = (toast: ToastNotification) => void

const toastListeners: Set<ToastListener> = new Set()

/**
 * Subscribe to toast notifications.
 * Returns unsubscribe function.
 */
export function onToast(listener: ToastListener): () => void {
  toastListeners.add(listener)
  return () => toastListeners.delete(listener)
}

/**
 * Show a toast notification.
 */
export function showToast(toast: ToastNotification): void {
  toastListeners.forEach((listener) => listener(toast))
}

/**
 * Show a toast from a dashboard alert.
 */
export function showToastFromAlert(alert: DashboardAlert): void {
  const duration = alert.severity === 'CRITICAL' ? undefined : 8000
  showToast({
    id: alert.id,
    title: alert.title,
    message: alert.description,
    severity: alert.severity,
    ...(duration !== undefined ? { duration } : undefined),
    ...(alert.actionLabel !== undefined ? { actionLabel: alert.actionLabel } : undefined),
    ...(alert.actionUrl !== undefined ? { onAction: () => { window.location.href = alert.actionUrl! } } : undefined),
  })
}

// ── Unified Notification Dispatcher ──────────────────────────────────────────

/**
 * Dispatch a notification through all enabled channels.
 */
export function dispatchNotification(
  alert: DashboardAlert,
  options: NotificationOptions
): void {
  // Check quiet hours
  if (!isWithinActiveHours()) {
    return
  }

  // Filter by critical-only preference
  if (options.criticalOnly && alert.severity !== 'CRITICAL') {
    return
  }

  // Dispatch to enabled channels
  if (options.visualEnabled) {
    showToastFromAlert(alert)
  }

  if (options.audioEnabled) {
    playNotificationSound(alert.severity)
  }

  if (options.pushEnabled && Notification.permission === 'granted') {
    sendPushNotification(alert)
  }
}

/**
 * Check if current time is within active notification hours.
 * For now, always returns true. Implement quiet hours logic if needed.
 */
function isWithinActiveHours(): boolean {
  // TODO: Implement quiet hours check based on user preferences
  return true
}

/**
 * Batch dispatch multiple alerts with rate limiting.
 * Prevents notification spam when many alerts are generated at once.
 */
export function batchDispatchNotifications(
  alerts: DashboardAlert[],
  options: NotificationOptions,
  maxPerBatch = 5
): void {
  // Sort by severity
  const sortedAlerts = [...alerts].sort((a, b) => {
    const order: Record<AlertSeverity, number> = {
      CRITICAL: 0,
      ERROR: 1,
      WARNING: 2,
      INFO: 3,
    }
    return order[a.severity] - order[b.severity]
  })

  // Take top N alerts
  const topAlerts = sortedAlerts.slice(0, maxPerBatch)

  // Dispatch with staggered timing to avoid overwhelming the user
  topAlerts.forEach((alert, index) => {
    setTimeout(() => {
      dispatchNotification(alert, options)
    }, index * 500) // 500ms between each notification
  })
}
