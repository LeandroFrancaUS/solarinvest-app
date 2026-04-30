// src/pages/OperationalDashboardPage.tsx
// Operational dashboard for monitoring billing, payments, deliveries, installations, and support.
// NO financial analytics, ROI, or investment indicators.

import React, { useCallback, useEffect, useState } from 'react'
import { formatMoneyBR } from '../lib/locale/br-number.js'
import { listOperationalTasks } from '../lib/api/operationalDashboardApi.js'
import { listInvoices } from '../services/invoicesApi.js'
import { computeAlerts, sortAlertsBySeverity } from '../lib/dashboard/alerts.js'
import { fetchPortfolioClients } from '../services/clientPortfolioApi.js'
import type {
  DashboardInvoice,
  DashboardOperationalTask,
  DashboardAlert,
  DashboardKPIs,
} from '../types/operationalDashboard.js'
import type { PortfolioClientRow } from '../types/clientPortfolio.js'

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

export function OperationalDashboardPage() {
  const [invoices, setInvoices] = useState<DashboardInvoice[]>([])
  const [tasks, setTasks] = useState<DashboardOperationalTask[]>([])
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioClientRow[]>([])
  const [loadState, setLoadState] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const [invoicesRes, tasksRes, portfolioRes] = await Promise.allSettled([
        listInvoices({ limit: 1000 }).catch(() => ({ data: [] })),
        listOperationalTasks({ limit: 1000 }).catch(() => ({ data: [] })),
        fetchPortfolioClients(),
      ])

      const invoicesData = invoicesRes.status === 'fulfilled' ? invoicesRes.value : { data: [] }
      const tasksData = tasksRes.status === 'fulfilled' ? tasksRes.value : { data: [] }
      const portfolioData = portfolioRes.status === 'fulfilled' ? portfolioRes.value : []

      // Map invoices to dashboard format
      const mappedInvoices: DashboardInvoice[] = (invoicesData.data || []).map((inv: any) => ({
        id: String(inv.id),
        clientId: inv.client_id ? String(inv.client_id) : undefined,
        clientName: inv.client_name || 'Cliente sem nome',
        amount: Number(inv.amount) || 0,
        paidAmount: inv.paid_amount ? Number(inv.paid_amount) : undefined,
        dueDate: inv.due_date,
        paidAt: inv.paid_at,
        status: mapInvoiceStatus(inv.payment_status),
        notes: inv.notes,
        updatedAt: inv.updated_at,
      }))

      // Map tasks to dashboard format
      const mappedTasks: DashboardOperationalTask[] = (tasksData.data || []).map((task: any) => ({
        id: String(task.id),
        type: task.type,
        title: task.title,
        clientId: task.client_id ? String(task.client_id) : undefined,
        clientName: task.client_name || 'Cliente sem nome',
        proposalId: task.proposal_id,
        status: task.status,
        scheduledFor: task.scheduled_for,
        completedAt: task.completed_at,
        blockedReason: task.blocked_reason,
        responsibleUserId: task.responsible_user_id,
        priority: task.priority,
        notes: task.notes,
        updatedAt: task.updated_at,
      }))

      setInvoices(mappedInvoices)
      setTasks(mappedTasks)
      setPortfolio(portfolioData)

      // Compute alerts
      const computedAlerts = computeAlerts(mappedInvoices, mappedTasks)
      setAlerts(sortAlertsBySeverity(computedAlerts))

      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Compute KPIs
  const kpis: DashboardKPIs = {
    openInvoices: invoices.filter((i) => ['PENDING', 'DUE_SOON', 'PARTIALLY_PAID'].includes(i.status)).length,
    overdueInvoices: invoices.filter((i) => i.status === 'OVERDUE').length,
    dueSoonInvoices: invoices.filter((i) => i.status === 'DUE_SOON').length,
    paymentsConfirmedToday: invoices.filter((i) => {
      if (!i.paidAt) return false
      const today = new Date().toISOString().split('T')[0]
      const paidDate = i.paidAt.split('T')[0]
      return paidDate === today
    }).length,
    scheduledDeliveries: tasks.filter((t) => t.type === 'KIT_DELIVERY' && t.status === 'SCHEDULED').length,
    scheduledInstallations: tasks.filter((t) => t.type === 'INSTALLATION' && t.status === 'SCHEDULED').length,
    pendingSupport: tasks.filter((t) => t.type === 'TECH_SUPPORT' && !['DONE', 'CANCELLED'].includes(t.status))
      .length,
    criticalPendencies: alerts.filter((a) => a.severity === 'CRITICAL').length,
  }

  const wifiKpis = {
    conectado: portfolio.filter((c) => c.wifi_status === 'conectado').length,
    desconectado: portfolio.filter((c) => c.wifi_status === 'desconectado').length,
    falha: portfolio.filter((c) => c.wifi_status === 'falha').length,
    naoInformado: portfolio.filter((c) => !c.wifi_status).length,
  }

  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm text-ds-text-muted">Carregando painel operacional…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ds-text-primary">Painel Operacional</h1>
          <p className="text-sm text-ds-text-muted">
            Cobranças, pagamentos, entregas, instalações e suporte em tempo real
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="cursor-pointer rounded-lg border border-ds-border px-3 py-1.5 text-xs text-ds-text-secondary transition-colors hover:border-ds-primary/50 hover:text-ds-primary"
        >
          ↻ Atualizar dados
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-ds-warning/30 bg-ds-warning/10 px-4 py-2 text-sm text-ds-warning">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Faturas em aberto" value={kpis.openInvoices} severity="info" />
        <KpiCard title="Faturas vencidas" value={kpis.overdueInvoices} severity="error" />
        <KpiCard title="Vencendo em até 3 dias" value={kpis.dueSoonInvoices} severity="warning" />
        <KpiCard title="Pagamentos hoje" value={kpis.paymentsConfirmedToday} severity="success" />
        <KpiCard title="Entregas agendadas" value={kpis.scheduledDeliveries} severity="info" />
        <KpiCard title="Instalações agendadas" value={kpis.scheduledInstallations} severity="info" />
        <KpiCard title="Suportes pendentes" value={kpis.pendingSupport} severity="warning" />
        <KpiCard title="Pendências críticas" value={kpis.criticalPendencies} severity="critical" />
      </div>

      {/* WiFi KPI Cards */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-ds-text-primary">📡 WiFi das Usinas</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard title="🟢 WiFi conectado" value={wifiKpis.conectado} severity="success" />
          <KpiCard title="🟡 WiFi desconectado" value={wifiKpis.desconectado} severity="warning" />
          <KpiCard title="🔴 WiFi com falha" value={wifiKpis.falha} severity="error" />
          <KpiCard title="⚪ WiFi não informado" value={wifiKpis.naoInformado} severity="info" />
        </div>
      </div>

      {/* Alerts Section */}
      <AlertsSection alerts={alerts} />

      {/* WiFi Monitoring Section */}
      <WifiMonitoringSection portfolio={portfolio} />

      {/* Invoices Section */}
      <InvoicesSection invoices={invoices} />

      {/* Tasks Section */}
      <TasksSection tasks={tasks} />
    </div>
  )
}

