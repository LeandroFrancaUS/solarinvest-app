import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../services/operationalDashboardApi', () => ({
  fetchKpiSummary: vi.fn().mockResolvedValue({
    active_tasks: 5,
    blocked_tasks: 1,
    critical_tasks: 2,
    completed_tasks: 10,
    pending_deliveries: 3,
    pending_installations: 2,
    open_support_tickets: 1,
  }),
  fetchTasks: vi.fn().mockResolvedValue([]),
  updateTask: vi.fn(),
}))

vi.mock('../../lib/notifications/preferences', () => ({
  loadPreferences: vi.fn().mockReturnValue({
    visualEnabled: true,
    soundEnabled: false,
    pushEnabled: false,
    overdueInvoices: true,
    dueSoonInvoices: true,
    kitDeliveryUpdates: true,
    installationUpdates: true,
    supportUpdates: true,
    criticalOnly: false,
  }),
  savePreferences: vi.fn(),
}))

vi.mock('../../lib/notifications/sound', () => ({
  playNotificationSound: vi.fn(),
}))

import { OperationalDashboardPage } from '../OperationalDashboardPage'

describe('OperationalDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    render(<OperationalDashboardPage />)
    expect(screen.getByText('Dashboard Operacional')).toBeInTheDocument()
  })

  it('shows the notification preferences button', () => {
    render(<OperationalDashboardPage />)
    expect(screen.getByText(/Notificações/)).toBeInTheDocument()
  })
})
