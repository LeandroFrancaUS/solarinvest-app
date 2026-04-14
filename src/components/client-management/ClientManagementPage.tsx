// src/components/client-management/ClientManagementPage.tsx
// Main Gestão de Clientes V2 page.
// Requires role_admin, role_office, or role_financeiro.
// role_comercial sees a 403 page.

import * as React from 'react'
import type {
  ManagedClientListRow,
  ManagedClientListResult,
  ClientManagementDetail,
  ClientManagementFilters,
  ClientManagementTab,
  LifecycleStatus,
  PortfolioSummary,
} from '../../types/clientManagement'
import {
  listManagedClients,
  getClientManagementDetail,
  patchClientLifecycle,
  patchClientProject,
  createClientNote,
  listClientNotes,
  createClientReminder,
  listClientReminders,
  patchClientReminder,
  getPortfolioSummary,
} from '../../lib/api/clientManagementApi'
import { computeClientFinancialSummary } from '../../services/clientFinancialEngineAdapter'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function lifecycleLabel(status: LifecycleStatus | null | undefined): string {
  const map: Record<LifecycleStatus, string> = {
    lead: 'Lead',
    negotiating: 'Em negociação',
    contracted: 'Contratado',
    active: 'Ativo',
    suspended: 'Suspenso',
    cancelled: 'Cancelado',
    completed: 'Encerrado',
  }
  return status ? (map[status] ?? status) : '—'
}

function lifecycleBadgeClass(status: LifecycleStatus | null | undefined): string {
  if (!status) return 'badge badge--neutral'
  const map: Record<LifecycleStatus, string> = {
    lead: 'badge badge--neutral',
    negotiating: 'badge badge--info',
    contracted: 'badge badge--warning',
    active: 'badge badge--success',
    suspended: 'badge badge--warning',
    cancelled: 'badge badge--danger',
    completed: 'badge badge--neutral',
  }
  return map[status] ?? 'badge badge--neutral'
}

