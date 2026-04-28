// src/features/operacao/ManutencoesPage.tsx
// Maintenance jobs page: lists maintenance_jobs from /api/operations/maintenance.

import { useCallback, useEffect, useState } from 'react'
import {
  listMaintenanceJobs,
  createMaintenanceJob,
  type MaintenanceFilters,
} from './operationsApi'
import type { MaintenanceJob, CreateMaintenanceJobPayload, MaintenanceType, MaintenanceStatus } from './operationTypes'
import { MAINTENANCE_TYPES, MAINTENANCE_STATUSES } from './operationTypes'

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export function ManutencoesPage() {
  const [items, setItems] = useState<MaintenanceJob[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formClientId, setFormClientId] = useState('')
  const [formType, setFormType] = useState<MaintenanceType | ''>('')
  const [formScheduledDate, setFormScheduledDate] = useState('')
  const [formTechnicianName, setFormTechnicianName] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    const filters: MaintenanceFilters = {}
    if (statusFilter) filters.status = statusFilter
    try {
      const data = await listMaintenanceJobs(filters)
      const filtered = typeFilter
        ? data.filter((m) => m.maintenance_type === typeFilter)
        : data
      setItems(filtered)
      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar manutenções.')
      setLoadState('error')
    }
  }, [statusFilter, typeFilter])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const clientIdNum = formClientId ? parseInt(formClientId, 10) : NaN
    if (!Number.isFinite(clientIdNum) || clientIdNum <= 0) {
      setFormError('ID do cliente é obrigatório e deve ser um número válido.')
      return
    }
    setSubmitting(true)
    const payload: CreateMaintenanceJobPayload = { client_id: clientIdNum }
    if (formType) payload.maintenance_type = formType
    if (formScheduledDate) payload.scheduled_date = formScheduledDate
    if (formTechnicianName.trim()) payload.technician_name = formTechnicianName.trim()
    try {
      const created = await createMaintenanceJob(payload)
      setItems((prev) => [created, ...prev])
      setShowForm(false)
      setFormClientId('')
      setFormType('')
      setFormScheduledDate('')
      setFormTechnicianName('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar manutenção.')
    } finally {
      setSubmitting(false)
    }
  }, [formClientId, formType, formScheduledDate, formTechnicianName])

  return (
    <div className="operacao-page">
      <div className="operacao-page-header">
        <h1>Manutenções</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
        >
          {showForm ? 'Cancelar' : 'Nova manutenção'}
        </button>
      </div>

      {showForm && (
        <form className="operacao-form" onSubmit={(e) => { void handleCreate(e) }}>
          <h2>Nova manutenção</h2>
          {formError && <p className="operacao-form-error" role="alert">{formError}</p>}
          <label>
            ID do cliente * <span className="operacao-label-hint">(número)</span>
            <input
              type="number"
              min="1"
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              placeholder="ex: 42"
              required
            />
          </label>
          <label>
            Tipo
            <select value={formType} onChange={(e) => setFormType(e.target.value as MaintenanceType | '')}>
              <option value="">— selecione —</option>
              {MAINTENANCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Data agendada
            <input
              type="date"
              value={formScheduledDate}
              onChange={(e) => setFormScheduledDate(e.target.value)}
            />
          </label>
          <label>
            Técnico responsável
            <input
              type="text"
              value={formTechnicianName}
              onChange={(e) => setFormTechnicianName(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      )}

      <div className="operacao-filters">
        <label>
          Status:
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {MAINTENANCE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Tipo:
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos</option>
            {MAINTENANCE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-secondary" onClick={() => { void load() }}>
          Atualizar
        </button>
      </div>

      {loadState === 'loading' && <p className="operacao-status">Carregando…</p>}
      {loadState === 'error' && (
        <p className="operacao-status operacao-status-error" role="alert">
          {error}
          <button type="button" className="btn-link" onClick={() => { void load() }}>Tentar novamente</button>
        </p>
      )}
      {loadState === 'loaded' && items.length === 0 && (
        <div className="operacao-empty">
          <p>Nenhuma manutenção encontrada.</p>
        </div>
      )}
      {loadState === 'loaded' && items.length > 0 && (
        <div className="operacao-table-wrapper">
          <table className="operacao-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Status</th>
                <th>Agendada</th>
                <th>Concluída</th>
                <th>Técnico</th>
                <th>Custo (R$)</th>
                <th>Cliente ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>{m.maintenance_type ?? '—'}</td>
                  <td>
                    <span className={`operacao-badge operacao-badge-${m.status as MaintenanceStatus}`}>
                      {m.status}
                    </span>
                  </td>
                  <td>{m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{m.completed_date ? new Date(m.completed_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{m.technician_name ?? '—'}</td>
                  <td>{m.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td>{m.client_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
