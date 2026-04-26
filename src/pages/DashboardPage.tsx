// src/pages/DashboardPage.tsx
// Operational command center dashboard focused on billing, collections and service execution.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listClients } from '../lib/api/clientsApi.js'
import { listProposals } from '../lib/api/proposalsApi.js'
import { fetchProjectsSummary } from '../services/projectsApi.js'
import { fetchFinancialDashboardFeed } from '../services/financialManagementApi.js'
import {
  invalidateSnapshotCache,
  normalizeClient,
  normalizeProposal,
  trackEvent,
} from '../domain/analytics/index.js'
import type { AnalyticsRecord } from '../domain/analytics/types.js'
import type { ProjectSummary } from '../domain/projects/types.js'
import type { FinancialDashboardFeed } from '../domain/projects/projectsPanelKpis.js'
import { deriveProjectsPanelKPIs } from '../domain/projects/projectsPanelKpis.js'
import { useAppAuth } from '../auth/guards/RequireAuthorizedUser.js'
import {
  fetchInvoiceNotificationConfig,
  fetchInvoiceNotifications,
  updateInvoiceNotificationConfig,
} from '../services/invoicesApi.js'
import type { InvoiceNotificationAlert } from '../types/clientPortfolio.js'

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

interface DashboardNotificationPrefs {
  visual: boolean
  audio: boolean
  push: boolean
}

const PUSH_PREFS_STORAGE_KEY = 'dashboard.operational.push-prefs.v1'

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function playAlertTone() {
  if (typeof window === 'undefined') return

  const audioCtx = new window.AudioContext()
  const oscillator = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.18)
  gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2)

  oscillator.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  oscillator.start()
  oscillator.stop(audioCtx.currentTime + 0.22)
}

function loadPushPrefs(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PUSH_PREFS_STORAGE_KEY) === 'true'
}

function persistPushPrefs(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PUSH_PREFS_STORAGE_KEY, String(enabled))
}

