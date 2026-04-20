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
  type FinancialSummary,
  type FinancialProject,
  type CashflowPeriod,
  type FinancialEntry,
  type FinancialCategory,
  type FinancialEntryInput,
  type FinancialItemTemplate,
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
// Projects Tab
// ─────────────────────────────────────────────────────────────────────────────

function ProjectsTab({ projects, error, onRetry }: { projects: FinancialProject[]; error: string | null; onRetry: () => void }) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // useMemo must be called before any conditional return to satisfy Rules of Hooks.
  const filtered = useMemo(() => {
    if (error) return []
    return projects.filter((p) => {
      if (kindFilter && p.project_kind !== kindFilter) return false
      if (statusFilter && p.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          p.client_name?.toLowerCase().includes(q) ||
          p.consultant_name?.toLowerCase().includes(q) ||
          p.uf?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [projects, search, kindFilter, statusFilter, error])

  if (error) return <SectionError message={error} onRetry={onRetry} />

  return (
    <div className="fm-projects">
      <div className="fm-filters">
        <input
          type="search"
          className="fm-filter-input"
          placeholder="Buscar cliente, consultor, UF…"
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
          <option value="active">Ativo</option>
          <option value="implanting">Em implantação</option>
          <option value="commissioned">Comissionado</option>
          <option value="closed">Encerrado</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="fm-empty">Nenhum projeto encontrado com os filtros aplicados.</div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>CAPEX</th>
                <th>Receita Proj.</th>
                <th>Receita Real.</th>
                <th>Lucro Est.</th>
                <th>ROI</th>
                <th>Payback</th>
                <th>Consultor</th>
                <th>UF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.client_name ?? '—'}</td>
                  <td>
                    <span className={`fm-badge fm-badge--${p.project_kind}`}>
                      {PROJECT_KIND_LABELS[p.project_kind] ?? p.project_kind}
                    </span>
                  </td>
                  <td>{p.status ?? '—'}</td>
                  <td>{formatCurrencyBRL(p.capex_total)}</td>
                  <td>{formatCurrencyBRL(p.projected_revenue)}</td>
                  <td>{formatCurrencyBRL(p.realized_revenue)}</td>
                  <td>{formatCurrencyBRL(p.projected_profit)}</td>
                  <td>{formatPct(p.roi_percent)}</td>
                  <td>{formatMonths(p.payback_months)}</td>
                  <td>{p.consultant_name ?? '—'}</td>
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

  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [projects, setProjects] = useState<FinancialProject[]>([])
  const [projectsError, setProjectsError] = useState<string | null>(null)

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
    setCashflowError(null)
    setEntriesError(null)

    const params = getPeriodParams()

    // Load each section independently so one failure doesn't break the whole page
    const [summaryRes, projectsRes, cashflowRes, entriesRes, categoriesRes, templatesRes] = await Promise.allSettled([
      fetchFinancialSummary(params),
      fetchFinancialProjects(params),
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
            {activeTab === 'projects' && <ProjectsTab projects={projects} error={projectsError} onRetry={() => void loadData()} />}
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
