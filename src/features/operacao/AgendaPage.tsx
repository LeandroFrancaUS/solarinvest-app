// src/features/operacao/AgendaPage.tsx
// Agenda page: lists operation_events from /api/operations/events.

import { useCallback, useEffect, useState } from 'react'
import {
  listOperationEvents,
  createOperationEvent,
  type EventFilters,
} from './operationsApi'
import type { OperationEvent, CreateOperationEventPayload } from './operationTypes'
import { OPERATION_EVENT_STATUSES } from './operationTypes'

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export function AgendaPage() {
  const [items, setItems] = useState<OperationEvent[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formStartsAt, setFormStartsAt] = useState('')
  const [formClientId, setFormClientId] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    const filters: EventFilters = {}
    if (statusFilter) filters.status = statusFilter
    try {
      const data = await listOperationEvents(filters)
      setItems(data)
      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar eventos.')
      setLoadState('error')
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formTitle.trim()) { setFormError('Título é obrigatório.'); return }
    if (!formStartsAt) { setFormError('Data/hora de início é obrigatória.'); return }
    setSubmitting(true)
    const payload: CreateOperationEventPayload = {
      title: formTitle.trim(),
      starts_at: new Date(formStartsAt).toISOString(),
    }
    const clientIdNum = formClientId ? parseInt(formClientId, 10) : NaN
    if (Number.isFinite(clientIdNum) && clientIdNum > 0) payload.client_id = clientIdNum
    try {
      const created = await createOperationEvent(payload)
      setItems((prev) => [created, ...prev])
      setShowForm(false)
      setFormTitle('')
      setFormStartsAt('')
      setFormClientId('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar evento.')
    } finally {
      setSubmitting(false)
    }
  }, [formTitle, formStartsAt, formClientId])

  return (
    <div className="operacao-page">
      <div className="operacao-page-header">
        <h1>Agenda</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
        >
          {showForm ? 'Cancelar' : 'Novo evento'}
        </button>
      </div>

      {showForm && (
        <form className="operacao-form" onSubmit={(e) => { void handleCreate(e) }}>
          <h2>Novo evento</h2>
          {formError && <p className="operacao-form-error" role="alert">{formError}</p>}
          <label>
            Título *
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </label>
          <label>
            Data/hora de início *
            <input
              type="datetime-local"
              value={formStartsAt}
              onChange={(e) => setFormStartsAt(e.target.value)}
              required
            />
          </label>
          <label>
            ID do cliente <span className="operacao-label-hint">(número — deixe em branco se não aplicável)</span>
            <input
              type="number"
              min="1"
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              placeholder="ex: 42"
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
            {OPERATION_EVENT_STATUSES.map((s) => (
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
          <p>Nenhum evento encontrado.</p>
        </div>
      )}
      {loadState === 'loaded' && items.length > 0 && (
        <div className="operacao-table-wrapper">
          <table className="operacao-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Início</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Cliente ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.title}</td>
                  <td>{new Date(ev.starts_at).toLocaleString('pt-BR')}</td>
                  <td>{ev.event_type ?? '—'}</td>
                  <td>
                    <span className={`operacao-badge operacao-badge-${ev.status}`}>
                      {ev.status}
                    </span>
                  </td>
                  <td>{ev.client_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