export function DashboardPage() {
  const [records, setRecords] = useState<AnalyticsRecord[]>([])
  const [loadState, setLoadState] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null)
  const [financialFeed, setFinancialFeed] = useState<FinancialDashboardFeed | null>(null)
  const [invoiceAlerts, setInvoiceAlerts] = useState<InvoiceNotificationAlert[]>([])
  const [prefs, setPrefs] = useState<DashboardNotificationPrefs>({ visual: true, audio: false, push: false })
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const previousCriticalCountRef = useRef(0)

  const { me } = useAppAuth()
  const isAuthenticated = Boolean(me?.authenticated)

  const loadData = useCallback(async () => {
    setLoadState('loading')
    setError(null)

    try {
      const [
        clientsRes,
        proposalsRes,
        projectSummaryRes,
        financialFeedRes,
        invoiceAlertsRes,
        notificationConfigRes,
      ] = await Promise.allSettled([
        listClients({ limit: 1000 }),
        listProposals({ limit: 1000 }),
        fetchProjectsSummary(),
        fetchFinancialDashboardFeed(),
        fetchInvoiceNotifications(),
        fetchInvoiceNotificationConfig(),
      ])

      const allRecords: AnalyticsRecord[] = []

      if (clientsRes.status === 'fulfilled') {
        for (const c of clientsRes.value.data) {
          allRecords.push(normalizeClient(c as unknown as Record<string, unknown>))
        }
      }

      if (proposalsRes.status === 'fulfilled') {
        const clientIds = new Set(allRecords.map((r) => r.id))
        for (const p of proposalsRes.value.data) {
          const rec = normalizeProposal(p as unknown as Record<string, unknown>)
          if (!clientIds.has(p.client_id ?? '')) {
            allRecords.push(rec)
          }
        }
      }

      if (projectSummaryRes.status === 'fulfilled') {
        setProjectSummary(projectSummaryRes.value)
      }

      if (financialFeedRes.status === 'fulfilled') {
        setFinancialFeed(financialFeedRes.value)
      }

      if (invoiceAlertsRes.status === 'fulfilled') {
        setInvoiceAlerts(invoiceAlertsRes.value)
      }

      if (notificationConfigRes.status === 'fulfilled') {
        setPrefs((current) => ({
          ...current,
          visual: notificationConfigRes.value.visual_notifications_enabled,
          audio: notificationConfigRes.value.audio_notifications_enabled,
        }))
      }

      invalidateSnapshotCache()
      setRecords(allRecords)
      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    setPrefs((current) => ({ ...current, push: loadPushPrefs() }))
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(window.Notification.permission)
    }

    void loadData()
    trackEvent('dashboard_viewed')
  }, [isAuthenticated, loadData])

  const projectsPanelKPIs = useMemo(
    () => deriveProjectsPanelKPIs(projectSummary, financialFeed),
    [projectSummary, financialFeed],
  )

  const invoiceSummary = useMemo(() => {
    const overdue = invoiceAlerts.filter((item) => item.alertType === 'vencida').length
    const dueToday = invoiceAlerts.filter((item) => item.alertType === 'vence_hoje').length
    const dueSoon = invoiceAlerts.filter((item) => item.alertType === 'a_vencer').length
    return {
      overdue,
      dueToday,
      dueSoon,
      totalOpen: overdue + dueToday + dueSoon,
    }
  }, [invoiceAlerts])

  const operationRail = useMemo(
    () => [
      {
        title: 'Cobranças e Pagamentos de Faturas',
        subtitle: `${invoiceSummary.totalOpen} ocorrências monitoradas em tempo real`,
        status: invoiceSummary.overdue > 0 ? 'Crítico' : invoiceSummary.dueToday > 0 ? 'Atenção' : 'Estável',
        detail: `${invoiceSummary.overdue} vencidas • ${invoiceSummary.dueToday} vencem hoje • ${invoiceSummary.dueSoon} a vencer`,
      },
      {
        title: 'Entrega de Kit',
        subtitle: `${projectsPanelKPIs.aguardando} projetos aguardando despacho`,
        status: projectsPanelKPIs.aguardando > 0 ? 'Atenção' : 'Estável',
        detail: 'Acompanhe SLA logístico, reagendamentos e confirmação de recebimento.',
      },
      {
        title: 'Instalação',
        subtitle: `${projectsPanelKPIs.emAndamento} projetos em execução`,
        status: projectsPanelKPIs.emAndamento > 0 ? 'Em execução' : 'Sem fila',
        detail: 'Monitore avanço diário, marcos técnicos e impedimentos de campo.',
      },
      {
        title: 'Suporte Técnico',
        subtitle: `${Math.max(0, projectsPanelKPIs.totalProjects - projectsPanelKPIs.concluido)} clientes com potencial de atendimento`,
        status: projectsPanelKPIs.totalProjects > projectsPanelKPIs.concluido ? 'Monitorar' : 'Controlado',
        detail: 'Priorize chamados com impacto financeiro ou risco de inadimplência.',
      },
    ],
    [invoiceSummary, projectsPanelKPIs],
  )

  const criticalCount = invoiceSummary.overdue + invoiceSummary.dueToday

  useEffect(() => {
    if (loadState !== 'loaded') return

    const previous = previousCriticalCountRef.current
    previousCriticalCountRef.current = criticalCount

    if (criticalCount <= previous || criticalCount === 0) return

    if (prefs.audio) {
      playAlertTone()
    }

    if (prefs.push && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      const body = `${invoiceSummary.overdue} vencidas e ${invoiceSummary.dueToday} vencendo hoje. Ação imediata recomendada.`
      new window.Notification('Central Operacional SolarInvest', { body })
    }
  }, [criticalCount, invoiceSummary.dueToday, invoiceSummary.overdue, loadState, prefs.audio, prefs.push])

  const handleToggleVisual = useCallback(async () => {
    const nextValue = !prefs.visual
    setPrefs((current) => ({ ...current, visual: nextValue }))
    setPrefsSaving(true)
    try {
      await updateInvoiceNotificationConfig({ visual_notifications_enabled: nextValue })
    } finally {
      setPrefsSaving(false)
    }
  }, [prefs.visual])

  const handleToggleAudio = useCallback(async () => {
    const nextValue = !prefs.audio
    setPrefs((current) => ({ ...current, audio: nextValue }))
    setPrefsSaving(true)
    try {
      await updateInvoiceNotificationConfig({ audio_notifications_enabled: nextValue })
    } finally {
      setPrefsSaving(false)
    }
  }, [prefs.audio])

  const handleTogglePush = useCallback(async () => {
    const nextValue = !prefs.push

    if (nextValue && typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await window.Notification.requestPermission()
      setNotificationPermission(permission)
      if (permission !== 'granted') {
        setError('Permissão de push notification não concedida no navegador.')
        return
      }
    }

    setPrefs((current) => ({ ...current, push: nextValue }))
    persistPushPrefs(nextValue)
  }, [prefs.push])

  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm text-ds-text-muted">Carregando central operacional…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="rounded-2xl border border-ds-border/70 bg-gradient-to-r from-[#0f172a] via-[#111827] to-[#1f2937] p-6 text-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Command Center</p>
            <h1 className="mt-2 text-2xl font-bold">Dashboard Operacional de Cobranças e Execução</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/80">
              Visão premium para monitoramento de faturas, atrasos, entregas, instalação e suporte técnico, com foco em ação rápida e governança operacional.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="cursor-pointer rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-white/20"
          >
            ↻ Atualizar painel
          </button>
        </div>
      </header>

      {error && prefs.visual && (
        <div className="rounded-lg border border-ds-warning/40 bg-ds-warning/10 px-4 py-2 text-sm text-ds-warning">
          {error} — exibindo dados parciais.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Risco imediato</p>
          <p className="mt-2 text-3xl font-bold text-ds-text-primary">{invoiceSummary.overdue}</p>
          <p className="mt-2 text-sm text-ds-text-secondary">Faturas vencidas exigindo cobrança ativa.</p>
        </article>

        <article className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Vence hoje</p>
          <p className="mt-2 text-3xl font-bold text-ds-text-primary">{invoiceSummary.dueToday}</p>
          <p className="mt-2 text-sm text-ds-text-secondary">Priorize contato para evitar inadimplência.</p>
        </article>

        <article className="rounded-2xl border border-ds-primary/25 bg-ds-primary/5 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-primary">Em operação</p>
          <p className="mt-2 text-3xl font-bold text-ds-text-primary">{projectsPanelKPIs.emAndamento}</p>
          <p className="mt-2 text-sm text-ds-text-secondary">Instalações com execução em andamento.</p>
        </article>

        <article className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Receita realizada</p>
          <p className="mt-2 text-2xl font-bold text-ds-text-primary">{formatCurrencyBRL(projectsPanelKPIs.receitaRealizada)}</p>
          <p className="mt-2 text-sm text-ds-text-secondary">Acompanhamento financeiro operacional consolidado.</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-ds-border bg-ds-bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ds-text-primary">Monitor Operacional Integrado</h2>
            <span className="rounded-full bg-ds-primary/10 px-3 py-1 text-xs font-semibold text-ds-primary">Sem analytics • foco em operação</span>
          </div>

          <div className="space-y-3">
            {operationRail.map((item) => (
              <article key={item.title} className="rounded-xl border border-ds-border/80 bg-ds-bg-canvas p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-ds-text-primary">{item.title}</h3>
                    <p className="mt-1 text-sm text-ds-text-secondary">{item.subtitle}</p>
                  </div>
                  <span className="rounded-full border border-ds-border px-2 py-0.5 text-xs font-medium text-ds-text-secondary">{item.status}</span>
                </div>
                <p className="mt-2 text-xs text-ds-text-muted">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-ds-border bg-ds-bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ds-text-primary">Preferências de Notificação</h2>
          <p className="mt-1 text-xs text-ds-text-muted">Controle alertas visuais, sonoros e push por usuário.</p>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => void handleToggleVisual()}
              className="flex w-full items-center justify-between rounded-lg border border-ds-border px-3 py-2 text-sm hover:border-ds-primary/40"
            >
              <span>Alertas visuais no dashboard</span>
              <strong>{prefs.visual ? 'Ativo' : 'Inativo'}</strong>
            </button>

            <button
              type="button"
              onClick={() => void handleToggleAudio()}
              className="flex w-full items-center justify-between rounded-lg border border-ds-border px-3 py-2 text-sm hover:border-ds-primary/40"
            >
              <span>Alertas sonoros em novos críticos</span>
              <strong>{prefs.audio ? 'Ativo' : 'Inativo'}</strong>
            </button>

            <button
              type="button"
              onClick={() => void handleTogglePush()}
              className="flex w-full items-center justify-between rounded-lg border border-ds-border px-3 py-2 text-sm hover:border-ds-primary/40"
            >
              <span>Push notifications do navegador</span>
              <strong>{prefs.push ? 'Ativo' : 'Inativo'}</strong>
            </button>

            <div className="rounded-lg border border-ds-border/70 bg-ds-bg-canvas px-3 py-2 text-xs text-ds-text-muted">
              Permissão de push: <strong>{notificationPermission}</strong>
            </div>
            {prefsSaving && <p className="text-xs text-ds-primary">Salvando preferências…</p>}
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-ds-border bg-ds-bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ds-text-primary">Fila Prioritária de Cobrança</h2>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Exibição focada em cobrança e regularização de pagamentos, priorizando itens mais críticos.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ds-border text-xs uppercase tracking-wide text-ds-text-muted">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">UC</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Dias</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Ação recomendada</th>
              </tr>
            </thead>
            <tbody>
              {invoiceAlerts.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-ds-text-muted" colSpan={6}>
                    Sem alertas no momento. O monitoramento permanece ativo.
                  </td>
                </tr>
              )}

              {invoiceAlerts.map((alert) => {
                const statusLabel =
                  alert.alertType === 'vencida' ? 'Vencida' : alert.alertType === 'vence_hoje' ? 'Vence hoje' : 'A vencer'

                const actionLabel =
                  alert.alertType === 'vencida'
                    ? 'Cobrança imediata + renegociação'
                    : alert.alertType === 'vence_hoje'
                      ? 'Contato preventivo com confirmação de pagamento'
                      : 'Lembrete de antecipação'

                return (
                  <tr key={alert.invoice.id} className="border-b border-ds-border/60 text-ds-text-secondary">
                    <td className="px-3 py-2 font-medium text-ds-text-primary">{statusLabel}</td>
                    <td className="px-3 py-2">{alert.invoice.uc}</td>
                    <td className="px-3 py-2">{new Date(alert.invoice.due_date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-3 py-2">{alert.daysUntilDue}</td>
                    <td className="px-3 py-2">{formatCurrencyBRL(alert.invoice.amount)}</td>
                    <td className="px-3 py-2">{actionLabel}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="rounded-xl border border-ds-border/70 bg-ds-bg-canvas px-4 py-3 text-xs text-ds-text-muted">
        Base monitorada: {records.length} registros operacionais ativos • {projectsPanelKPIs.totalProjects} projetos no pipeline com foco em execução e cobrança.
      </footer>
    </div>
  )
}
