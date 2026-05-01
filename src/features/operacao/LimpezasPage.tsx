// src/features/operacao/LimpezasPage.tsx
// Cleaning jobs page: lists cleaning_jobs from /api/operations/cleanings.

import { useCallback, useEffect, useState } from 'react'
import {
  listCleaningJobs,
  createCleaningJob,
  type CleaningFilters,
} from './operationsApi'
import type { CleaningJob, CreateCleaningJobPayload } from './operationTypes'
import { CLEANING_STATUSES } from './operationTypes'

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export function LimpezasPage() {
  const [items, setItems] = useState<CleaningJob[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formClientId, setFormClientId] = useState('')
  const [formPeriodicity, setFormPeriodicity] = useState('')
  const [formScheduledDate, setFormScheduledDate] = useState('')
  const [formResponsibleName, setFormResponsibleName] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    const filters: CleaningFilters = {}
    if (statusFilter) filters.status = statusFilter
    try {
      const data = await listCleaningJobs(filters)
      setItems(data)
      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar limpezas.')
      setLoadState('error')
    }
  }, [statusFilter])

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
    const payload: CreateCleaningJobPayload = { client_id: clientIdNum }
    if (formPeriodicity.trim()) payload.periodicity = formPeriodicity.trim()
    if (formScheduledDate) payload.scheduled_date = formScheduledDate
    if (formResponsibleName.trim()) payload.responsible_name = formResponsibleName.trim()
    try {
      const created = await createCleaningJob(payload)
      setItems((prev) => [created, ...prev])
      setShowForm(false)
      setFormClientId('')
      setFormPeriodicity('')
      setFormScheduledDate('')
      setFormResponsibleName('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar limpeza.')
    } finally {
      setSubmitting(false)
    }
  }, [formClientId, formPeriodicity, formScheduledDate, formResponsibleName])

  return (
    <div className="operacao-page">
      <div className="operacao-page-header">
        <h1>Limpezas</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
        >
          {showForm ? 'Cancelar' : 'Nova limpeza'}
        </button>
      </div>

      {showForm && (
        <form className="operacao-form" onSubmit={(e) => { void handleCreate(e) }}>
          <h2>Nova limpeza</h2>
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
            Periodicidade
            <input
              type="text"
              value={formPeriodicity}
              onChange={(e) => setFormPeriodicity(e.target.value)}
              placeholder="ex: mensal, trimestral"
            />
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
            Responsável
            <input
              type="text"
              value={formResponsibleName}
              onChange={(e) => setFormResponsibleName(e.target.value)}
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
            {CLEANING_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
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
          <p>Nenhuma limpeza encontrada.</p>
        </div>
      )}
      {loadState === 'loaded' && items.length > 0 && (
        <div className="operacao-table-wrapper">
          <table className="operacao-table">
            <thead>
              <tr>
                <th>Periodicidade</th>
                <th>Status</th>
                <th>Agendada</th>
                <th>Concluída</th>
                <th>Responsável</th>
                <th>Cliente ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.periodicity ?? '—'}</td>
                  <td>
                    <span className={`operacao-badge operacao-badge-${c.status}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>{c.scheduled_date ? new Date(c.scheduled_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{c.completed_date ? new Date(c.completed_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{c.responsible_name ?? '—'}</td>
                  <td>{c.client_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