function mapInvoiceStatus(dbStatus: string): any {
  const now = new Date()
  // This is simplified - real implementation should check due dates
  switch (dbStatus) {
    case 'pago':
    case 'confirmado':
      return 'PAID'
    case 'vencida':
      return 'OVERDUE'
    case 'pendente':
    default:
      return 'PENDING'
  }
}

interface KpiCardProps {
  title: string
  value: number
  severity: 'info' | 'success' | 'warning' | 'error' | 'critical'
}

function KpiCard({ title, value, severity }: KpiCardProps) {
  const colors = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    success: 'border-green-200 bg-green-50 text-green-900',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    critical: 'border-red-300 bg-red-100 text-red-950',
  }

  return (
    <div className={`rounded-lg border p-4 ${colors[severity]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{title}</div>
    </div>
  )
}

interface AlertsSectionProps {
  alerts: DashboardAlert[]
}

function AlertsSection({ alerts }: AlertsSectionProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-ds-border bg-ds-panel p-6">
        <h2 className="mb-2 text-lg font-semibold text-ds-text-primary">Pendências e Alertas</h2>
        <p className="text-sm text-ds-text-muted">Nenhuma pendência no momento</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-ds-border bg-ds-panel p-6">
      <h2 className="mb-4 text-lg font-semibold text-ds-text-primary">
        Pendências e Alertas ({alerts.length})
      </h2>
      <div className="space-y-2">
        {alerts.slice(0, 10).map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  )
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  const severityColors = {
    INFO: 'border-blue-200 bg-blue-50 text-blue-900',
    WARNING: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    ERROR: 'border-red-200 bg-red-50 text-red-900',
    CRITICAL: 'border-red-300 bg-red-100 text-red-950',
  }

  return (
    <div className={`rounded border p-3 ${severityColors[alert.severity]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm font-semibold">{alert.title}</div>
          <div className="text-xs">{alert.description}</div>
        </div>
        {alert.actionLabel && (
          <button
            type="button"
            className="ml-2 text-xs font-medium underline"
            onClick={() => alert.actionUrl && (window.location.href = alert.actionUrl)}
          >
            {alert.actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

interface InvoicesSectionProps {
  invoices: DashboardInvoice[]
}

function InvoicesSection({ invoices }: InvoicesSectionProps) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = invoices.filter((inv) => {
    if (filter === 'all') return true
    if (filter === 'overdue') return inv.status === 'OVERDUE'
    if (filter === 'due_soon') return inv.status === 'DUE_SOON'
    if (filter === 'open') return ['PENDING', 'DUE_SOON', 'PARTIALLY_PAID'].includes(inv.status)
    return true
  })

  return (
    <div className="rounded-lg border border-ds-border bg-ds-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ds-text-primary">Cobranças e Pagamentos</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-ds-border px-2 py-1 text-sm"
        >
          <option value="all">Todas</option>
          <option value="open">Em aberto</option>
          <option value="overdue">Vencidas</option>
          <option value="due_soon">Vencendo em breve</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-ds-border">
            <tr className="text-left text-xs text-ds-text-muted">
              <th className="pb-2">Cliente</th>
              <th className="pb-2">Valor</th>
              <th className="pb-2">Vencimento</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 20).map((inv) => (
              <tr key={inv.id} className="border-b border-ds-border/50">
                <td className="py-2 text-ds-text-primary">{inv.clientName}</td>
                <td className="py-2">{formatMoneyBR(inv.amount)}</td>
                <td className="py-2">{formatDateBR(inv.dueDate)}</td>
                <td className="py-2">
                  <StatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface TasksSectionProps {
  tasks: DashboardOperationalTask[]
}

function TasksSection({ tasks }: TasksSectionProps) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = tasks.filter((task) => {
    if (filter === 'all') return true
    if (filter === 'delivery') return task.type === 'KIT_DELIVERY'
    if (filter === 'installation') return task.type === 'INSTALLATION'
    if (filter === 'support') return task.type === 'TECH_SUPPORT'
    return true
  })

  return (
    <div className="rounded-lg border border-ds-border bg-ds-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ds-text-primary">Tarefas Operacionais</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-ds-border px-2 py-1 text-sm"
        >
          <option value="all">Todas</option>
          <option value="delivery">Entregas</option>
          <option value="installation">Instalações</option>
          <option value="support">Suporte</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.slice(0, 15).map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-ds-text-muted">Nenhuma tarefa encontrada</p>
        )}
      </div>
    </div>
  )
}

function TaskItem({ task }: { task: DashboardOperationalTask }) {
  return (
    <div className="rounded border border-ds-border p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm font-semibold text-ds-text-primary">{task.title}</div>
          <div className="text-xs text-ds-text-muted">
            {task.clientName} • {getTaskTypeLabel(task.type)}
          </div>
        </div>
        <div className="ml-2 flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <TaskStatusBadge status={task.status} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PAID: 'bg-green-100 text-green-800',
    PENDING: 'bg-blue-100 text-blue-800',
    OVERDUE: 'bg-red-100 text-red-800',
    DUE_SOON: 'bg-yellow-100 text-yellow-800',
    PARTIALLY_PAID: 'bg-orange-100 text-orange-800',
  }

  const labels: Record<string, string> = {
    PAID: 'Pago',
    PENDING: 'Pendente',
    OVERDUE: 'Vencida',
    DUE_SOON: 'Vence em breve',
    PARTIALLY_PAID: 'Pagamento parcial',
  }

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  )
}

function TaskStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    NOT_SCHEDULED: 'bg-gray-100 text-gray-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    BLOCKED: 'bg-red-100 text-red-800',
    DONE: 'bg-green-100 text-green-800',
  }

  const labels: Record<string, string> = {
    NOT_SCHEDULED: 'Não agendada',
    SCHEDULED: 'Agendada',
    IN_PROGRESS: 'Em andamento',
    BLOCKED: 'Bloqueada',
    DONE: 'Concluída',
  }

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-600',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-800',
  }

  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${colors[priority] || 'bg-gray-100 text-gray-600'}`}>
      {priority}
    </span>
  )
}

function getTaskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    KIT_DELIVERY: 'Entrega de kit',
    INSTALLATION: 'Instalação',
    TECH_SUPPORT: 'Suporte técnico',
    DOCUMENTATION: 'Documentação',
    BILLING: 'Cobrança',
    COLLECTION: 'Cobrança',
    GRID_APPROVAL: 'Aprovação da rede',
    OTHER: 'Outro',
  }
  return labels[type] || type
}

function hasWifiIssue(c: PortfolioClientRow): boolean {
  return c.wifi_status === 'desconectado' || c.wifi_status === 'falha' || !c.wifi_status
}

function WifiMonitoringSection({ portfolio }: { portfolio: PortfolioClientRow[] }) {
  const alerts = portfolio.filter(hasWifiIssue)

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-ds-border bg-ds-panel p-6">
        <h2 className="mb-2 text-lg font-semibold text-ds-text-primary">Monitoramento de Usinas</h2>
        <p className="text-sm text-ds-text-muted">Todas as usinas com WiFi informado estão conectadas</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-ds-border bg-ds-panel p-6">
      <h2 className="mb-4 text-lg font-semibold text-ds-text-primary">
        Monitoramento de Usinas ({alerts.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-ds-border">
            <tr className="text-left text-xs text-ds-text-muted">
              <th className="pb-2">Cliente</th>
              <th className="pb-2">Cidade / UF</th>
              <th className="pb-2">Potência</th>
              <th className="pb-2">Status WiFi</th>
              <th className="pb-2">Ação sugerida</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((c) => (
              <WifiAlertRow key={c.id} client={c} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WifiAlertRow({ client }: { client: PortfolioClientRow }) {
  const kwp = client.system_kwp ?? client.potencia_kwp
  const location = [client.city, client.state].filter(Boolean).join(' / ') || '—'

  const { badge, action } = wifiStatusMeta(client.wifi_status ?? null)

  return (
    <tr className="border-b border-ds-border/50">
      <td className="py-2 font-medium text-ds-text-primary">{client.name ?? '—'}</td>
      <td className="py-2 text-ds-text-secondary">{location}</td>
      <td className="py-2 text-ds-text-secondary">{kwp != null ? `${kwp} kWp` : '—'}</td>
      <td className="py-2">{badge}</td>
      <td className="py-2 text-xs text-ds-text-muted">{action}</td>
    </tr>
  )
}

function wifiStatusMeta(status: 'conectado' | 'desconectado' | 'falha' | null): {
  badge: React.ReactNode
  action: string
} {
  if (status === 'falha') {
    return {
      badge: <span className="rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">🔴 Falha</span>,
      action: 'Verificar inversor e módulos — intervenção técnica recomendada',
    }
  }
  if (status === 'desconectado') {
    return {
      badge: <span className="rounded px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">🟡 Desconectado</span>,
      action: 'Verificar conectividade WiFi do inversor',
    }
  }
  return {
    badge: <span className="rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">⚪ Não informado</span>,
    action: 'Atualizar status WiFi na aba Usina do cliente',
  }
}

function formatDateBR(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
