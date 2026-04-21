// src/pages/ProjectDetailPage.tsx
// Gestão Financeira > Projetos > Detalhe do Projeto.

import React, { useCallback, useEffect, useState } from 'react'
import '../styles/financial-management.css'
import { useProjectsStore } from '../store/useProjectsStore'
import { patchProjectPvData } from '../services/projectsApi'
import { fetchPortfolioClient } from '../services/clientPortfolioApi'
import type { ProjectPvData, ProjectStatus } from '../domain/projects/types'
import { PROJECT_STATUSES } from '../domain/projects/types'
import {
  PROJECT_STATUS_LABELS as PORTFOLIO_PROJECT_STATUS_LABELS,
} from '../shared/projects/portfolioProjectOps'
import type { PortfolioClientRow } from '../types/clientPortfolio'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  onBack: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  'Aguardando': 'fm-badge fm-badge--project-status-aguardando',
  'Em andamento': 'fm-badge fm-badge--project-status-andamento',
  'Concluído': 'fm-badge fm-badge--project-status-concluido',
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  leasing: 'Leasing',
  venda: 'Venda',
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function fmtNum(value: number | null | undefined, unit?: string): string {
  if (value == null) return '—'
  return unit ? `${value.toLocaleString('pt-BR')} ${unit}` : value.toLocaleString('pt-BR')
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface SectionProps {
  icon: string
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}

function Section({ icon, title, children, action }: SectionProps) {
  return (
    <div className="fm-project-section">
      <div className="fm-project-section-header">
        <span className="fm-project-section-icon" aria-hidden="true">{icon}</span>
        <h2 className="fm-project-section-title">{title}</h2>
        {action ? <div className="fm-project-section-action">{action}</div> : null}
      </div>
      <div className="fm-project-section-body">
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field row (label + value)
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  value: React.ReactNode
  mono?: boolean
}

function Field({ label, value, mono }: FieldProps) {
  return (
    <div className="fm-detail-field">
      <span className="fm-detail-field-label">{label}</span>
      <span className={`fm-detail-field-value${mono ? ' fm-detail-field-value--mono' : ''}`}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PR 3: Projeto Section
// ─────────────────────────────────────────────────────────────────────────────

interface ProjetoSectionProps {
  projectId: string
}

function ProjetoSection({ projectId }: ProjetoSectionProps) {
  const project = useProjectsStore((s) => s.cache[projectId]?.project ?? null)
  const updateStatus = useProjectsStore((s) => s.updateStatus)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load portfolio client to show operational project status (installation, engineering, etc.)
  const [portfolioClient, setPortfolioClient] = useState<PortfolioClientRow | null>(null)
  useEffect(() => {
    if (!project?.client_id) return
    void fetchPortfolioClient(project.client_id)
      .then(setPortfolioClient)
      .catch((err: unknown) => {
        // Non-fatal: operational status block simply won't render
        console.warn('[ProjetoSection] failed to load portfolio client', err)
      })
  }, [project?.client_id])

  const handleStatusChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as ProjectStatus
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateStatus(projectId, newStatus)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, updateStatus])

  if (!project) return null

  const typeLabel = PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type

  return (
    <Section icon="📋" title="Projeto">
      <div className="fm-detail-grid">
        <Field
          label="Status"
          value={
            <span className="fm-detail-status-row">
              <select
                className={`fm-form-select fm-status-select${isSaving ? ' fm-status-select--saving' : ''}`}
                value={project.status}
                onChange={(e) => { void handleStatusChange(e) }}
                disabled={isSaving}
                aria-label="Alterar status do projeto"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {isSaving ? <span className="fm-loading-spinner fm-loading-spinner--sm" aria-hidden="true" /> : null}
            </span>
          }
        />
        <Field
          label="Tipo"
          value={<span className={`fm-badge fm-badge--${project.project_type}`}>{typeLabel}</span>}
        />
        <Field label="Cliente" value={project.client_name_snapshot ?? '—'} />
        <Field label="CPF / CNPJ" value={project.cpf_cnpj_snapshot ?? '—'} mono />
        <Field
          label="Cidade / UF"
          value={
            project.city_snapshot && project.state_snapshot
              ? `${project.city_snapshot} / ${project.state_snapshot}`
              : project.city_snapshot ?? project.state_snapshot ?? '—'
          }
        />
        <Field label="Plano (plan_id)" value={project.plan_id} mono />
        {project.contract_id ? (
          <Field label="Contrato" value={`#${project.contract_id}`} mono />
        ) : null}
        {project.proposal_id ? (
          <Field label="Proposta" value={project.proposal_id} mono />
        ) : null}
        <Field label="Criado em" value={fmtDate(project.created_at)} />
        <Field label="Atualizado em" value={fmtDate(project.updated_at)} />
      </div>
      {portfolioClient ? (
        <div className="fm-detail-subsection">
          <h3 className="fm-detail-subsection-title">Status Operacional</h3>
          <div className="fm-detail-grid">
            {portfolioClient.project_status ? (
              <Field
                label="Status Geral"
                value={PORTFOLIO_PROJECT_STATUS_LABELS[portfolioClient.project_status] ?? portfolioClient.project_status}
              />
            ) : null}
            {portfolioClient.installation_status ? (
              <Field label="Instalação" value={portfolioClient.installation_status} />
            ) : null}
            {portfolioClient.engineering_status ? (
              <Field label="Engenharia" value={portfolioClient.engineering_status} />
            ) : null}
            {portfolioClient.homologation_status ? (
              <Field label="Homologação" value={portfolioClient.homologation_status} />
            ) : null}
            {portfolioClient.commissioning_status ? (
              <Field label="Comissionamento" value={portfolioClient.commissioning_status} />
            ) : null}
            {portfolioClient.commissioning_date ? (
              <Field label="Data Comissionamento" value={fmtDate(portfolioClient.commissioning_date)} />
            ) : null}
            {portfolioClient.integrator_name ? (
              <Field label="Integrador" value={portfolioClient.integrator_name} />
            ) : null}
            {portfolioClient.engineer_name ? (
              <Field label="Engenheiro" value={portfolioClient.engineer_name} />
            ) : null}
            {portfolioClient.art_number ? (
              <Field label="Nº ART" value={portfolioClient.art_number} mono />
            ) : null}
          </div>
        </div>
      ) : null}
      {saveError ? (
        <div className="fm-error-banner fm-error-banner--inline" role="alert">
          ⚠️ {saveError}
        </div>
      ) : null}
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PR 4: Usina Fotovoltaica Section (display + inline edit)
// ─────────────────────────────────────────────────────────────────────────────

interface UsinaFormState {
  consumo_kwh_mes: string
  potencia_modulo_wp: string
  numero_modulos: string
  tipo_rede: string
  potencia_sistema_kwp: string
  geracao_estimada_kwh_mes: string
  area_utilizada_m2: string
  modelo_modulo: string
  modelo_inversor: string
}

function pvDataToForm(pv: ProjectPvData | null): UsinaFormState {
  return {
    consumo_kwh_mes: pv?.consumo_kwh_mes != null ? String(pv.consumo_kwh_mes) : '',
    potencia_modulo_wp: pv?.potencia_modulo_wp != null ? String(pv.potencia_modulo_wp) : '',
    numero_modulos: pv?.numero_modulos != null ? String(pv.numero_modulos) : '',
    tipo_rede: pv?.tipo_rede ?? '',
    potencia_sistema_kwp: pv?.potencia_sistema_kwp != null ? String(pv.potencia_sistema_kwp) : '',
    geracao_estimada_kwh_mes: pv?.geracao_estimada_kwh_mes != null ? String(pv.geracao_estimada_kwh_mes) : '',
    area_utilizada_m2: pv?.area_utilizada_m2 != null ? String(pv.area_utilizada_m2) : '',
    modelo_modulo: pv?.modelo_modulo ?? '',
    modelo_inversor: pv?.modelo_inversor ?? '',
  }
}

interface UsinaSectionProps {
  projectId: string
}

function UsinaSection({ projectId }: UsinaSectionProps) {
  const cached = useProjectsStore((s) => s.cache[projectId])
  const loadProjectById = useProjectsStore((s) => s.loadProjectById)
  const pv = cached?.pv_data ?? null

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<UsinaFormState>(() => pvDataToForm(pv))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync form when pv_data changes from store (e.g. after save)
  useEffect(() => {
    if (!editing) {
      setForm(pvDataToForm(pv))
    }
  }, [pv, editing])

  const handleEdit = useCallback(() => {
    setForm(pvDataToForm(pv))
    setEditing(true)
  }, [pv])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setSaveError(null)
  }, [])

  const setField = useCallback((field: keyof UsinaFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      const toNum = (v: string) => v.trim() === '' ? null : Number(v)
      await patchProjectPvData(projectId, {
        consumo_kwh_mes: toNum(form.consumo_kwh_mes),
        potencia_modulo_wp: toNum(form.potencia_modulo_wp),
        numero_modulos: toNum(form.numero_modulos),
        tipo_rede: form.tipo_rede.trim() || null,
        potencia_sistema_kwp: toNum(form.potencia_sistema_kwp),
        geracao_estimada_kwh_mes: toNum(form.geracao_estimada_kwh_mes),
        area_utilizada_m2: toNum(form.area_utilizada_m2),
        modelo_modulo: form.modelo_modulo.trim() || null,
        modelo_inversor: form.modelo_inversor.trim() || null,
      })
      await loadProjectById(projectId, true)
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar dados da usina.')
    } finally {
      setIsSaving(false)
    }
  }, [form, projectId, loadProjectById])

  const editButton = (
    <button type="button" className="ghost fm-section-edit-btn" onClick={handleEdit}>
      ✏️ Editar
    </button>
  )

  if (editing) {
    return (
      <Section icon="☀️" title="Usina Fotovoltaica">
        <div className="fm-detail-grid fm-detail-grid--edit">
          {([
            { key: 'consumo_kwh_mes', label: 'Consumo (kWh/mês)', type: 'number' },
            { key: 'potencia_modulo_wp', label: 'Potência do módulo (Wp)', type: 'number' },
            { key: 'numero_modulos', label: 'Número de módulos', type: 'number' },
            { key: 'tipo_rede', label: 'Tipo de rede', type: 'text' },
            { key: 'potencia_sistema_kwp', label: 'Potência do sistema (kWp)', type: 'number' },
            { key: 'geracao_estimada_kwh_mes', label: 'Geração estimada (kWh/mês)', type: 'number' },
            { key: 'area_utilizada_m2', label: 'Área utilizada (m²)', type: 'number' },
            { key: 'modelo_modulo', label: 'Modelo do módulo', type: 'text' },
            { key: 'modelo_inversor', label: 'Modelo do inversor', type: 'text' },
          ] as Array<{ key: keyof UsinaFormState; label: string; type: string }>).map(({ key, label, type }) => (
            <div key={key} className="fm-detail-field fm-detail-field--edit">
              <label className="fm-detail-field-label" htmlFor={`usina-${key}`}>{label}</label>
              <input
                id={`usina-${key}`}
                className="fm-form-input"
                type={type}
                step={type === 'number' ? 'any' : undefined}
                min={type === 'number' ? '0' : undefined}
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        {saveError ? (
          <div className="fm-error-banner fm-error-banner--inline" role="alert">⚠️ {saveError}</div>
        ) : null}
        <div className="fm-detail-edit-actions">
          <button type="button" className="ghost" onClick={handleCancel} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="primary" onClick={() => { void handleSave() }} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Section>
    )
  }

  return (
    <Section icon="☀️" title="Usina Fotovoltaica" action={editButton}>
      {pv ? (
        <div className="fm-detail-grid">
          <Field label="Consumo" value={fmtNum(pv.consumo_kwh_mes, 'kWh/mês')} />
          <Field label="Potência do módulo" value={fmtNum(pv.potencia_modulo_wp, 'Wp')} />
          <Field label="Número de módulos" value={fmtNum(pv.numero_modulos)} />
          <Field label="Tipo de rede" value={pv.tipo_rede ?? '—'} />
          <Field label="Potência do sistema" value={fmtNum(pv.potencia_sistema_kwp, 'kWp')} />
          <Field label="Geração estimada" value={fmtNum(pv.geracao_estimada_kwh_mes, 'kWh/mês')} />
          <Field label="Área utilizada" value={fmtNum(pv.area_utilizada_m2, 'm²')} />
          <Field label="Modelo do módulo" value={pv.modelo_modulo ?? '—'} />
          <Field label="Modelo do inversor" value={pv.modelo_inversor ?? '—'} />
        </div>
      ) : (
        <div className="fm-project-section-placeholder">
          <p>Dados da usina ainda não preenchidos. Clique em <strong>Editar</strong> para adicionar.</p>
        </div>
      )}
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PR 4: Financeiro Section
// ─────────────────────────────────────────────────────────────────────────────

interface FinanceiroSectionProps {
  projectId: string
}

function FinanceiroSection({ projectId }: FinanceiroSectionProps) {
  const project = useProjectsStore((s) => s.cache[projectId]?.project ?? null)
  const pv = useProjectsStore((s) => s.cache[projectId]?.pv_data ?? null)

  if (!project) return null

  // Derive rough financial indicators from pv_data and project type
  // Full motor integration (Leasing / Venda engine) is deferred to a future PR.
  const tipoBadge = PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type

  const potenciaKwp = pv?.potencia_sistema_kwp
  const geracaoKwhMes = pv?.geracao_estimada_kwh_mes

  return (
    <Section icon="💰" title="Financeiro">
      <div className="fm-detail-grid">
        <Field
          label="Tipo de negócio"
          value={<span className={`fm-badge fm-badge--${project.project_type}`}>{tipoBadge}</span>}
        />
        {potenciaKwp != null ? (
          <Field label="Potência instalada" value={fmtNum(potenciaKwp, 'kWp')} />
        ) : null}
        {geracaoKwhMes != null ? (
          <Field label="Geração estimada" value={fmtNum(geracaoKwhMes, 'kWh/mês')} />
        ) : null}
      </div>
      <div className="fm-project-section-placeholder" style={{ marginTop: 12 }}>
        <p>
          Motor financeiro completo ({project.project_type === 'leasing' ? 'Leasing' : 'Venda Direta'}) será integrado em um próximo PR.
        </p>
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectDetailPage
// ─────────────────────────────────────────────────────────────────────────────

export function ProjectDetailPage({ projectId, onBack }: Props) {
  const loadProjectById = useProjectsStore((s) => s.loadProjectById)
  const cached = useProjectsStore((s) => s.cache[projectId])
  const isLoading = useProjectsStore((s) => s.detailLoading[projectId] ?? false)
  const error = useProjectsStore((s) => s.detailError[projectId] ?? null)

  useEffect(() => {
    void loadProjectById(projectId)
  }, [projectId, loadProjectById])

  const project = cached?.project ?? null

  if (isLoading && !project) {
    return (
      <div className="fm-page">
        <div className="fm-loading">
          <span className="fm-loading-spinner" aria-hidden="true" />
          Carregando projeto…
        </div>
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="fm-page">
        <div className="fm-page-header">
          <div className="fm-page-header-left">
            <button type="button" className="ghost fm-back-btn" onClick={onBack}>
              ← Voltar
            </button>
          </div>
        </div>
        <div className="fm-error-banner" role="alert">
          <span>⚠️ {error}</span>
          <button type="button" className="ghost" onClick={() => void loadProjectById(projectId, true)}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const clientLabel = project?.client_name_snapshot ?? '—'
  const cpfCnpjLabel = project?.cpf_cnpj_snapshot ?? null
  const locationLabel =
    project?.city_snapshot && project?.state_snapshot
      ? `${project.city_snapshot} / ${project.state_snapshot}`
      : project?.city_snapshot ?? project?.state_snapshot ?? '—'
  const typeLabel = project ? (PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type) : '—'
  const statusBadgeClass = project ? (STATUS_BADGE_CLASS[project.status] ?? 'fm-badge') : 'fm-badge'
  const statusLabel = project?.status ?? '—'

  return (
    <div className="fm-page fm-project-detail">
      {/* ── Header ── */}
      <div className="fm-page-header">
        <div className="fm-page-header-left">
          <button type="button" className="ghost fm-back-btn" onClick={onBack}>
            ← Projetos
          </button>
          <div>
            <h1 className="fm-page-title">
              🏗️ {clientLabel}
              {cpfCnpjLabel ? <span className="fm-project-detail-cpf"> {cpfCnpjLabel}</span> : null}
            </h1>
            <p className="fm-page-subtitle">
              <span className={statusBadgeClass}>{statusLabel}</span>
              {' '}&nbsp;·&nbsp;{' '}
              <span className={`fm-badge fm-badge--${project?.project_type ?? 'leasing'}`}>{typeLabel}</span>
              {' '}&nbsp;·&nbsp;{' '}
              {locationLabel}
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 1: Projeto ── */}
      <ProjetoSection projectId={projectId} />

      {/* ── Section 2: Usina Fotovoltaica ── */}
      <UsinaSection projectId={projectId} />

      {/* ── Section 3: Financeiro ── */}
      <FinanceiroSection projectId={projectId} />
    </div>
  )
}