function delinquencyBadgeClass(status: string | null | undefined): string {
  if (!status || status === 'none') return ''
  const map: Record<string, string> = {
    warning: 'badge badge--warning',
    delinquent: 'badge badge--danger',
    collection: 'badge badge--danger',
  }
  return map[status] ?? 'badge badge--neutral'
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function KpiCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`kpi${highlight ? ' kpi-highlight' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function OverviewTab({ detail }: { detail: ClientManagementDetail }) {
  const { client, lifecycle, energy, project, billing, contracts } = detail
  const activeContract = contracts.find((c) => c.contract_status === 'active' || c.contract_status === 'signed') ?? contracts[0] ?? null
  const financial = computeClientFinancialSummary(energy, activeContract)

  return (
    <div className="cm-tab-content">
      <div className="cm-summary-grid">
        <div className="cm-summary-card">
          <div className="cm-summary-card-header">
            <h4>Dados financeiros</h4>
          </div>
          <dl className="cm-data-list">
            <dt>Mensalidade base</dt>
            <dd>{formatCurrency(financial.mensalidade_base)}</dd>
            <dt>Prazo contratual</dt>
            <dd>{financial.prazo_meses ? `${financial.prazo_meses} meses` : '—'}</dd>
            <dt>Total previsto</dt>
            <dd>{formatCurrency(financial.total_previsto)}</dd>
            <dt>Potência</dt>
            <dd>{financial.potencia_kwp ? `${financial.potencia_kwp} kWp` : '—'}</dd>
            <dt>Consumo contratado</dt>
            <dd>{financial.kwh_contratado ? `${financial.kwh_contratado} kWh/mês` : '—'}</dd>
            <dt>Desconto aplicado</dt>
            <dd>{financial.desconto_percentual !== null ? `${financial.desconto_percentual}%` : '—'}</dd>
            <dt>Meses restantes</dt>
            <dd>{financial.meses_restantes !== null ? `${financial.meses_restantes} meses` : '—'}</dd>
            <dt>Receita restante</dt>
            <dd>{formatCurrency(financial.receita_restante)}</dd>
            {financial.roi_simples_percent !== null ? (
              <>
                <dt>ROI (referência)</dt>
                <dd>{financial.roi_simples_percent.toFixed(1)}%</dd>
              </>
            ) : null}
          </dl>
        </div>

        <div className="cm-summary-card">
          <div className="cm-summary-card-header">
            <h4>Contrato ativo</h4>
          </div>
          {activeContract ? (
            <dl className="cm-data-list">
              <dt>Tipo</dt>
              <dd>{activeContract.contract_type === 'leasing' ? 'Leasing' : 'Venda'}</dd>
              <dt>Status</dt>
              <dd><span className="badge badge--info">{activeContract.contract_status}</span></dd>
              <dt>Assinado em</dt>
              <dd>{formatDate(activeContract.contract_signed_at)}</dd>
              <dt>Início do contrato</dt>
              <dd>{formatDate(activeContract.contract_start_date)}</dd>
              <dt>Início da cobrança</dt>
              <dd>{formatDate(activeContract.billing_start_date)}</dd>
              <dt>Encerramento previsto</dt>
              <dd>{formatDate(activeContract.expected_billing_end_date)}</dd>
              <dt>Elegível para buy out</dt>
              <dd>{activeContract.buyout_eligible ? '✅ Sim' : 'Não'}</dd>
              {activeContract.buyout_amount_reference ? (
                <>
                  <dt>Valor de referência buy out</dt>
                  <dd>{formatCurrency(activeContract.buyout_amount_reference)}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="cm-empty-state">Nenhum contrato cadastrado.</p>
          )}
        </div>

        <div className="cm-summary-card">
          <div className="cm-summary-card-header">
            <h4>Projeto / Implantação</h4>
          </div>
          {project ? (
            <dl className="cm-data-list">
              <dt>Status do projeto</dt>
              <dd><span className="badge badge--info">{project.project_status}</span></dd>
              <dt>Instalação</dt>
              <dd>{project.installation_status ?? '—'}</dd>
              <dt>Engenharia</dt>
              <dd>{project.engineering_status ?? '—'}</dd>
              <dt>Homologação</dt>
              <dd>{project.homologation_status ?? '—'}</dd>
              <dt>Comissionamento</dt>
              <dd>{formatDate(project.commissioning_date)}</dd>
              <dt>1ª injeção</dt>
              <dd>{formatDate(project.first_injection_date)}</dd>
              <dt>Go-live previsto</dt>
              <dd>{formatDate(project.expected_go_live_date)}</dd>
              {project.integrator_name ? (
                <>
                  <dt>Integrador</dt>
                  <dd>{project.integrator_name}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="cm-empty-state">Status de projeto não cadastrado.</p>
          )}
        </div>

        <div className="cm-summary-card">
          <div className="cm-summary-card-header">
            <h4>Cobrança</h4>
          </div>
          {billing ? (
            <dl className="cm-data-list">
              <dt>Status de pagamento</dt>
              <dd><span className="badge badge--info">{billing.payment_status}</span></dd>
              {billing.delinquency_status && billing.delinquency_status !== 'none' ? (
                <>
                  <dt>Inadimplência</dt>
                  <dd><span className={delinquencyBadgeClass(billing.delinquency_status)}>{billing.delinquency_status}</span></dd>
                </>
              ) : null}
              <dt>Dia de vencimento</dt>
              <dd>{billing.due_day ?? '—'}</dd>
              <dt>Primeiro vencimento</dt>
              <dd>{formatDate(billing.first_billing_date)}</dd>
              <dt>Encerramento previsto</dt>
              <dd>{formatDate(billing.expected_last_billing_date)}</dd>
              <dt>Recorrência</dt>
              <dd>{billing.recurrence_type}</dd>
              <dt>Lembrete automático</dt>
              <dd>{billing.auto_reminder_enabled ? '✅ Ativo' : 'Inativo'}</dd>
            </dl>
          ) : (
            <p className="cm-empty-state">Perfil de cobrança não cadastrado.</p>
          )}
        </div>
      </div>

      {/* Client basic info */}
      <div className="cm-summary-card cm-summary-card--full">
        <div className="cm-summary-card-header">
          <h4>Dados cadastrais</h4>
        </div>
        <dl className="cm-data-list cm-data-list--inline">
          <dt>E-mail</dt><dd>{client.email ?? '—'}</dd>
          <dt>Telefone</dt><dd>{client.phone ?? '—'}</dd>
          <dt>Cidade/UF</dt><dd>{[client.city, client.state].filter(Boolean).join(' / ') || '—'}</dd>
          <dt>CPF/CNPJ</dt><dd>{client.cpf_raw ?? client.cnpj_raw ?? client.document ?? '—'}</dd>
          <dt>UC</dt><dd>{client.uc ?? '—'}</dd>
          <dt>Distribuidora</dt><dd>{client.distribuidora ?? '—'}</dd>
          <dt>Status do ciclo de vida</dt><dd><span className={lifecycleBadgeClass(lifecycle?.lifecycle_status)}>{lifecycleLabel(lifecycle?.lifecycle_status)}</span></dd>
          <dt>Convertido em</dt><dd>{formatDate(lifecycle?.converted_at)}</dd>
          {client.owner_display_name ? (
            <>
              <dt>Consultor responsável</dt>
              <dd>{client.owner_display_name}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  )
}

function ProjectTab({ detail, isReadOnly, onSave }: { detail: ClientManagementDetail; isReadOnly: boolean; onSave: (data: Record<string, unknown>) => Promise<void> }) {
  const { project } = detail
  const [form, setForm] = React.useState({
    project_status: project?.project_status ?? 'pending',
    installation_status: project?.installation_status ?? 'pending',
    engineering_status: project?.engineering_status ?? 'pending',
    homologation_status: project?.homologation_status ?? 'pending',
    commissioning_date: project?.commissioning_date ?? '',
    first_injection_date: project?.first_injection_date ?? '',
    first_generation_date: project?.first_generation_date ?? '',
    expected_go_live_date: project?.expected_go_live_date ?? '',
    integrator_name: project?.integrator_name ?? '',
    engineer_name: project?.engineer_name ?? '',
    notes: project?.notes ?? '',
  })
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(form)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cm-tab-content">
      <div className="cm-form-grid">
        <div className="cm-field-group">
          <label>Status do projeto</label>
          <select value={form.project_status} disabled={isReadOnly} onChange={(e) => handleChange('project_status', e.target.value)}>
            <option value="pending">Pendente</option>
            <option value="in_progress">Em andamento</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
            <option value="on_hold">Em espera</option>
          </select>
        </div>
        <div className="cm-field-group">
          <label>Status da instalação</label>
          <select value={form.installation_status} disabled={isReadOnly} onChange={(e) => handleChange('installation_status', e.target.value)}>
            <option value="pending">Pendente</option>
            <option value="scheduled">Agendada</option>
            <option value="in_progress">Em andamento</option>
            <option value="completed">Concluída</option>
            <option value="failed">Falha</option>
          </select>
        </div>
        <div className="cm-field-group">
          <label>Status da engenharia</label>
          <select value={form.engineering_status} disabled={isReadOnly} onChange={(e) => handleChange('engineering_status', e.target.value)}>
            <option value="pending">Pendente</option>
            <option value="in_progress">Em andamento</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Reprovado</option>
          </select>
        </div>
        <div className="cm-field-group">
          <label>Status da homologação</label>
          <select value={form.homologation_status} disabled={isReadOnly} onChange={(e) => handleChange('homologation_status', e.target.value)}>
            <option value="pending">Pendente</option>
            <option value="submitted">Submetido</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Reprovado</option>
          </select>
        </div>
        <div className="cm-field-group">
          <label>Data de comissionamento</label>
          <input type="date" value={form.commissioning_date} disabled={isReadOnly} onChange={(e) => handleChange('commissioning_date', e.target.value)} />
        </div>
        <div className="cm-field-group">
          <label>Data da 1ª injeção</label>
          <input type="date" value={form.first_injection_date} disabled={isReadOnly} onChange={(e) => handleChange('first_injection_date', e.target.value)} />
        </div>
        <div className="cm-field-group">
          <label>Data da 1ª geração</label>
          <input type="date" value={form.first_generation_date} disabled={isReadOnly} onChange={(e) => handleChange('first_generation_date', e.target.value)} />
        </div>
        <div className="cm-field-group">
          <label>Go-live previsto</label>
          <input type="date" value={form.expected_go_live_date} disabled={isReadOnly} onChange={(e) => handleChange('expected_go_live_date', e.target.value)} />
        </div>
        <div className="cm-field-group">
          <label>Integrador</label>
          <input type="text" value={form.integrator_name} disabled={isReadOnly} onChange={(e) => handleChange('integrator_name', e.target.value)} placeholder="Nome do integrador" />
        </div>
        <div className="cm-field-group">
          <label>Engenheiro responsável</label>
          <input type="text" value={form.engineer_name} disabled={isReadOnly} onChange={(e) => handleChange('engineer_name', e.target.value)} placeholder="Nome do engenheiro" />
        </div>
        <div className="cm-field-group cm-field-group--full">
          <label>Observações</label>
          <textarea value={form.notes} disabled={isReadOnly} rows={3} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Anotações sobre o projeto..." />
        </div>
      </div>
      {!isReadOnly ? (
        <div className="cm-form-actions">
          <button type="button" className="primary solid" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Salvando…' : saved ? '✅ Salvo' : 'Salvar'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function NotesTab({ clientId, isReadOnly }: { clientId: number; isReadOnly: boolean }) {
  const [notes, setNotes] = React.useState<Array<{ id: number; content: string; entry_type: string; title: string | null; created_by_user_id: string | null; created_at: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [newContent, setNewContent] = React.useState('')
  const [newTitle, setNewTitle] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setLoading(true)
    listClientNotes(clientId)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false))
  }, [clientId])

  const handleAdd = async () => {
    if (!newContent.trim()) return
    setSaving(true)
    try {
      const title = newTitle.trim() || undefined
      const note = await createClientNote(clientId, { content: newContent.trim(), ...(title !== undefined ? { title } : {}) })
      setNotes((prev) => [note, ...prev])
      setNewContent('')
      setNewTitle('')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="cm-loading">Carregando anotações…</div>

  return (
    <div className="cm-tab-content">
      {!isReadOnly ? (
        <div className="cm-notes-form">
          <input
            type="text"
            placeholder="Título (opcional)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="cm-notes-title-input"
          />
          <textarea
            placeholder="Nova anotação…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
          />
          <button type="button" className="primary solid" onClick={() => void handleAdd()} disabled={saving || !newContent.trim()}>
            {saving ? 'Salvando…' : 'Adicionar anotação'}
          </button>
        </div>
      ) : null}
      {notes.length === 0 ? (
        <p className="cm-empty-state">Nenhuma anotação registrada.</p>
      ) : (
        <ul className="cm-notes-list">
          {notes.map((note) => (
            <li key={note.id} className="cm-note-item">
              <div className="cm-note-meta">
                <span className="badge badge--neutral">{note.entry_type}</span>
                <time>{formatDate(note.created_at)}</time>
              </div>
              {note.title ? <strong className="cm-note-title">{note.title}</strong> : null}
              <p className="cm-note-content">{note.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RemindersTab({ clientId, isReadOnly }: { clientId: number; isReadOnly: boolean }) {
  const [reminders, setReminders] = React.useState<Array<{ id: number; title: string; reminder_type: string; due_at: string; status: string; notes: string | null }>>([])
  const [loading, setLoading] = React.useState(true)
  const [newTitle, setNewTitle] = React.useState('')
  const [newDueAt, setNewDueAt] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setLoading(true)
    listClientReminders(clientId)
      .then(setReminders)
      .catch(() => setReminders([]))
      .finally(() => setLoading(false))
  }, [clientId])

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDueAt) return
    setSaving(true)
    try {
      const reminder = await createClientReminder(clientId, { title: newTitle.trim(), due_at: new Date(newDueAt).toISOString() })
      setReminders((prev) => [reminder, ...prev])
      setNewTitle('')
      setNewDueAt('')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkDone = async (reminderId: number) => {
    const updated = await patchClientReminder(clientId, reminderId, { status: 'done' })
    setReminders((prev) => prev.map((r) => (r.id === reminderId ? updated : r)))
  }

  if (loading) return <div className="cm-loading">Carregando lembretes…</div>

  return (
    <div className="cm-tab-content">
      {!isReadOnly ? (
        <div className="cm-reminders-form">
          <input
            type="text"
            placeholder="Título do lembrete"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            type="datetime-local"
            value={newDueAt}
            onChange={(e) => setNewDueAt(e.target.value)}
          />
          <button type="button" className="primary solid" onClick={() => void handleAdd()} disabled={saving || !newTitle.trim() || !newDueAt}>
            {saving ? 'Salvando…' : 'Adicionar lembrete'}
          </button>
        </div>
      ) : null}
      {reminders.length === 0 ? (
        <p className="cm-empty-state">Nenhum lembrete cadastrado.</p>
      ) : (
        <ul className="cm-reminders-list">
          {reminders.map((reminder) => (
            <li key={reminder.id} className={`cm-reminder-item${reminder.status === 'done' ? ' cm-reminder-item--done' : ''}`}>
              <div className="cm-reminder-meta">
                <span className={`badge ${reminder.status === 'done' ? 'badge--success' : reminder.status === 'overdue' ? 'badge--danger' : 'badge--info'}`}>
                  {reminder.status}
                </span>
                <time>{formatDate(reminder.due_at)}</time>
              </div>
              <strong className="cm-reminder-title">{reminder.title}</strong>
              {reminder.notes ? <p className="cm-reminder-notes">{reminder.notes}</p> : null}
              {reminder.status === 'pending' && !isReadOnly ? (
                <button type="button" className="ghost" onClick={() => void handleMarkDone(reminder.id)}>
                  Marcar como feito
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ClientDetailPanel({
  clientId,
  isReadOnly,
  onClose,
}: {
  clientId: number
  isReadOnly: boolean
  onClose: () => void
}) {
  const [detail, setDetail] = React.useState<ClientManagementDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<ClientManagementTab>('overview')

  const load = React.useCallback(() => {
    setLoading(true)
    setError(null)
    getClientManagementDetail(clientId)
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Erro desconhecido'))
      .finally(() => setLoading(false))
  }, [clientId])

  React.useEffect(() => { load() }, [load])

  const handleSaveProject = async (data: Record<string, unknown>) => {
    await patchClientProject(clientId, data as Parameters<typeof patchClientProject>[1])
    load()
  }

  const TABS: { id: ClientManagementTab; label: string }[] = [
    { id: 'overview', label: 'Resumo' },
    { id: 'project', label: 'Projeto' },
    { id: 'notes', label: 'Anotações' },
    { id: 'reminders', label: 'Lembretes' },
  ]

  return (
    <div className="cm-detail-panel">
      <div className="cm-detail-header">
        <div className="cm-detail-header-info">
          {detail ? (
            <>
              <h2 className="cm-detail-name">{detail.client.name}</h2>
              <div className="cm-detail-header-meta">
                <span className={lifecycleBadgeClass(detail.lifecycle?.lifecycle_status)}>
                  {lifecycleLabel(detail.lifecycle?.lifecycle_status)}
                </span>
                {detail.energy?.modalidade ? (
                  <span className="badge badge--info">{detail.energy.modalidade}</span>
                ) : null}
                {detail.client.distribuidora ? (
                  <span className="cm-detail-distribuidora">{detail.client.distribuidora}</span>
                ) : null}
              </div>
            </>
          ) : (
            <h2 className="cm-detail-name">Carregando…</h2>
          )}
        </div>
        <button type="button" className="ghost cm-detail-close" onClick={onClose} aria-label="Fechar painel de detalhe">
          ✕
        </button>
      </div>

      <nav className="cm-tabs" aria-label="Seções do cliente">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`cm-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="cm-detail-body">
        {loading ? (
          <div className="cm-loading" role="status">Carregando dados do cliente…</div>
        ) : error ? (
          <div className="cm-error" role="alert">
            <strong>Erro ao carregar cliente.</strong>
            <p>{error}</p>
            <button type="button" className="ghost" onClick={load}>Tentar novamente</button>
          </div>
        ) : !detail ? (
          <div className="cm-empty-state">Cliente não encontrado.</div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab detail={detail} />}
            {activeTab === 'project' && (
              <ProjectTab detail={detail} isReadOnly={isReadOnly} onSave={handleSaveProject} />
            )}
            {activeTab === 'notes' && <NotesTab clientId={clientId} isReadOnly={isReadOnly} />}
            {activeTab === 'reminders' && <RemindersTab clientId={clientId} isReadOnly={isReadOnly} />}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Portfolio KPI Cards ───────────────────────────────────────────────────────

function PortfolioKpiCards({ summary }: { summary: PortfolioSummary }) {
  return (
    <section className="card dashboard-panel dashboard-kpi-card cm-portfolio-kpis" aria-label="KPIs da carteira de clientes">
      <div className="card-header">
        <h3>Carteira de clientes</h3>
        <p>Indicadores consolidados dos clientes gerenciados.</p>
      </div>
      <div className="kpi-grid">
        <KpiCard label="Clientes ativos" value={summary.active_clients_count} />
        <KpiCard label="Contratos ativos" value={summary.active_contracts_count} />
        <KpiCard label="Em implantação" value={summary.projects_in_implantation} />
        <KpiCard label="Com cobrança" value={summary.clients_with_billing} />
        <KpiCard label="Receita mensal prevista" value={formatCurrency(summary.monthly_expected_revenue)} highlight />
        <KpiCard label="Recebido no mês" value={formatCurrency(summary.received_month_to_date)} />
        <KpiCard label="Em atraso" value={formatCurrency(summary.overdue_amount)} />
        <KpiCard label="Elegíveis buy out" value={summary.buyout_eligible_count} />
        {summary.clients_with_alerts > 0 ? (
          <KpiCard label="Com alertas críticos" value={summary.clients_with_alerts} />
        ) : null}
      </div>
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export interface ClientManagementPageProps {
  /** Whether the current user is financeiro (read-only for writes) */
  isFinanceiro: boolean
  /** Whether the current user is admin */
  isAdmin: boolean
}

export function ClientManagementPage({ isFinanceiro, isAdmin }: ClientManagementPageProps) {
  const isReadOnly = isFinanceiro && !isAdmin

  const [listResult, setListResult] = React.useState<ManagedClientListResult | null>(null)
  const [listLoading, setListLoading] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = React.useState<number | null>(null)
  const [portfolioSummary, setPortfolioSummary] = React.useState<PortfolioSummary | null>(null)

  const [filters, setFilters] = React.useState<ClientManagementFilters>({
    search: '',
    lifecycleStatus: '',
    modalidade: '',
    page: 1,
  })

  // Load portfolio summary
  React.useEffect(() => {
    getPortfolioSummary()
      .then(setPortfolioSummary)
      .catch(() => null)
  }, [])

  // Load list
  const loadList = React.useCallback(() => {
    setListLoading(true)
    setListError(null)
    listManagedClients(filters)
      .then(setListResult)
      .catch((err: unknown) => setListError(err instanceof Error ? err.message : 'Erro ao carregar clientes'))
      .finally(() => setListLoading(false))
  }, [filters])

  React.useEffect(() => { loadList() }, [loadList])

  const handleSearch = (value: string) => {
    setFilters((f) => ({ ...f, search: value, page: 1 }))
  }

  const handleLifecycleFilter = (value: string) => {
    setFilters((f) => ({ ...f, lifecycleStatus: value as LifecycleStatus | '', page: 1 }))
  }

  const handleModalidadeFilter = (value: string) => {
    setFilters((f) => ({ ...f, modalidade: value, page: 1 }))
  }

  const handleSelectClient = (row: ManagedClientListRow) => {
    setSelectedClientId(row.id)
  }

  const handleCloseDetail = () => {
    setSelectedClientId(null)
  }

  const handleConvertClient = async (clientId: number) => {
    await patchClientLifecycle(clientId, {
      is_converted_customer: true,
      lifecycle_status: 'contracted',
      converted_at: new Date().toISOString(),
    })
    loadList()
  }

  return (
    <div className={`cm-page${selectedClientId ? ' cm-page--with-detail' : ''}`}>
      {/* Left: list panel */}
      <div className="cm-list-panel">
        <div className="cm-list-panel-header">
          <div>
            <h2>Gestão de Clientes</h2>
            <p>Clientes convertidos e ativos da carteira SolarInvest.</p>
          </div>
        </div>

        {portfolioSummary ? <PortfolioKpiCards summary={portfolioSummary} /> : null}

        <div className="cm-filters">
          <input
            type="search"
            placeholder="Buscar por nome, e-mail, UC ou distribuidora…"
            value={filters.search}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="Buscar clientes"
          />
          <select
            value={filters.lifecycleStatus}
            onChange={(e) => handleLifecycleFilter(e.target.value)}
            aria-label="Filtrar por status do ciclo de vida"
          >
            <option value="">Todos os status</option>
            <option value="contracted">Contratado</option>
            <option value="active">Ativo</option>
            <option value="negotiating">Em negociação</option>
            <option value="suspended">Suspenso</option>
            <option value="completed">Encerrado</option>
          </select>
          <select
            value={filters.modalidade}
            onChange={(e) => handleModalidadeFilter(e.target.value)}
            aria-label="Filtrar por modalidade"
          >
            <option value="">Todas as modalidades</option>
            <option value="leasing">Leasing</option>
            <option value="venda">Venda</option>
          </select>
        </div>

        {listLoading ? (
          <div className="cm-loading" role="status">Carregando clientes…</div>
        ) : listError ? (
          <div className="cm-error" role="alert">
            <strong>Erro ao carregar clientes.</strong>
            <p>{listError}</p>
            <button type="button" className="ghost" onClick={loadList}>Tentar novamente</button>
          </div>
        ) : !listResult || listResult.data.length === 0 ? (
          <div className="cm-empty-state">
            <p>Nenhum cliente convertido encontrado.</p>
            <p className="cm-empty-hint">
              Para adicionar um cliente aqui, marque-o como convertido via CRM ou pela ação abaixo.
            </p>
          </div>
        ) : (
          <>
            <div className="cm-list-meta">
              {listResult.meta.total} cliente{listResult.meta.total !== 1 ? 's' : ''} encontrado{listResult.meta.total !== 1 ? 's' : ''}
            </div>
            <div className="cm-table-wrapper">
              <table className="cm-table" aria-label="Lista de clientes gerenciados">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Modalidade</th>
                    <th>Status</th>
                    <th>Projeto</th>
                    <th>Mensalidade</th>
                    <th>Próx. vencimento</th>
                    <th>Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {listResult.data.map((row) => (
                    <tr
                      key={row.id}
                      className={`cm-table-row${selectedClientId === row.id ? ' cm-table-row--selected' : ''}${row.overdue_installments_count > 0 ? ' cm-table-row--alert' : ''}`}
                      onClick={() => handleSelectClient(row)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectClient(row) }}
                      aria-selected={selectedClientId === row.id}
                    >
                      <td className="cm-table-client">
                        <strong>{row.name}</strong>
                        {row.city ? <span className="cm-table-city">{row.city}{row.state ? `/${row.state}` : ''}</span> : null}
                        {row.distribuidora ? <span className="cm-table-distribuidora">{row.distribuidora}</span> : null}
                      </td>
                      <td>
                        {row.modalidade ? (
                          <span className="badge badge--info">{row.modalidade}</span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={lifecycleBadgeClass(row.lifecycle_status)}>
                          {lifecycleLabel(row.lifecycle_status)}
                        </span>
                      </td>
                      <td>
                        {row.project_status ? (
                          <span className="badge badge--neutral">{row.project_status}</span>
                        ) : '—'}
                      </td>
                      <td>{formatCurrency(row.mensalidade)}</td>
                      <td>{formatDate(row.next_due_date)}</td>
                      <td>
                        {row.overdue_installments_count > 0 ? (
                          <span className="badge badge--danger">
                            {row.overdue_installments_count} atrasada{row.overdue_installments_count > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="badge badge--success">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {listResult.meta.totalPages > 1 ? (
              <div className="cm-pagination">
                <button
                  type="button"
                  className="ghost"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                >
                  ‹ Anterior
                </button>
                <span>
                  Página {listResult.meta.page} de {listResult.meta.totalPages}
                </span>
                <button
                  type="button"
                  className="ghost"
                  disabled={filters.page >= listResult.meta.totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                >
                  Próxima ›
                </button>
              </div>
            ) : null}
          </>
        )}

        {/* Quick convert action */}
        {!isReadOnly ? (
          <div className="cm-convert-hint">
            <p>
              Para adicionar um cliente à gestão, você também pode promovê-lo diretamente:
            </p>
            <details className="cm-convert-details">
              <summary>Promover cliente por ID</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const target = e.target as HTMLFormElement
                  const input = target.elements.namedItem('clientId') as HTMLInputElement
                  const id = parseInt(input.value, 10)
                  if (!isNaN(id)) void handleConvertClient(id)
                }}
                className="cm-convert-form"
              >
                <input type="number" name="clientId" placeholder="ID do cliente" min="1" required />
                <button type="submit" className="ghost">Promover</button>
              </form>
            </details>
          </div>
        ) : null}
      </div>

      {/* Right: detail panel */}
      {selectedClientId !== null ? (
        <ClientDetailPanel
          clientId={selectedClientId}
          isReadOnly={isReadOnly}
          onClose={handleCloseDetail}
        />
      ) : null}
    </div>
  )
}
