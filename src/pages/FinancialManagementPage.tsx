// src/pages/FinancialManagementPage.tsx
// Gestão Financeira — Central de monitoramento e gestão financeira da SolarInvest.
// Access: admin | page_financial_management permission only.

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import '../styles/financial-management.css'
import {
  fetchFinancialSummary,
  fetchFinancialProjects,
  fetchFinancialCashflow,
  fetchFinancialEntries,
  createFinancialEntry,
  updateFinancialEntry,
  deleteFinancialEntry,
  fetchFinancialCategories,
  fetchFinancialItemTemplates,
  bootstrapProjectFinancialStructure,
  fetchFinancialProjectSummaries,
  fetchFinancialProjectDetail,
  createProjectFinancialItem,
  updateProjectFinancialItem,
  deleteProjectFinancialItem,
  type FinancialSummary,
  type FinancialProject,
  type CashflowPeriod,
  type FinancialEntry,
  type FinancialCategory,
  type FinancialEntryInput,
  type FinancialItemTemplate,
  type FinancialProjectSummary,
  type FinancialProjectDetail,
  type ProjectFinancialItem,
  type ProjectFinancialItemInput,
} from '../services/financialManagementApi'
import { formatCurrencyBRL } from '../utils/formatters'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'projects' | 'cashflow' | 'entries' | 'leasing' | 'sales'

type PeriodFilter = 'month' | 'quarter' | 'year' | 'custom'

interface Props {
  onBack: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(1)}%`
}

function formatMonths(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(1)} meses`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Visão Geral',
  projects: 'Projetos',
  cashflow: 'Fluxo de Caixa',
  entries: 'Lançamentos',
  leasing: 'Leasing',
  sales: 'Vendas',
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado',
  due: 'A Vencer',
  paid: 'Pago',
  received: 'Recebido',
  partial: 'Parcial',
  cancelled: 'Cancelado',
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
}

const PROJECT_KIND_LABELS: Record<string, string> = {
  leasing: 'Leasing',
  sale: 'Venda',
  buyout: 'Buyout',
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  icon?: string
  color?: string
  subtitle?: string
}

