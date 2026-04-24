// Operational dashboard: displays KPIs, alerts, and task sections for
// kit deliveries, installations, tech support, and invoices.

import { useCallback, useEffect, useState } from 'react'
import {
  AlertsPanel,
  InvoicesSection,
  InstallationSection,
  KitDeliverySection,
  NotificationPreferencesModal,
  OperationalKpiCards,
  TechSupportSection,
} from '../components/dashboard/index.js'
import {
  fetchKpiSummary,
  fetchTasks,
  updateTask,
  type KpiSummary,
} from '../services/operationalDashboardApi.js'
import {
  buildAlertsFromInvoices,
  buildAlertsFromTasks,
  mergeAndDeduplicateAlerts,
} from '../lib/dashboard/alerts.js'
import { loadPreferences, savePreferences } from '../lib/notifications/preferences.js'
import { playNotificationSound } from '../lib/notifications/sound.js'
import type {
  DashboardAlert,
  DashboardInvoice,
  DashboardNotificationPreference,
  DashboardOperationalTask,
} from '../types/dashboard.js'

export function OperationalDashboardPage() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null)
  const [tasks, setTasks] = useState<DashboardOperationalTask[]>([])
  const [invoices] = useState<DashboardInvoice[]>([])
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefs, setPrefs] = useState<DashboardNotificationPreference>(loadPreferences)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiData, tasksData] = await Promise.all([
        fetchKpiSummary(),
        fetchTasks(),
      ])
      setKpi(kpiData)
      setTasks(tasksData)

      const newAlerts = mergeAndDeduplicateAlerts(
        buildAlertsFromInvoices(invoices),
        buildAlertsFromTasks(tasksData),
      )
      setAlerts(newAlerts)

      if (prefs.soundEnabled && newAlerts.some((a) => a.severity === 'critical')) {
        playNotificationSound('alert')
      }
    } catch (err) {
      console.error('[OperationalDashboardPage] loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [invoices, prefs.soundEnabled])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleUpdateStatus = useCallback(
    async (task: DashboardOperationalTask, newStatus: DashboardOperationalTask['status']) => {
      try {
        const updated = await updateTask(task.id, { status: newStatus })
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      } catch (err) {
        console.error('[OperationalDashboardPage] updateTask error:', err)
      }
    },
    [],
  )

  const handleAlertAction = useCallback((alert: DashboardAlert) => {
    console.info('[OperationalDashboardPage] Alert action:', alert.actionKey, alert.entityId)
  }, [])

  const handleSavePrefs = useCallback((newPrefs: DashboardNotificationPreference) => {
    setPrefs(newPrefs)
    savePreferences(newPrefs)
  }, [])

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Operacional</h1>
        <button
          onClick={() => setPrefsOpen(true)}
          className="text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg px-3 py-1.5"
        >
          🔔 Notificações
        </button>
      </div>

      <OperationalKpiCards kpi={kpi} loading={loading} />

      {alerts.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-2">Alertas</h2>
          <AlertsPanel alerts={alerts} onAction={handleAlertAction} />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Faturas</h2>
          <InvoicesSection invoices={invoices} loading={loading} />
        </section>

        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Entregas de Kit</h2>
          <KitDeliverySection tasks={tasks} loading={loading} onUpdateStatus={handleUpdateStatus} />
        </section>

        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Instalações</h2>
          <InstallationSection tasks={tasks} loading={loading} onUpdateStatus={handleUpdateStatus} />
        </section>

        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Suporte Técnico</h2>
          <TechSupportSection tasks={tasks} loading={loading} onUpdateStatus={handleUpdateStatus} />
        </section>
      </div>

      <NotificationPreferencesModal
        open={prefsOpen}
        preferences={prefs}
        onSave={handleSavePrefs}
        onClose={() => setPrefsOpen(false)}
      />
    </div>
  )
}
