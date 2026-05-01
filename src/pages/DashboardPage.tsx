// src/pages/DashboardPage.tsx
// Operational dashboard — actionable cards for the current moment.
// Etapa 7: Simplified view. Deep analysis lives in Indicadores.
// Each card links to the corresponding area (Clientes, Cobranças, Operação, Comercial).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listClients } from '../lib/api/clientsApi.js'
import { listProposals } from '../lib/api/proposalsApi.js'
import { fetchProjects } from '../services/projectsApi.js'
import { fetchFinancialDashboardFeed } from '../services/financialManagementApi.js'
import { listInvoices } from '../services/invoicesApi.js'
import { listOperationalTasks } from '../lib/api/operationalDashboardApi.js'
import { fetchPortfolioClients } from '../services/clientPortfolioApi.js'
import { computeDashboardFinanceKPIs } from '../domain/dashboard/dashboardFinance.js'
import { FinancialKpiCards } from '../components/dashboard/FinancialKpiCards.js'
import { WifiStatusCards } from '../components/dashboard/WifiStatusCards.js'
import { WifiOperationalAlerts } from '../components/dashboard/WifiOperationalAlerts.js'
import { formatMoneyBR } from '../lib/locale/br-number.js'
import { useAppAuth } from '../auth/guards/RequireAuthorizedUser.js'
import type { PortfolioClientRow } from '../types/clientPortfolio.js'
import type { DashboardFinanceKPIs } from '../domain/dashboard/dashboardFinance.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardPageProps {
  onNavigateToClientes?: (() => void) | undefined
  onNavigateToCobrancasMensalidades?: (() => void) | undefined
  onNavigateToCobrancasRecebimentos?: (() => void) | undefined
  onNavigateToCobrancasInadimplencia?: (() => void) | undefined
  onNavigateToOperacaoChamados?: (() => void) | undefined
  onNavigateToOperacaoManutencoes?: (() => void) | undefined
  onNavigateToComercialLeads?: (() => void) | undefined
  onNavigateToComercialContratos?: (() => void) | undefined
  onNavigateToComercialPropostas?: (() => void) | undefined
}

interface DashboardData {
  clientesAtivos: number
  receitaPrevistaMes: number | null
  recebidoNoMes: number
  mensalidadesEmAtraso: number
  cobrancasVencendoHoje: number
  proximasManutencoes: number
  chamadosAbertos: number
  contratosAguardandoAssinatura: number
  propostasEmNegociacao: number
}

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────

