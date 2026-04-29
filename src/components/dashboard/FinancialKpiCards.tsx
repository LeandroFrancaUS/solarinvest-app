import type { DashboardFinanceKPIs } from '../../domain/dashboard/dashboardFinance'

type Props = {
  finance: DashboardFinanceKPIs
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPercent(value: number): string {
  return (value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
}

function Card({ icon, label, value, hint, danger }: { icon: string; label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border bg-ds-surface p-4 shadow-sm ${danger ? 'border-red-300/60' : ''}`}>
      <div className="mb-1 text-lg">{icon}</div>
      <div className={`text-2xl font-bold ${danger ? 'text-red-600' : ''}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-ds-text-muted">{label}</div>
      {hint && <div className="mt-2 text-[11px] text-ds-text-muted">{hint}</div>}
    </div>
  )
}

export function FinancialKpiCards({ finance }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ds-text-primary">Financeiro operacional</h2>
        <span className="text-xs text-ds-text-muted">Fonte: Carteira Ativa + Mensalidades</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Card icon="💵" label="Venda contratada" value={formatCurrency(finance.salesContractedValue)} />
        <Card icon="🔁" label="MRR Leasing" value={formatCurrency(finance.leasingMonthlyRevenue)} />
        <Card icon="📄" label="Leasing contratado" value={formatCurrency(finance.leasingContractedValue)} />
        <Card icon="✅" label="Receita mês" value={formatCurrency(finance.realRevenueCurrentMonth)} hint="Parcelas pagas no mês atual" />
        <Card icon="🟠" label="Em atraso" value={formatCurrency(finance.overdueRevenue)} danger={finance.overdueRevenue > 0} />
        <Card icon="🔴" label="Receita em risco" value={formatCurrency(finance.revenueAtRisk)} danger={finance.revenueAtRisk > 0} />
        <Card icon="📈" label="Próx. 30 dias" value={formatCurrency(finance.projectedRevenueNext30Days)} />
        <Card icon="📉" label="Inadimplência" value={formatPercent(finance.defaultRate)} hint={`${finance.overdueClients} cliente(s)`} danger={finance.defaultRate > 0} />
      </div>
    </section>
  )
}