function KpiCard({ label, value, icon, color, subtitle }: KpiCardProps) {
  return (
    <div className={`fm-kpi-card${color ? ` fm-kpi-card--${color}` : ''}`}>
      {icon ? <span className="fm-kpi-icon" aria-hidden="true">{icon}</span> : null}
      <div className="fm-kpi-body">
        <span className="fm-kpi-label">{label}</span>
        <span className="fm-kpi-value">{value}</span>
        {subtitle ? <span className="fm-kpi-subtitle">{subtitle}</span> : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Error Banner
// ─────────────────────────────────────────────────────────────────────────────

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="fm-error" role="alert">
      <strong>Erro ao carregar:</strong> {message}
      <button type="button" className="ghost" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Form (Drawer / Modal)
// ─────────────────────────────────────────────────────────────────────────────

interface EntryFormProps {
  entry?: FinancialEntry | null
  categories: FinancialCategory[]
  templates: FinancialItemTemplate[]
  onSave: (data: FinancialEntryInput) => Promise<void>
  onClose: () => void
  isSaving: boolean
}

const EMPTY_ENTRY: FinancialEntryInput = {
  entry_type: 'expense',
  scope_type: 'company',
  category: '',
  subcategory: '',
  description: '',
  amount: 0,
  expected_amount: null,
  realized_amount: null,
  competence_date: new Date().toISOString().substring(0, 10),
  payment_date: null,
  due_date: null,
  receipt_date: null,
  status: 'planned',
  is_recurring: false,
  recurrence_frequency: null,
  project_kind: null,
  project_id: null,
  proposal_id: null,
  client_id: null,
  consultant_id: null,
  project_financial_item_id: null,
  installment_number: null,
  installment_total: null,
  origin_source: null,
  notes: '',
}

function EntryForm({ entry, categories, templates, onSave, onClose, isSaving }: EntryFormProps) {
  const [form, setForm] = useState<FinancialEntryInput>(() =>
    entry
      ? {
          entry_type: entry.entry_type,
          scope_type: entry.scope_type,
          category: entry.category ?? '',
          subcategory: entry.subcategory ?? '',
          description: entry.description ?? '',
          amount: entry.amount,
          expected_amount: entry.expected_amount,
          realized_amount: entry.realized_amount,
          competence_date: entry.competence_date ?? new Date().toISOString().substring(0, 10),
          payment_date: entry.payment_date ?? null,
          due_date: entry.due_date ?? null,
          receipt_date: entry.receipt_date ?? null,
          status: entry.status,
          is_recurring: entry.is_recurring ?? false,
          recurrence_frequency: entry.recurrence_frequency ?? null,
          project_kind: entry.project_kind ?? null,
          project_id: entry.project_id ?? null,
          proposal_id: entry.proposal_id ?? null,
          client_id: entry.client_id ?? null,
          consultant_id: entry.consultant_id ?? null,
          project_financial_item_id: entry.project_financial_item_id ?? null,
          installment_number: entry.installment_number ?? null,
          installment_total: entry.installment_total ?? null,
          origin_source: entry.origin_source ?? null,
          notes: entry.notes ?? '',
        }
      : EMPTY_ENTRY,
  )

  useEffect(() => {
    console.info('[financial-ui] entry form mounted', { editing: !!entry })
    return () => {
      console.info('[financial-ui] entry form unmounted')
    }
  }, [entry])

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' || c.type === 'both'),
    [categories],
  )
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income' || c.type === 'both'),
    [categories],
  )
  const visibleCategories = form.entry_type === 'income' ? incomeCategories : expenseCategories

  const set = useCallback((field: keyof FinancialEntryInput, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      console.info('[financial-ui] submit financial entry', {
        entry_type: form.entry_type,
        scope_type: form.scope_type,
        amount: form.amount,
        expected_amount: form.expected_amount,
        realized_amount: form.realized_amount,
        proposal_id: form.proposal_id,
        client_id: form.client_id,
        project_financial_item_id: form.project_financial_item_id,
      })
      try {
        await onSave(form)
        console.info('[financial-ui] submit financial entry success')
      } catch (err) {
        console.error('[financial-ui] submit financial entry error', err)
        throw err
      }
    },
    [form, onSave],
  )

  // Filter templates relevant to this entry type & project kind
  const visibleTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (t.nature !== form.entry_type) return false
      if (form.project_kind && t.project_kind !== 'both' && t.project_kind !== form.project_kind) {
        return false
      }
      return true
    })
  }, [templates, form.entry_type, form.project_kind])

  const applyTemplate = useCallback((templateId: string) => {
    if (!templateId) return
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    setForm((prev) => ({
      ...prev,
      // We don't link to a project_financial_item here; just prefill from the template catalog.
      category: tpl.category ?? tpl.name,
      description: prev.description || tpl.name,
      amount: tpl.default_amount ?? prev.amount,
      expected_amount: tpl.default_amount ?? prev.expected_amount,
      origin_source: `template:${tpl.normalized_name}`,
    }))
  }, [templates])

  return (
    <div className="fm-drawer-overlay" role="dialog" aria-modal="true" aria-label="Lançamento financeiro">
      <div className="fm-drawer">
        <div className="fm-drawer-header">
          <h3>{entry ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
          <button type="button" className="fm-drawer-close ghost" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <form className="fm-drawer-body" onSubmit={(e) => { void handleSubmit(e) }}>
          <div className="fm-form-row">
            <label className="fm-form-label">Tipo</label>
            <select
              className="fm-form-select"
              value={form.entry_type}
              onChange={(e) => set('entry_type', e.target.value)}
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Escopo</label>
            <select
              className="fm-form-select"
              value={form.scope_type}
              onChange={(e) => set('scope_type', e.target.value)}
            >
              <option value="company">Empresa</option>
              <option value="project">Projeto</option>
            </select>
          </div>
          {form.scope_type === 'project' ? (
            <>
              <div className="fm-form-row">
                <label className="fm-form-label">Tipo do Projeto</label>
                <select
                  className="fm-form-select"
                  value={form.project_kind ?? ''}
                  onChange={(e) => set('project_kind', e.target.value || null)}
                >
                  <option value="">Selecione…</option>
                  <option value="leasing">Leasing</option>
                  <option value="sale">Venda</option>
                  <option value="buyout">Buyout</option>
                </select>
              </div>
              <div className="fm-form-row">
                <label className="fm-form-label">Proposta (UUID)</label>
                <input
                  className="fm-form-input"
                  type="text"
                  value={form.proposal_id ?? ''}
                  onChange={(e) => set('proposal_id', e.target.value || null)}
                  placeholder="Cole o ID da proposta"
                />
              </div>
              <div className="fm-form-row">
                <label className="fm-form-label">Cliente (ID)</label>
                <input
                  className="fm-form-input"
                  type="number"
                  step="1"
                  value={form.client_id == null ? '' : String(form.client_id)}
                  onChange={(e) => set('client_id', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="Opcional"
                />
              </div>
            </>
          ) : null}
          {visibleTemplates.length > 0 ? (
            <div className="fm-form-row">
              <label className="fm-form-label">Item padrão (template)</label>
              <select
                className="fm-form-select"
                defaultValue=""
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">Selecione um item para preencher…</option>
                {visibleTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.is_system ? '★ ' : ''}{t.name}
                    {t.default_amount != null ? ` — ${formatCurrencyBRL(t.default_amount)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="fm-form-row">
            <label className="fm-form-label">Categoria</label>
            {visibleCategories.length > 0 ? (
              <select
                className="fm-form-select"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                aria-required="false"
              >
                <option value="">Selecione...</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="fm-form-input"
                type="text"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="Ex: Instalação, Kit Solar, Mensalidade…"
                aria-required="false"
              />
            )}
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Subcategoria</label>
            <input
              className="fm-form-input"
              type="text"
              value={form.subcategory ?? ''}
              onChange={(e) => set('subcategory', e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Descrição</label>
            <input
              className="fm-form-input"
              type="text"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Descreva o lançamento"
            />
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Valor (R$)</label>
            <input
              className="fm-form-input"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Data de Competência</label>
            <input
              className="fm-form-input"
              type="date"
              value={form.competence_date ?? ''}
              onChange={(e) => set('competence_date', e.target.value)}
              required
            />
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Data de Pagamento</label>
            <input
              className="fm-form-input"
              type="date"
              value={form.payment_date ?? ''}
              onChange={(e) => set('payment_date', e.target.value || null)}
            />
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Status</label>
            <select
              className="fm-form-select"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              <option value="planned">Planejado</option>
              <option value="due">A Vencer</option>
              <option value="paid">Pago</option>
              <option value="received">Recebido</option>
              <option value="partial">Parcial</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Valor previsto (R$)</label>
            <input
              className="fm-form-input"
              type="number"
              step="0.01"
              value={form.expected_amount ?? ''}
              onChange={(e) => set('expected_amount', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="Opcional"
            />
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Valor realizado (R$)</label>
            <input
              className="fm-form-input"
              type="number"
              step="0.01"
              value={form.realized_amount ?? ''}
              onChange={(e) => set('realized_amount', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="Opcional"
            />
          </div>
          <div className="fm-form-row">
            <label className="fm-form-label">Vencimento</label>
            <input
              className="fm-form-input"
              type="date"
              value={form.due_date ?? ''}
              onChange={(e) => set('due_date', e.target.value || null)}
            />
          </div>
          {form.entry_type === 'income' ? (
            <div className="fm-form-row">
              <label className="fm-form-label">Recebimento</label>
              <input
                className="fm-form-input"
                type="date"
                value={form.receipt_date ?? ''}
                onChange={(e) => set('receipt_date', e.target.value || null)}
              />
            </div>
          ) : null}
          <div className="fm-form-row">
            <label className="fm-form-label">Parcela nº / total</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="fm-form-input"
                type="number"
                step="1"
                min="0"
                value={form.installment_number ?? ''}
                onChange={(e) => set('installment_number', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                placeholder="Nº"
              />
              <input
                className="fm-form-input"
                type="number"
                step="1"
                min="0"
                value={form.installment_total ?? ''}
                onChange={(e) => set('installment_total', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                placeholder="Total"
              />
            </div>
          </div>
          <div className="fm-form-row fm-form-row--checkbox">
            <label className="fm-form-label">
              <input
                type="checkbox"
                checked={form.is_recurring ?? false}
                onChange={(e) => set('is_recurring', e.target.checked)}
              />
              {' '}Recorrente
            </label>
          </div>
          {form.is_recurring ? (
            <div className="fm-form-row">
              <label className="fm-form-label">Frequência</label>
              <select
                className="fm-form-select"
                value={form.recurrence_frequency ?? ''}
                onChange={(e) => set('recurrence_frequency', e.target.value || null)}
              >
                <option value="">Selecione...</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
          ) : null}
          <div className="fm-form-row">
            <label className="fm-form-label">Observações</label>
            <textarea
              className="fm-form-textarea"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Observações opcionais"
            />
          </div>
          <div className="fm-drawer-actions">
            <button type="button" className="ghost" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={isSaving}>
              {isSaving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ summary, error, onRetry }: { summary: FinancialSummary | null; error: string | null; onRetry: () => void }) {
  if (error) return <SectionError message={error} onRetry={onRetry} />
  if (!summary) {
    return <div className="fm-empty">Carregando indicadores…</div>
  }
  return (
    <div className="fm-overview">
      <div className="fm-kpi-grid">
        <KpiCard label="Receita Projetada" value={formatCurrencyBRL(summary.total_projected_revenue)} icon="📈" color="green" />
        <KpiCard label="Receita Realizada" value={formatCurrencyBRL(summary.total_realized_revenue)} icon="✅" color="green" />
        <KpiCard label="Custo Total" value={formatCurrencyBRL(summary.total_cost)} icon="💸" color="red" />
        <KpiCard label="Lucro Líquido" value={formatCurrencyBRL(summary.net_profit)} icon="💰" color={summary.net_profit >= 0 ? 'green' : 'red'} />
        <KpiCard label="ROI Médio" value={formatPct(summary.avg_roi_percent)} icon="📊" />
        <KpiCard label="Payback Médio" value={formatMonths(summary.avg_payback_months)} icon="⏱️" />
        <KpiCard label="Projetos Ativos" value={String(summary.active_projects_count)} icon="🏗️" />
        <KpiCard label="MRR (Leasing)" value={formatCurrencyBRL(summary.mrr_leasing)} icon="🔄" subtitle="Receita recorrente mensal" />
        <KpiCard label="Vendas Fechadas" value={formatCurrencyBRL(summary.closed_sales_revenue)} icon="🤝" />
        <KpiCard label="Inadimplência" value={formatPct(summary.avg_default_rate_percent)} icon="⚠️" color={summary.avg_default_rate_percent > 5 ? 'red' : 'green'} />
        <KpiCard label="Margem Líquida" value={formatPct(summary.avg_net_margin_percent)} icon="📉" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculation helpers — pure functions, no side-effects
// ─────────────────────────────────────────────────────────────────────────────

function computeItemExpectedTotal(item: ProjectFinancialItem): number {
  if (item.expected_total != null) return item.expected_total
  if (item.expected_amount != null && item.expected_quantity != null) {
    return item.expected_amount * item.expected_quantity
  }
  return item.expected_amount ?? 0
}

interface ProjectTotals {
  expectedCost: number
  expectedRevenue: number
  saldoPrevisto: number
  margem: number | null
  roi: number | null
  payback: number | null
}

function computeProjectTotals(items: ProjectFinancialItem[], proposalType?: string): ProjectTotals {
  let expectedCost = 0
  let expectedRevenue = 0
  let monthlyRevenue: number | null = null

  for (const item of items) {
    const total = computeItemExpectedTotal(item)
    if (item.nature === 'expense') {
      expectedCost += total
    } else {
      expectedRevenue += total
      // Heuristic: mensalidade item for leasing payback calculation
      if (
        proposalType === 'leasing' &&
        monthlyRevenue == null &&
        (item.item_name?.toLowerCase().includes('mensalidade') || item.category?.toLowerCase().includes('mensalidade'))
      ) {
        monthlyRevenue = item.expected_amount ?? null
      }
    }
  }

  const saldoPrevisto = expectedRevenue - expectedCost
  const margem = expectedRevenue > 0 ? (saldoPrevisto / expectedRevenue) * 100 : null
  const roi = expectedCost > 0 ? (saldoPrevisto / expectedCost) * 100 : null
  const payback =
    proposalType === 'leasing' && monthlyRevenue != null && monthlyRevenue > 0
      ? expectedCost / monthlyRevenue
      : expectedCost > 0 && expectedRevenue > 0
        ? expectedCost / (expectedRevenue / Math.max(items.length, 1))
        : null

  return { expectedCost, expectedRevenue, saldoPrevisto, margem, roi, payback }
}

// ─────────────────────────────────────────────────────────────────────────────
// FinancialProjectsSummaryCards — aggregate cards from all project summaries
// ─────────────────────────────────────────────────────────────────────────────

function FinancialProjectsSummaryCards({ summaries }: { summaries: FinancialProjectSummary[] }) {
  const totals = useMemo(() => {
    let cost = 0
    let revenue = 0
    let saldo = 0
    for (const s of summaries) {
      cost += s.total_expected_cost
      revenue += s.total_expected_revenue
      saldo += s.saldo_previsto
    }
    return { cost, revenue, saldo, count: summaries.length }
  }, [summaries])

  if (summaries.length === 0) return null

  return (
    <div className="fm-summary-cards">
      <div className="fm-summary-card">
        <span className="fm-summary-card__icon">🏗️</span>
        <span className="fm-summary-card__value">{totals.count}</span>
        <span className="fm-summary-card__label">Projetos com estrutura financeira</span>
      </div>
      <div className="fm-summary-card fm-summary-card--red">
        <span className="fm-summary-card__icon">💸</span>
        <span className="fm-summary-card__value">{formatCurrencyBRL(totals.cost)}</span>
        <span className="fm-summary-card__label">Custo total previsto</span>
      </div>
      <div className="fm-summary-card fm-summary-card--green">
        <span className="fm-summary-card__icon">💰</span>
        <span className="fm-summary-card__value">{formatCurrencyBRL(totals.revenue)}</span>
        <span className="fm-summary-card__label">Receita total prevista</span>
      </div>
      <div className={`fm-summary-card ${totals.saldo >= 0 ? 'fm-summary-card--green' : 'fm-summary-card--red'}`}>
        <span className="fm-summary-card__icon">{totals.saldo >= 0 ? '📈' : '📉'}</span>
        <span className="fm-summary-card__value">{formatCurrencyBRL(totals.saldo)}</span>
        <span className="fm-summary-card__label">Saldo global previsto</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OperationalProjectsTab — project list driven by project_financial_items aggregate
// ─────────────────────────────────────────────────────────────────────────────

function OperationalProjectsTab({
  summaries,
  error,
  onRetry,
  onOpenProject,
}: {
  summaries: FinancialProjectSummary[]
  error: string | null
  onRetry: () => void
  onOpenProject: (proposalId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filtered = useMemo(() => {
    if (error) return []
    return summaries.filter((s) => {
      if (kindFilter && s.project_kind !== kindFilter) return false
      if (statusFilter && s.proposal_status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.client_name.toLowerCase().includes(q) ||
          (s.proposal_code ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [summaries, search, kindFilter, statusFilter, error])

  if (error) return <SectionError message={error} onRetry={onRetry} />

  return (
    <div className="fm-projects">
      <div className="fm-filters">
        <input
          type="search"
          className="fm-filter-input"
          placeholder="Buscar cliente, código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="fm-filter-select" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="leasing">Leasing</option>
          <option value="sale">Venda</option>
          <option value="buyout">Buyout</option>
        </select>
        <select className="fm-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="sent">Enviado</option>
          <option value="approved">Aprovado</option>
          <option value="active">Ativo</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="fm-empty">
          <p>Nenhum projeto com estrutura financeira encontrado.</p>
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Use <strong>⚙ Gerar estrutura do projeto</strong> para criar a composição financeira de um projeto a partir de uma proposta existente.
          </p>
        </div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table fm-project-list-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Cód. Proposta</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Itens</th>
                <th>Custo Previsto</th>
                <th>Receita Prevista</th>
                <th>Saldo Previsto</th>
                <th>Última atualização</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.proposal_id}
                  className="fm-project-row"
                  onClick={() => onOpenProject(s.proposal_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onOpenProject(s.proposal_id)}
                >
                  <td>{s.client_name || '—'}</td>
                  <td>{s.proposal_code || <em style={{ color: '#9ca3af' }}>{s.proposal_id.substring(0, 8)}…</em>}</td>
                  <td>
                    <span className={`fm-badge fm-badge--${s.project_kind}`}>
                      {PROJECT_KIND_LABELS[s.project_kind] ?? s.project_kind}
                    </span>
                  </td>
                  <td>{s.proposal_status}</td>
                  <td>{s.item_count}</td>
                  <td className="fm-value--negative">{formatCurrencyBRL(s.total_expected_cost)}</td>
                  <td className="fm-value--positive">{formatCurrencyBRL(s.total_expected_revenue)}</td>
                  <td className={s.saldo_previsto >= 0 ? 'fm-value--positive' : 'fm-value--negative'}>
                    {formatCurrencyBRL(s.saldo_previsto)}
                  </td>
                  <td>{formatDate(s.last_updated)}</td>
                  <td className="fm-actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="ghost fm-action-btn"
                      onClick={() => onOpenProject(s.proposal_id)}
                      title="Abrir projeto"
                    >
                      📂
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectDetailView — per-project operational item table
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_ITEM_FORM: Partial<ProjectFinancialItemInput> = {
  nature: 'expense',
  category: '',
  item_name: '',
  value_mode: 'manual',
  expected_amount: null,
  expected_quantity: null,
  expected_total: null,
  notes: '',
}

interface ItemRowProps {
  item: ProjectFinancialItem
  isEditing: boolean
  editForm: Partial<ProjectFinancialItemInput>
  onChangeEditForm: (patch: Partial<ProjectFinancialItemInput>) => void
  onStartEdit: (item: ProjectFinancialItem) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  isSaving: boolean
}

function ItemRow({
  item,
  isEditing,
  editForm,
  onChangeEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isSaving,
}: ItemRowProps) {
  if (isEditing) {
    const computedTotal =
      editForm.expected_quantity != null && editForm.expected_amount != null
        ? editForm.expected_quantity * editForm.expected_amount
        : null

    return (
      <tr className="fm-op-row-editing">
        <td>
          <select
            className="fm-form-select"
            value={editForm.nature ?? 'expense'}
            onChange={(e) => onChangeEditForm({ nature: e.target.value as 'income' | 'expense' })}
          >
            <option value="expense">Custo</option>
            <option value="income">Receita</option>
          </select>
        </td>
        <td>
          <input
            className="fm-form-input"
            value={editForm.category ?? ''}
            onChange={(e) => onChangeEditForm({ category: e.target.value })}
            placeholder="Categoria"
          />
        </td>
        <td>
          <input
            className="fm-form-input"
            value={editForm.item_name ?? ''}
            onChange={(e) => onChangeEditForm({ item_name: e.target.value })}
            placeholder="Nome do item"
          />
        </td>
        <td>
          <input
            type="number"
            className="fm-form-input fm-op-input-narrow"
            value={editForm.expected_quantity ?? ''}
            onChange={(e) =>
              onChangeEditForm({ expected_quantity: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="Qtd"
            min="0"
          />
        </td>
        <td>
          <input
            type="number"
            className="fm-form-input fm-op-input-narrow"
            value={editForm.expected_amount ?? ''}
            onChange={(e) =>
              onChangeEditForm({ expected_amount: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="Vlr unit."
            min="0"
            step="0.01"
          />
        </td>
        <td>
          {computedTotal != null ? (
            <span className="fm-op-computed-total">{formatCurrencyBRL(computedTotal)}</span>
          ) : (
            <input
              type="number"
              className="fm-form-input fm-op-input-narrow"
              value={editForm.expected_total ?? ''}
              onChange={(e) =>
                onChangeEditForm({ expected_total: e.target.value === '' ? null : Number(e.target.value) })
              }
              placeholder="Total"
              min="0"
              step="0.01"
            />
          )}
        </td>
        <td>
          <input
            className="fm-form-input"
            value={editForm.notes ?? ''}
            onChange={(e) => onChangeEditForm({ notes: e.target.value })}
            placeholder="Observações"
          />
        </td>
        <td className="fm-actions-cell">
          <button type="button" className="primary" onClick={onSaveEdit} disabled={isSaving}>
            {isSaving ? '…' : '✓'}
          </button>
          <button type="button" className="ghost" onClick={onCancelEdit}>
            ✗
          </button>
        </td>
      </tr>
    )
  }

  const total = computeItemExpectedTotal(item)
  return (
    <tr>
      <td>
        <span className={`fm-badge fm-badge--${item.nature === 'expense' ? 'expense' : 'income'}`}>
          {item.nature === 'expense' ? 'Custo' : 'Receita'}
        </span>
      </td>
      <td>{item.category || '—'}</td>
      <td>{item.item_name}</td>
      <td>{item.expected_quantity != null ? item.expected_quantity : '—'}</td>
      <td>{item.expected_amount != null ? formatCurrencyBRL(item.expected_amount) : '—'}</td>
      <td className={item.nature === 'expense' ? 'fm-value--negative' : 'fm-value--positive'}>
        {formatCurrencyBRL(total)}
      </td>
      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.notes || '—'}
      </td>
      <td className="fm-actions-cell">
        <button type="button" className="ghost fm-action-btn" onClick={() => onStartEdit(item)} title="Editar">
          ✏️
        </button>
        <button
          type="button"
          className="ghost fm-action-btn fm-action-btn--danger"
          onClick={() => onDelete(item.id)}
          title="Remover"
        >
          🗑️
        </button>
      </td>
    </tr>
  )
}

function ProjectDetailView({
  proposalId,
  onBack,
  categories,
  templates,
}: {
  proposalId: string
  onBack: () => void
  categories: FinancialCategory[]
  templates: FinancialItemTemplate[]
}) {
  const [detail, setDetail] = useState<FinancialProjectDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ProjectFinancialItemInput>>(EMPTY_ITEM_FORM)

  const [isAddingItem, setIsAddingItem] = useState(false)
  const [newItemNature, setNewItemNature] = useState<'expense' | 'income'>('expense')
  const [newItemForm, setNewItemForm] = useState<Partial<ProjectFinancialItemInput>>(EMPTY_ITEM_FORM)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [bootstrapLoading, setBootstrapLoading] = useState(false)
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const d = await fetchFinancialProjectDetail(proposalId)
      setDetail(d)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar projeto')
    } finally {
      setIsLoading(false)
    }
  }, [proposalId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const items = detail?.items ?? []
  const costItems = items.filter((i) => i.nature === 'expense')
  const revenueItems = items.filter((i) => i.nature === 'income')
  const totals = computeProjectTotals(items, detail?.proposal_type)
  const costTotal = costItems.reduce((s, i) => s + computeItemExpectedTotal(i), 0)
  const revenueTotal = revenueItems.reduce((s, i) => s + computeItemExpectedTotal(i), 0)

  const handleStartEdit = useCallback((item: ProjectFinancialItem) => {
    setEditingId(item.id)
    setEditForm({
      nature: item.nature,
      category: item.category,
      item_name: item.item_name,
      value_mode: item.value_mode,
      expected_amount: item.expected_amount ?? null,
      expected_quantity: item.expected_quantity ?? null,
      expected_total: item.expected_total ?? null,
      notes: item.notes ?? '',
    })
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateProjectFinancialItem(editingId, editForm)
      setEditingId(null)
      setEditForm(EMPTY_ITEM_FORM)
      await loadDetail()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }, [editingId, editForm, loadDetail])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm(EMPTY_ITEM_FORM)
  }, [])

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Remover este item do projeto?')) return
      setSaveError(null)
      try {
        await deleteProjectFinancialItem(id)
        await loadDetail()
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Erro ao remover')
      }
    },
    [loadDetail],
  )

  const handleAddItem = useCallback(async () => {
    if (!newItemForm.item_name?.trim()) {
      setSaveError('Informe o nome do item.')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    const kind: 'leasing' | 'sale' | 'buyout' =
      detail?.proposal_type === 'leasing' ? 'leasing' : 'sale'
    try {
      await createProjectFinancialItem({
        ...(newItemForm as ProjectFinancialItemInput),
        proposal_id: proposalId,
        project_kind: kind,
        nature: newItemNature,
        category: newItemForm.category || kind,
        item_name: newItemForm.item_name ?? '',
      })
      setIsAddingItem(false)
      setNewItemForm(EMPTY_ITEM_FORM)
      await loadDetail()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao adicionar item')
    } finally {
      setIsSaving(false)
    }
  }, [newItemForm, newItemNature, proposalId, detail, loadDetail])

  const handleBootstrap = useCallback(async () => {
    if (
      items.length > 0 &&
      !window.confirm(
        'Este projeto já possui itens. Deseja gerar a estrutura padrão mesmo assim? Os itens existentes serão preservados.',
      )
    )
      return
    setBootstrapLoading(true)
    setBootstrapMsg(null)
    setSaveError(null)
    try {
      const result = await bootstrapProjectFinancialStructure(proposalId)
      setBootstrapMsg(
        `Estrutura gerada (${result.project_kind}): ${result.created_count} item(ns) adicionado(s).`,
      )
      await loadDetail()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao gerar estrutura')
    } finally {
      setBootstrapLoading(false)
    }
  }, [items.length, proposalId, loadDetail])

  // Template picker auto-fill for new item
  const handleApplyTemplateToNew = useCallback(
    (templateId: string) => {
      if (!templateId) return
      const tpl = templates.find((t) => t.id === templateId)
      if (!tpl) return
      setNewItemForm((prev) => ({
        ...prev,
        category: tpl.category ?? tpl.name,
        item_name: prev.item_name || tpl.name,
        expected_amount: tpl.default_amount != null ? tpl.default_amount : (prev.expected_amount ?? null),
        expected_total: tpl.default_amount != null ? tpl.default_amount : (prev.expected_total ?? null),
      } as Partial<ProjectFinancialItemInput>))
      if (tpl.nature === 'income' || tpl.nature === 'expense') {
        setNewItemNature(tpl.nature)
      }
    },
    [templates],
  )

  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.nature === newItemNature &&
          (t.project_kind === (detail?.proposal_type ?? 'sale') || t.project_kind === 'both'),
      ),
    [templates, newItemNature, detail],
  )

  return (
    <div className="fm-project-detail">
      {/* Breadcrumb / back */}
      <div className="fm-project-detail-breadcrumb">
        <button type="button" className="ghost fm-back-btn" onClick={onBack}>
          ← Voltar à Gestão Financeira
        </button>
      </div>

      {/* Project header */}
      {detail ? (
        <div className="fm-project-detail-header">
          <div className="fm-project-detail-title">
            <span className={`fm-badge fm-badge--${detail.proposal_type}`}>
              {PROJECT_KIND_LABELS[detail.proposal_type] ?? detail.proposal_type}
            </span>
            <h2 className="fm-project-detail-name">{detail.client_name ?? '—'}</h2>
            {detail.proposal_code ? (
              <span className="fm-project-code">#{detail.proposal_code}</span>
            ) : null}
            {detail.status ? <span className="fm-project-status-badge">{detail.status}</span> : null}
          </div>

          <div className="fm-project-detail-kpis">
            <div className="fm-kpi-mini">
              <span className="fm-kpi-mini-label">Custo previsto</span>
              <span className="fm-kpi-mini-value fm-value--negative">{formatCurrencyBRL(totals.expectedCost)}</span>
            </div>
            <div className="fm-kpi-mini">
              <span className="fm-kpi-mini-label">Receita prevista</span>
              <span className="fm-kpi-mini-value fm-value--positive">{formatCurrencyBRL(totals.expectedRevenue)}</span>
            </div>
            <div className="fm-kpi-mini">
              <span className="fm-kpi-mini-label">Saldo previsto</span>
              <span
                className={`fm-kpi-mini-value ${totals.saldoPrevisto >= 0 ? 'fm-value--positive' : 'fm-value--negative'}`}
              >
                {formatCurrencyBRL(totals.saldoPrevisto)}
              </span>
            </div>
            {totals.margem !== null ? (
              <div className="fm-kpi-mini">
                <span className="fm-kpi-mini-label">Margem est.</span>
                <span className="fm-kpi-mini-value">{formatPct(totals.margem)}</span>
              </div>
            ) : null}
            {totals.roi !== null ? (
              <div className="fm-kpi-mini">
                <span className="fm-kpi-mini-label">ROI est.</span>
                <span className="fm-kpi-mini-value">{formatPct(totals.roi)}</span>
              </div>
            ) : null}
            {totals.payback !== null ? (
              <div className="fm-kpi-mini">
                <span className="fm-kpi-mini-label">Payback est.</span>
                <span className="fm-kpi-mini-value">{formatMonths(totals.payback)}</span>
              </div>
            ) : null}
          </div>

          <div className="fm-project-detail-actions">
            <button
              type="button"
              className="primary"
              onClick={() => setIsAddingItem(true)}
              disabled={isSaving || isAddingItem}
            >
              + Adicionar item
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void handleBootstrap()}
              disabled={bootstrapLoading}
            >
              {bootstrapLoading ? 'Gerando…' : '⚙ Gerar estrutura padrão'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Feedback banners */}
      {bootstrapMsg ? (
        <div className="fm-error" role="status" style={{ background: '#ecfdf5', borderColor: '#34d399', color: '#065f46' }}>
          ✅ {bootstrapMsg}
          <button type="button" className="ghost" onClick={() => setBootstrapMsg(null)} style={{ marginLeft: 8 }}>
            ×
          </button>
        </div>
      ) : null}
      {saveError ? (
        <div className="fm-error" role="alert">
          {saveError}
          <button type="button" className="ghost" onClick={() => setSaveError(null)} style={{ marginLeft: 8 }}>
            ×
          </button>
        </div>
      ) : null}

      {/* Main content */}
      {isLoading ? (
        <div className="fm-loading">
          <span className="fm-loading-spinner" aria-hidden="true" />
          Carregando estrutura financeira do projeto…
        </div>
      ) : loadError ? (
        <div className="fm-error">
          {loadError}{' '}
          <button type="button" className="ghost" onClick={() => void loadDetail()}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="fm-op-table-wrapper">
          {/* Add item form (appears above table when active) */}
          {isAddingItem ? (
            <div className="fm-op-add-panel">
              <h4 className="fm-op-add-panel-title">Novo item</h4>
              <div className="fm-op-add-form">
                <div className="fm-form-row">
                  <label className="fm-form-label">Natureza</label>
                  <select
                    className="fm-form-select"
                    value={newItemNature}
                    onChange={(e) => setNewItemNature(e.target.value as 'expense' | 'income')}
                  >
                    <option value="expense">Custo</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
                {filteredTemplates.length > 0 ? (
                  <div className="fm-form-row">
                    <label className="fm-form-label">Item padrão</label>
                    <select
                      className="fm-form-select"
                      onChange={(e) => handleApplyTemplateToNew(e.target.value)}
                      defaultValue=""
                    >
                      <option value="">— Selecionar template —</option>
                      {filteredTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.default_amount ? ` (${formatCurrencyBRL(t.default_amount)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="fm-form-row">
                  <label className="fm-form-label">Categoria</label>
                  {categories.length > 0 ? (
                    <select
                      className="fm-form-select"
                      value={newItemForm.category ?? ''}
                      onChange={(e) => setNewItemForm((p) => ({ ...p, category: e.target.value }))}
                    >
                      <option value="">— Selecionar —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="fm-form-input"
                      value={newItemForm.category ?? ''}
                      onChange={(e) => setNewItemForm((p) => ({ ...p, category: e.target.value }))}
                      placeholder="Categoria"
                    />
                  )}
                </div>
                <div className="fm-form-row">
                  <label className="fm-form-label">Nome do item *</label>
                  <input
                    className="fm-form-input"
                    value={newItemForm.item_name ?? ''}
                    onChange={(e) => setNewItemForm((p) => ({ ...p, item_name: e.target.value }))}
                    placeholder="Ex: Kit Fotovoltaico"
                    autoFocus
                  />
                </div>
                <div className="fm-form-row">
                  <label className="fm-form-label">Quantidade</label>
                  <input
                    type="number"
                    className="fm-form-input"
                    value={newItemForm.expected_quantity ?? ''}
                    onChange={(e) =>
                      setNewItemForm((p) => ({
                        ...p,
                        expected_quantity: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="1"
                    min="0"
                  />
                </div>
                <div className="fm-form-row">
                  <label className="fm-form-label">Valor unitário (R$)</label>
                  <input
                    type="number"
                    className="fm-form-input"
                    value={newItemForm.expected_amount ?? ''}
                    onChange={(e) =>
                      setNewItemForm((p) => ({
                        ...p,
                        expected_amount: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="0,00"
                    min="0"
                    step="0.01"
                  />
                </div>
                {(newItemForm.expected_quantity == null || newItemForm.expected_amount == null) ? (
                  <div className="fm-form-row">
                    <label className="fm-form-label">Total previsto (R$)</label>
                    <input
                      type="number"
                      className="fm-form-input"
                      value={newItemForm.expected_total ?? ''}
                      onChange={(e) =>
                        setNewItemForm((p) => ({
                          ...p,
                          expected_total: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                      placeholder="0,00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                ) : (
                  <div className="fm-form-row">
                    <label className="fm-form-label">Total calculado</label>
                    <span className="fm-op-computed-total">
                      {formatCurrencyBRL((newItemForm.expected_quantity ?? 0) * (newItemForm.expected_amount ?? 0))}
                    </span>
                  </div>
                )}
                <div className="fm-form-row">
                  <label className="fm-form-label">Observações</label>
                  <input
                    className="fm-form-input"
                    value={newItemForm.notes ?? ''}
                    onChange={(e) => setNewItemForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
                <div className="fm-op-add-form-actions">
                  <button type="button" className="primary" onClick={() => void handleAddItem()} disabled={isSaving}>
                    {isSaving ? 'Salvando…' : 'Salvar item'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setIsAddingItem(false)
                      setNewItemForm(EMPTY_ITEM_FORM)
                      setSaveError(null)
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Operational item table */}
          {items.length === 0 && !isAddingItem ? (
            <div className="fm-empty">
              <p>Este projeto ainda não tem itens financeiros cadastrados.</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button type="button" className="primary" onClick={() => setIsAddingItem(true)}>
                  + Adicionar item
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void handleBootstrap()}
                  disabled={bootstrapLoading}
                >
                  {bootstrapLoading ? 'Gerando…' : '⚙ Gerar estrutura padrão'}
                </button>
              </div>
            </div>
          ) : (
            <table className="fm-table fm-op-table">
              <thead>
                <tr>
                  <th>Natureza</th>
                  <th>Categoria</th>
                  <th>Item</th>
                  <th>Qtd.</th>
                  <th>Vlr Unit.</th>
                  <th>Total Prev.</th>
                  <th>Obs.</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {/* ── Costs group ── */}
                {costItems.length > 0 || revenueItems.length > 0 ? (
                  <tr className="fm-op-group-header">
                    <td colSpan={8}>
                      💸 Custos ({costItems.length} {costItems.length === 1 ? 'item' : 'itens'}) —{' '}
                      <strong>{formatCurrencyBRL(costTotal)}</strong>
                    </td>
                  </tr>
                ) : null}
                {costItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isEditing={editingId === item.id}
                    editForm={editForm}
                    onChangeEditForm={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={() => void handleSaveEdit()}
                    onCancelEdit={handleCancelEdit}
                    onDelete={() => void handleDelete(item.id)}
                    isSaving={isSaving}
                  />
                ))}
                {costItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="fm-op-group-empty">
                      Nenhum custo cadastrado.{' '}
                      <button
                        type="button"
                        className="ghost"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => {
                          setNewItemNature('expense')
                          setIsAddingItem(true)
                        }}
                      >
                        + Adicionar custo
                      </button>
                    </td>
                  </tr>
                ) : null}

                {/* ── Revenue group ── */}
                <tr className="fm-op-group-header">
                  <td colSpan={8}>
                    💰 Receitas ({revenueItems.length} {revenueItems.length === 1 ? 'item' : 'itens'}) —{' '}
                    <strong>{formatCurrencyBRL(revenueTotal)}</strong>
                  </td>
                </tr>
                {revenueItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isEditing={editingId === item.id}
                    editForm={editForm}
                    onChangeEditForm={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={() => void handleSaveEdit()}
                    onCancelEdit={handleCancelEdit}
                    onDelete={() => void handleDelete(item.id)}
                    isSaving={isSaving}
                  />
                ))}
                {revenueItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="fm-op-group-empty">
                      Nenhuma receita cadastrada.{' '}
                      <button
                        type="button"
                        className="ghost"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => {
                          setNewItemNature('income')
                          setIsAddingItem(true)
                        }}
                      >
                        + Adicionar receita
                      </button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="fm-op-totals-row">
                  <td colSpan={5}>
                    <strong>Totais do Projeto</strong>
                  </td>
                  <td colSpan={2}>
                    <div>
                      Custos: <span className="fm-value--negative">{formatCurrencyBRL(costTotal)}</span>
                    </div>
                    <div>
                      Receitas: <span className="fm-value--positive">{formatCurrencyBRL(revenueTotal)}</span>
                    </div>
                    <div>
                      Saldo:{' '}
                      <span className={totals.saldoPrevisto >= 0 ? 'fm-value--positive' : 'fm-value--negative'}>
                        {formatCurrencyBRL(totals.saldoPrevisto)}
                      </span>
                    </div>
                    {totals.margem !== null ? (
                      <div>
                        Margem: <span>{formatPct(totals.margem)}</span>
                      </div>
                    ) : null}
                  </td>
                  <td colSpan={1} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cashflow Tab
// ─────────────────────────────────────────────────────────────────────────────

function CashflowTab({ cashflow, error, onRetry }: { cashflow: CashflowPeriod[]; error: string | null; onRetry: () => void }) {
  if (error) return <SectionError message={error} onRetry={onRetry} />
  return (
    <div className="fm-cashflow">
      {cashflow.length === 0 ? (
        <div className="fm-empty">Sem dados de fluxo de caixa para exibir.</div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Saldo Líquido</th>
                <th>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {cashflow.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.period_label}</td>
                  <td className="fm-value--positive">{formatCurrencyBRL(row.total_income)}</td>
                  <td className="fm-value--negative">{formatCurrencyBRL(row.total_expense)}</td>
                  <td className={row.net >= 0 ? 'fm-value--positive' : 'fm-value--negative'}>
                    {formatCurrencyBRL(row.net)}
                  </td>
                  <td className={row.cumulative >= 0 ? 'fm-value--positive' : 'fm-value--negative'}>
                    {formatCurrencyBRL(row.cumulative)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Entries Tab
// ─────────────────────────────────────────────────────────────────────────────

interface EntriesTabProps {
  entries: FinancialEntry[]
  error: string | null
  onRetry: () => void
  categories: FinancialCategory[]
  onNew: () => void
  onEdit: (entry: FinancialEntry) => void
  onDelete: (id: string) => void
  isDeleting: boolean
}

function EntriesTab({ entries, error, onRetry, categories: _categories, onNew, onEdit, onDelete, isDeleting }: EntriesTabProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter && e.entry_type !== typeFilter) return false
      if (statusFilter && e.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          e.description?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.subcategory?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [entries, search, typeFilter, statusFilter])

  return (
    <div className="fm-entries">
      <div className="fm-entries-header">
        <div className="fm-filters">
          <input
            type="search"
            className="fm-filter-input"
            placeholder="Buscar descrição, categoria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="fm-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </select>
          <select className="fm-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button type="button" className="primary" onClick={onNew}>
          + Novo Lançamento
        </button>
      </div>
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <div className="fm-empty">
          <p>Nenhum lançamento encontrado.</p>
          <button
            type="button"
            className="primary"
            onClick={onNew}
            data-testid="fm-empty-new-entry-cta"
          >
            + Novo Lançamento
          </button>
        </div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Competência</th>
                <th>Status</th>
                <th>Recorrente</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className={`fm-badge fm-badge--${e.entry_type}`}>
                      {ENTRY_TYPE_LABELS[e.entry_type] ?? e.entry_type}
                    </span>
                  </td>
                  <td>{e.category ?? '—'}{e.subcategory ? ` / ${e.subcategory}` : ''}</td>
                  <td>{e.description ?? '—'}</td>
                  <td className={e.entry_type === 'income' ? 'fm-value--positive' : 'fm-value--negative'}>
                    {formatCurrencyBRL(e.amount)}
                  </td>
                  <td>{formatDate(e.competence_date)}</td>
                  <td>
                    <span className={`fm-badge fm-badge--status-${e.status}`}>
                      {STATUS_LABELS[e.status] ?? e.status}
                    </span>
                  </td>
                  <td>{e.is_recurring ? 'Sim' : 'Não'}</td>
                  <td className="fm-actions-cell">
                    <button type="button" className="ghost fm-action-btn" onClick={() => onEdit(e)}>
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="ghost fm-action-btn fm-action-btn--danger"
                      onClick={() => onDelete(e.id)}
                      disabled={isDeleting}
                      aria-label={`Excluir lançamento ${e.description ?? ''}`}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Leasing Tab
// ─────────────────────────────────────────────────────────────────────────────

function LeasingTab({ projects, error, onRetry }: { projects: FinancialProject[]; error: string | null; onRetry: () => void }) {
  // useMemo must be called before any conditional return to satisfy Rules of Hooks.
  const leasingProjects = useMemo(() => (error ? [] : projects.filter((p) => p.project_kind === 'leasing')), [projects, error])

  const totals = useMemo(() => {
    const totalMrr = leasingProjects.reduce((sum, p) => sum + (p.monthly_revenue ?? 0), 0)
    const totalProjectedRevenue = leasingProjects.reduce((sum, p) => sum + (p.projected_revenue ?? 0), 0)
    const totalCapex = leasingProjects.reduce((sum, p) => sum + (p.capex_total ?? 0), 0)
    const avgRoi = leasingProjects.length > 0
      ? leasingProjects.reduce((sum, p) => sum + (p.roi_percent ?? 0), 0) / leasingProjects.length
      : null
    const avgPayback = leasingProjects.length > 0
      ? leasingProjects.reduce((sum, p) => sum + (p.payback_months ?? 0), 0) / leasingProjects.length
      : null
    return { totalMrr, totalProjectedRevenue, totalCapex, avgRoi, avgPayback }
  }, [leasingProjects])

  if (error) return <SectionError message={error} onRetry={onRetry} />

  return (
    <div className="fm-leasing">
      <div className="fm-kpi-grid">
        <KpiCard label="Contratos Ativos" value={String(leasingProjects.length)} icon="📋" />
        <KpiCard label="MRR Total" value={formatCurrencyBRL(totals.totalMrr)} icon="🔄" color="green" subtitle="Mensalidade recorrente" />
        <KpiCard label="Receita Proj. Total" value={formatCurrencyBRL(totals.totalProjectedRevenue)} icon="📈" color="green" />
        <KpiCard label="CAPEX Total" value={formatCurrencyBRL(totals.totalCapex)} icon="💸" color="red" />
        <KpiCard label="ROI Médio" value={formatPct(totals.avgRoi)} icon="📊" />
        <KpiCard label="Payback Médio" value={formatMonths(totals.avgPayback)} icon="⏱️" />
      </div>
      {leasingProjects.length === 0 ? (
        <div className="fm-empty">Nenhum projeto de leasing disponível.</div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Mensalidade</th>
                <th>Receita Proj.</th>
                <th>CAPEX</th>
                <th>ROI</th>
                <th>Payback</th>
                <th>Inadimpl.</th>
                <th>Status</th>
                <th>UF</th>
              </tr>
            </thead>
            <tbody>
              {leasingProjects.map((p) => (
                <tr key={p.id}>
                  <td>{p.client_name ?? '—'}</td>
                  <td>{formatCurrencyBRL(p.monthly_revenue)}</td>
                  <td>{formatCurrencyBRL(p.projected_revenue)}</td>
                  <td>{formatCurrencyBRL(p.capex_total)}</td>
                  <td>{formatPct(p.roi_percent)}</td>
                  <td>{formatMonths(p.payback_months)}</td>
                  <td>{formatPct(p.default_rate_percent)}</td>
                  <td>{p.status ?? '—'}</td>
                  <td>{p.uf ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Tab
// ─────────────────────────────────────────────────────────────────────────────

function SalesTab({ projects, error, onRetry }: { projects: FinancialProject[]; error: string | null; onRetry: () => void }) {
  // useMemo must be called before any conditional return to satisfy Rules of Hooks.
  const saleProjects = useMemo(() => (error ? [] : projects.filter((p) => p.project_kind === 'sale' || p.project_kind === 'buyout')), [projects, error])

  const totals = useMemo(() => {
    const totalRevenue = saleProjects.reduce((sum, p) => sum + (p.realized_revenue ?? p.projected_revenue ?? 0), 0)
    const totalCapex = saleProjects.reduce((sum, p) => sum + (p.capex_total ?? 0), 0)
    const totalProfit = saleProjects.reduce((sum, p) => sum + (p.projected_profit ?? 0), 0)
    const avgMargin = saleProjects.length > 0
      ? saleProjects.reduce((sum, p) => sum + (p.roi_percent ?? 0), 0) / saleProjects.length
      : null
    const ticketMedio = saleProjects.length > 0 ? totalRevenue / saleProjects.length : null
    return { totalRevenue, totalCapex, totalProfit, avgMargin, ticketMedio }
  }, [saleProjects])

  if (error) return <SectionError message={error} onRetry={onRetry} />

  return (
    <div className="fm-sales">
      <div className="fm-kpi-grid">
        <KpiCard label="Vendas Realizadas" value={String(saleProjects.length)} icon="🤝" />
        <KpiCard label="Receita Total" value={formatCurrencyBRL(totals.totalRevenue)} icon="💵" color="green" />
        <KpiCard label="CAPEX Total" value={formatCurrencyBRL(totals.totalCapex)} icon="💸" color="red" />
        <KpiCard label="Lucro Total" value={formatCurrencyBRL(totals.totalProfit)} icon="💰" color={totals.totalProfit >= 0 ? 'green' : 'red'} />
        <KpiCard label="Margem Média" value={formatPct(totals.avgMargin)} icon="📊" />
        <KpiCard label="Ticket Médio" value={formatCurrencyBRL(totals.ticketMedio)} icon="🎫" />
      </div>
      {saleProjects.length === 0 ? (
        <div className="fm-empty">Nenhum projeto de venda disponível.</div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Receita</th>
                <th>CAPEX</th>
                <th>Lucro Est.</th>
                <th>Margem</th>
                <th>Comissão</th>
                <th>Status</th>
                <th>UF</th>
              </tr>
            </thead>
            <tbody>
              {saleProjects.map((p) => (
                <tr key={p.id}>
                  <td>{p.client_name ?? '—'}</td>
                  <td>
                    <span className={`fm-badge fm-badge--${p.project_kind}`}>
                      {PROJECT_KIND_LABELS[p.project_kind] ?? p.project_kind}
                    </span>
                  </td>
                  <td>{formatCurrencyBRL(p.realized_revenue ?? p.projected_revenue)}</td>
                  <td>{formatCurrencyBRL(p.capex_total)}</td>
                  <td>{formatCurrencyBRL(p.projected_profit)}</td>
                  <td>{formatPct(p.roi_percent)}</td>
                  <td>{formatCurrencyBRL(p.commission_amount)}</td>
                  <td>{p.status ?? '—'}</td>
                  <td>{p.uf ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function FinancialManagementPage({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // ── project detail navigation ──
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null)

  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [projects, setProjects] = useState<FinancialProject[]>([])
  const [projectsError, setProjectsError] = useState<string | null>(null)

  // ── per-project operational summaries (new endpoint) ──
  const [projectSummaries, setProjectSummaries] = useState<FinancialProjectSummary[]>([])
  const [projectSummariesError, setProjectSummariesError] = useState<string | null>(null)

  const [cashflow, setCashflow] = useState<CashflowPeriod[]>([])
  const [cashflowError, setCashflowError] = useState<string | null>(null)

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [templates, setTemplates] = useState<FinancialItemTemplate[]>([])
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)

  const [showEntryForm, setShowEntryForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null)
  const [isSavingEntry, setIsSavingEntry] = useState(false)
  const [isDeletingEntry, setIsDeletingEntry] = useState(false)

  const getPeriodParams = useCallback(() => {
    const now = new Date()
    if (periodFilter === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10)
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10)
      return { from, to }
    }
    if (periodFilter === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      const from = new Date(now.getFullYear(), q * 3, 1).toISOString().substring(0, 10)
      const to = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().substring(0, 10)
      return { from, to }
    }
    if (periodFilter === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined }
    }
    // year
    const from = new Date(now.getFullYear(), 0, 1).toISOString().substring(0, 10)
    const to = new Date(now.getFullYear(), 11, 31).toISOString().substring(0, 10)
    return { from, to }
  }, [periodFilter, customFrom, customTo])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    // Clear per-section errors before reload
    setSummaryError(null)
    setProjectsError(null)
    setProjectSummariesError(null)
    setCashflowError(null)
    setEntriesError(null)

    const params = getPeriodParams()

    // Load each section independently so one failure doesn't break the whole page
    const [summaryRes, projectsRes, projectSummariesRes, cashflowRes, entriesRes, categoriesRes, templatesRes] =
      await Promise.allSettled([
        fetchFinancialSummary(params),
        fetchFinancialProjects(params),
        fetchFinancialProjectSummaries(),
        fetchFinancialCashflow(params),
        fetchFinancialEntries(params),
        fetchFinancialCategories(),
        fetchFinancialItemTemplates(),
      ])

    if (summaryRes.status === 'fulfilled') {
      setSummary(summaryRes.value)
    } else {
      console.error('[financial-management] summary error', summaryRes.reason)
      setSummaryError(summaryRes.reason instanceof Error ? summaryRes.reason.message : 'Erro ao carregar indicadores.')
    }

    if (projectsRes.status === 'fulfilled') {
      setProjects(projectsRes.value)
    } else {
      console.error('[financial-management] projects error', projectsRes.reason)
      setProjectsError(projectsRes.reason instanceof Error ? projectsRes.reason.message : 'Erro ao carregar projetos.')
    }

    if (projectSummariesRes.status === 'fulfilled') {
      setProjectSummaries(projectSummariesRes.value)
    } else {
      console.error('[financial-management] project-summaries error', projectSummariesRes.reason)
      setProjectSummariesError(
        projectSummariesRes.reason instanceof Error ? projectSummariesRes.reason.message : 'Erro ao carregar resumos.',
      )
    }

    if (cashflowRes.status === 'fulfilled') {
      setCashflow(cashflowRes.value)
    } else {
      console.error('[financial-management] cashflow error', cashflowRes.reason)
      setCashflowError(cashflowRes.reason instanceof Error ? cashflowRes.reason.message : 'Erro ao carregar fluxo de caixa.')
    }

    if (entriesRes.status === 'fulfilled') {
      setEntries(entriesRes.value)
    } else {
      console.error('[financial-management] entries error', entriesRes.reason)
      setEntriesError(entriesRes.reason instanceof Error ? entriesRes.reason.message : 'Erro ao carregar lançamentos.')
    }

    if (categoriesRes.status === 'fulfilled') {
      setCategories(categoriesRes.value)
    } else {
      console.error('[financial-management] categories error', categoriesRes.reason)
      // categories are non-critical; leave existing list intact
    }

    if (templatesRes.status === 'fulfilled') {
      setTemplates(templatesRes.value)
    } else {
      console.error('[financial-management] templates error', templatesRes.reason)
      // templates are non-critical
    }

    setIsLoading(false)
  }, [getPeriodParams])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Single source of truth for opening the entry drawer.
  // Both the page-header CTA and any empty-state CTAs call this.
  const handleOpenFinancialEntryDrawer = useCallback(() => {
    console.info('[financial-ui] new-entry button click')
    console.info('[financial-ui] open new-entry drawer')
    setEditingEntry(null)
    setShowEntryForm(true)
  }, [])

  // Backwards-compatible alias used by existing call sites.
  const handleNewEntry = handleOpenFinancialEntryDrawer

  const handleEditEntry = useCallback((entry: FinancialEntry) => {
    setEditingEntry(entry)
    setShowEntryForm(true)
  }, [])

  const handleSaveEntry = useCallback(async (data: FinancialEntryInput) => {
    setIsSavingEntry(true)
    try {
      if (editingEntry) {
        await updateFinancialEntry(editingEntry.id, data)
      } else {
        await createFinancialEntry(data)
      }
      setShowEntryForm(false)
      setEditingEntry(null)
      await loadData()
    } catch (err) {
      console.error('[financial-management] saveEntry error', err)
    } finally {
      setIsSavingEntry(false)
    }
  }, [editingEntry, loadData])

  const handleDeleteEntry = useCallback(async (id: string) => {
    if (!window.confirm('Deseja excluir este lançamento?')) return
    setIsDeletingEntry(true)
    try {
      await deleteFinancialEntry(id)
      await loadData()
    } catch (err) {
      console.error('[financial-management] deleteEntry error', err)
    } finally {
      setIsDeletingEntry(false)
    }
  }, [loadData])

  const handleCloseForm = useCallback(() => {
    setShowEntryForm(false)
    setEditingEntry(null)
  }, [])

  // ── per-project navigation ──
  const handleOpenProject = useCallback((proposalId: string) => {
    setSelectedProposalId(proposalId)
  }, [])

  const handleCloseProject = useCallback(() => {
    setSelectedProposalId(null)
    void loadData()
  }, [loadData])

  /**
   * Generates the planned financial structure (project_financial_items)
   * from a proposal's payload_json. Prompts the user for the proposal id.
   * Wired into the page-header "Gerar estrutura" CTA.
   */
  const handleBootstrapStructure = useCallback(async () => {
    const proposalId = window.prompt(
      'ID da proposta (UUID) para gerar a estrutura financeira prevista:',
      '',
    )?.trim()
    if (!proposalId) return
    setBootstrapStatus('Gerando estrutura financeira do projeto…')
    try {
      const result = await bootstrapProjectFinancialStructure(proposalId)
      setBootstrapStatus(
        `Estrutura criada (${result.project_kind}): ${result.created_count} item(ns) previsto(s) gerado(s).`,
      )
      await loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error('[financial-management] bootstrap error', err)
      setBootstrapStatus(`Falha ao gerar estrutura: ${msg}`)
    }
  }, [loadData])

  const TABS: Tab[] = ['overview', 'projects', 'cashflow', 'entries', 'leasing', 'sales']

  return (
    <div className="fm-page">
      {/* Header */}
      <div className="fm-page-header">
        <div className="fm-page-header-left">
          <button type="button" className="ghost fm-back-btn" onClick={onBack}>
            ← Voltar
          </button>
          <div>
            <h1 className="fm-page-title">💰 Gestão Financeira</h1>
            <p className="fm-page-subtitle">Central de monitoramento e análise financeira da SolarInvest</p>
          </div>
        </div>
        <div className="fm-page-header-right">
          <div className="fm-period-filters">
            {(['month', 'quarter', 'year', 'custom'] as PeriodFilter[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`fm-period-btn${periodFilter === p ? ' active' : ''}`}
                onClick={() => setPeriodFilter(p)}
              >
                {p === 'month' ? 'Mês' : p === 'quarter' ? 'Trimestre' : p === 'year' ? 'Ano' : 'Personalizado'}
              </button>
            ))}
          </div>
          {periodFilter === 'custom' ? (
            <div className="fm-custom-period">
              <input
                type="date"
                className="fm-filter-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="Data inicial"
              />
              <span>até</span>
              <input
                type="date"
                className="fm-filter-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Data final"
              />
              <button type="button" className="primary" onClick={() => void loadData()}>
                Aplicar
              </button>
            </div>
          ) : null}
          {/* Always-visible global CTAs (work from any tab) */}
          <button
            type="button"
            className="primary"
            onClick={handleOpenFinancialEntryDrawer}
            data-testid="fm-new-entry-cta"
          >
            + Novo Lançamento
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => { void handleBootstrapStructure() }}
            title="Gera a composição prevista (custos e receitas) a partir da proposta"
          >
            ⚙ Gerar estrutura do projeto
          </button>
        </div>
      </div>

      {bootstrapStatus ? (
        <div className="fm-error" role="status" style={{ marginBottom: 12 }}>
          {bootstrapStatus}
          <button type="button" className="ghost" onClick={() => setBootstrapStatus(null)}>
            Fechar
          </button>
        </div>
      ) : null}

      {/* ── When a project is selected, show its detail view instead of tabs ── */}
      {selectedProposalId ? (
        <div className="fm-tab-content">
          <ProjectDetailView
            proposalId={selectedProposalId}
            onBack={handleCloseProject}
            categories={categories}
            templates={templates}
          />
        </div>
      ) : (
        <>
          {/* Aggregate summary cards (visible above tabs when summaries are available) */}
          <FinancialProjectsSummaryCards summaries={projectSummaries} />

          {/* Tab Bar */}
          <div className="fm-tab-bar" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`fm-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="fm-tab-content" role="tabpanel">
            {isLoading ? (
              <div className="fm-loading">
                <span className="fm-loading-spinner" aria-hidden="true" />
                Carregando dados financeiros…
              </div>
            ) : (
              <>
                {activeTab === 'overview' && <OverviewTab summary={summary} error={summaryError} onRetry={() => void loadData()} />}
                {activeTab === 'projects' && (
                  <OperationalProjectsTab
                    summaries={projectSummaries}
                    error={projectSummariesError}
                    onRetry={() => void loadData()}
                    onOpenProject={handleOpenProject}
                  />
                )}
                {activeTab === 'cashflow' && <CashflowTab cashflow={cashflow} error={cashflowError} onRetry={() => void loadData()} />}
                {activeTab === 'entries' && (
                  <EntriesTab
                    entries={entries}
                    error={entriesError}
                    onRetry={() => void loadData()}
                    categories={categories}
                    onNew={handleNewEntry}
                    onEdit={handleEditEntry}
                    onDelete={(id) => { void handleDeleteEntry(id) }}
                    isDeleting={isDeletingEntry}
                  />
                )}
                {activeTab === 'leasing' && <LeasingTab projects={projects} error={projectsError} onRetry={() => void loadData()} />}
                {activeTab === 'sales' && <SalesTab projects={projects} error={projectsError} onRetry={() => void loadData()} />}
              </>
            )}
          </div>
        </>
      )}

      {/* Entry Form Drawer */}
      {showEntryForm ? (
        <EntryForm
          entry={editingEntry}
          categories={categories}
          templates={templates}
          onSave={handleSaveEntry}
          onClose={handleCloseForm}
          isSaving={isSavingEntry}
        />
      ) : null}
    </div>
  )
}