function padded(n: number): string {
  return String(n).padStart(2, '0')
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${padded(d.getMonth() + 1)}-${padded(d.getDate())}`
}

function currentMonthPrefix(): string {
  const d = new Date()
  return `${d.getFullYear()}-${padded(d.getMonth() + 1)}`
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardPage({
  onNavigateToClientes,
  onNavigateToCobrancasMensalidades,
  onNavigateToCobrancasRecebimentos,
  onNavigateToCobrancasInadimplencia,
  onNavigateToOperacaoChamados,
  onNavigateToOperacaoManutencoes,
  onNavigateToComercialLeads,
  onNavigateToComercialContratos,
  onNavigateToComercialPropostas,
}: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [portfolioClients, setPortfolioClients] = useState<PortfolioClientRow[]>([])
  const [financeKPIs, setFinanceKPIs] = useState<DashboardFinanceKPIs | null>(null)
  const [loadState, setLoadState] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)

  // Gate data loading on confirmed auth so token providers are ready.
  const { me } = useAppAuth()
  const isAuthenticated = Boolean(me?.authenticated)

  const loadData = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const today = todayISO()
      const monthPrefix = currentMonthPrefix()

      const [clientsRes, proposalsRes, projectsRes, financialRes, invoicesRes, tasksRes, portfolioRes] =
        await Promise.allSettled([
          listClients({ limit: 500 }),
          listProposals({ status: 'sent', limit: 200 }),
          fetchProjects({ status: 'Aguardando', limit: 200 }),
          fetchFinancialDashboardFeed(),
          listInvoices({ limit: 500 }),
          listOperationalTasks({ limit: 200 }),
          fetchPortfolioClients(),
        ])

      // ── Clientes ativos (in_portfolio = true) ────────────────────────────
      let clientesAtivos = 0
      if (clientsRes.status === 'fulfilled') {
        clientesAtivos = clientsRes.value.data.filter((c) => c.in_portfolio === true).length
      }

      // ── Receita prevista do mês (MRR from financial feed) ─────────────────
      let receitaPrevistaMes: number | null = null
      if (financialRes.status === 'fulfilled') {
        receitaPrevistaMes = financialRes.value.mrr_leasing ?? null
      }

      // ── Invoice-based metrics ─────────────────────────────────────────────
      let recebidoNoMes = 0
      let mensalidadesEmAtraso = 0
      let cobrancasVencendoHoje = 0
      if (invoicesRes.status === 'fulfilled') {
        const invoices = invoicesRes.value.data
        for (const inv of invoices) {
          const isPaid = inv.payment_status === 'pago' || inv.payment_status === 'confirmado'
          // Recebido no mês: confirmed payments this calendar month
          if (isPaid && inv.paid_at && inv.paid_at.startsWith(monthPrefix)) {
            recebidoNoMes += inv.amount
          }
          // Mensalidades em atraso: explicitly overdue status
          if (inv.payment_status === 'vencida') {
            mensalidadesEmAtraso += 1
          }
          // Vencendo hoje: due today and not yet paid
          if (!isPaid && inv.due_date && inv.due_date.startsWith(today)) {
            cobrancasVencendoHoje += 1
          }
        }
      }

      // ── Operational tasks ─────────────────────────────────────────────────
      // MAINTENANCE and CLEANING are not yet defined task types in the schema.
      // proximasManutencoes uses INSTALLATION + GRID_APPROVAL as current proxies.
      let proximasManutencoes = 0
      let chamadosAbertos = 0
      if (tasksRes.status === 'fulfilled') {
        const tasks = tasksRes.value.data
        for (const task of tasks) {
          const isActive = task.status !== 'DONE' && task.status !== 'CANCELLED'
          if (isActive && (task.type === 'INSTALLATION' || task.type === 'GRID_APPROVAL')) {
            proximasManutencoes += 1
          }
          if (isActive && task.type === 'TECH_SUPPORT') {
            chamadosAbertos += 1
          }
        }
      }

      // ── Contratos aguardando assinatura (projects status = 'Aguardando') ──
      let contratosAguardandoAssinatura = 0
      if (projectsRes.status === 'fulfilled') {
        contratosAguardandoAssinatura = projectsRes.value.rows.length
      }

      // ── Propostas em negociação (status = 'sent') ─────────────────────────
      let propostasEmNegociacao = 0
      if (proposalsRes.status === 'fulfilled') {
        propostasEmNegociacao = proposalsRes.value.data.filter((p) => p.deleted_at === null || p.deleted_at === undefined).length
      }

      setData({
        clientesAtivos,
        receitaPrevistaMes,
        recebidoNoMes,
        mensalidadesEmAtraso,
        cobrancasVencendoHoje,
        proximasManutencoes,
        chamadosAbertos,
        contratosAguardandoAssinatura,
        propostasEmNegociacao,
      })

      // ── Portfolio-based financial KPIs ────────────────────────────────────
      if (portfolioRes.status === 'fulfilled') {
        const clients = portfolioRes.value
        setPortfolioClients(clients)
        setFinanceKPIs(computeDashboardFinanceKPIs(clients))
      }

      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    void loadData()
  }, [isAuthenticated, loadData])

  // ── Greeting ──────────────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm text-ds-text-muted">Carregando dashboard…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ds-text-primary">{greeting} 👋</h1>
          <p className="text-sm text-ds-text-muted">
            Visão operacional do momento atual
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="cursor-pointer rounded-lg border border-ds-border px-3 py-1.5 text-xs text-ds-text-secondary transition-colors hover:border-ds-primary/50 hover:text-ds-primary"
        >
          ↻ Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-ds-warning/30 bg-ds-warning/10 px-4 py-2 text-sm text-ds-warning">
          {error} — exibindo dados parciais.
        </div>
      )}

      {/* Financial KPI cards from portfolio data */}
      {financeKPIs && (
        <FinancialKpiCards finance={financeKPIs} />
      )}

      {/* WiFi operational summary */}
      {portfolioClients.length > 0 && (
        <div className="flex flex-col gap-2">
          <WifiStatusCards clients={portfolioClients} />
          <WifiOperationalAlerts clients={portfolioClients} />
        </div>
      )}

      {/* Actionable cards grid */}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* ── Clientes ─────────────────────────────────────── */}
          <ActionCard
            icon="👥"
            title="Clientes ativos"
            value={data.clientesAtivos}
            area="Clientes"
            onNavigate={onNavigateToClientes}
          />

          {/* ── Cobranças ────────────────────────────────────── */}
          <ActionCard
            icon="📅"
            title="Receita prevista do mês"
            value={data.receitaPrevistaMes !== null ? formatMoneyBR(data.receitaPrevistaMes) : '—'}
            subtitle="MRR leasing"
            area="Cobranças → Mensalidades"
            onNavigate={onNavigateToCobrancasMensalidades}
          />

          <ActionCard
            icon="✅"
            title="Recebido no mês"
            value={formatMoneyBR(data.recebidoNoMes)}
            subtitle="Pagamentos confirmados"
            area="Cobranças → Recebimentos"
            onNavigate={onNavigateToCobrancasRecebimentos}
          />

          <ActionCard
            icon="⚠️"
            title="Mensalidades em atraso"
            value={data.mensalidadesEmAtraso}
            severity={data.mensalidadesEmAtraso > 0 ? 'warning' : 'neutral'}
            area="Cobranças → Inadimplência"
            onNavigate={onNavigateToCobrancasInadimplencia}
          />

          <ActionCard
            icon="🔔"
            title="Cobranças vencendo hoje"
            value={data.cobrancasVencendoHoje}
            severity={data.cobrancasVencendoHoje > 0 ? 'warning' : 'neutral'}
            area="Cobranças → Mensalidades"
            onNavigate={onNavigateToCobrancasMensalidades}
          />

          {/* ── Operação ─────────────────────────────────────── */}
          <ActionCard
            icon="🔧"
            title="Próximas manutenções"
            value={data.proximasManutencoes}
            subtitle="Pendentes ou agendadas"
            area="Operação → Manutenções"
            onNavigate={onNavigateToOperacaoManutencoes}
          />

          <ActionCard
            icon="🎫"
            title="Chamados abertos"
            value={data.chamadosAbertos}
            severity={data.chamadosAbertos > 0 ? 'info' : 'neutral'}
            area="Operação → Chamados"
            onNavigate={onNavigateToOperacaoChamados}
          />

          {/* ── Comercial ────────────────────────────────────── */}
          <ActionCard
            icon="🖋️"
            title="Contratos aguardando assinatura"
            value={data.contratosAguardandoAssinatura}
            severity={data.contratosAguardandoAssinatura > 0 ? 'info' : 'neutral'}
            area="Comercial → Contratos"
            onNavigate={onNavigateToComercialContratos}
          />

          <ActionCard
            icon="📋"
            title="Propostas em negociação"
            value={data.propostasEmNegociacao}
            area="Comercial → Propostas"
            onNavigate={onNavigateToComercialPropostas}
          />
        </div>
      )}
    </div>
  )
}

// ── ActionCard component ──────────────────────────────────────────────────────

type Severity = 'neutral' | 'info' | 'warning' | 'error'

interface ActionCardProps {
  icon: string
  title: string
  value: number | string
  subtitle?: string | undefined
  severity?: Severity | undefined
  area: string
  onNavigate?: (() => void) | undefined
}

function ActionCard({ icon, title, value, subtitle, severity = 'neutral', area, onNavigate }: ActionCardProps) {
  const severityClasses: Record<Severity, string> = {
    neutral: 'border-ds-border bg-ds-panel',
    info: 'border-blue-200 bg-blue-50',
    warning: 'border-yellow-200 bg-yellow-50',
    error: 'border-red-200 bg-red-50',
  }

  const valueSeverityClasses: Record<Severity, string> = {
    neutral: 'text-ds-text-primary',
    info: 'text-blue-800',
    warning: 'text-yellow-800',
    error: 'text-red-800',
  }

  return (
    <div
      className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${severityClasses[severity]}`}
      aria-label={title}
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="text-xs font-medium text-ds-primary underline-offset-2 hover:underline"
            aria-label={`Ver ${area}`}
          >
            Ver →
          </button>
        )}
      </div>
      <div className={`text-3xl font-bold tabular-nums ${valueSeverityClasses[severity]}`} aria-live="polite">
        {value}
      </div>
      <h3 className="mt-1 text-sm font-medium text-ds-text-primary">{title}</h3>
      {subtitle && (
        <div className="mt-0.5 text-xs text-ds-text-muted">{subtitle}</div>
      )}
      {onNavigate && (
        <div className="mt-2 text-xs text-ds-text-muted">{area}</div>
      )}
    </div>
  )
}
