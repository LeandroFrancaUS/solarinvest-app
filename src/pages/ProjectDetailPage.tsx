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
  reverseGenerationToKwp,
  estimateMonthlyGenerationKWh,
  DEFAULT_PERFORMANCE_RATIO,
  DEFAULT_DIAS_MES,
} from '../lib/energy/generation'
import { IRRADIACAO_FALLBACK } from '../utils/irradiacao'
import {
  PROJECT_STATUS_LABELS as PORTFOLIO_PROJECT_STATUS_LABELS,
} from '../shared/projects/portfolioProjectOps'
import type { PortfolioClientRow } from '../types/clientPortfolio'
import { ProjectFinanceSection } from '../features/project-finance/ProjectFinanceSection'

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
// State uses canonical number|null — no string conversions in form data.
// potencia_sistema_kwp is auto-computed from numero_modulos × potencia_modulo_wp.
// ─────────────────────────────────────────────────────────────────────────────

// Standard module power options (Wp) — reused from UfConfigurationFields
const POTENCIA_MODULO_OPTIONS: number[] = [
  440, 450, 455, 460, 465, 470, 475, 480, 505, 540, 545, 550, 555, 560, 565,
  570, 575, 580, 585, 590, 595, 600, 605, 610, 615, 620, 625, 630, 635, 640,
  645, 650, 655, 660, 665, 670, 700,
]

const TIPO_REDE_OPTIONS = [
  { value: '', label: 'Selecione…' },
  { value: 'monofasico', label: 'Monofásico' },
  { value: 'bifasico', label: 'Bifásico' },
  { value: 'trifasico', label: 'Trifásico' },
] as const

const TIPO_REDE_LABELS: Record<string, string> = {
  monofasico: 'Monofásico',
  bifasico: 'Bifásico',
  trifasico: 'Trifásico',
}

// Canonical number|null form data — no string state
interface UsinaFormData {
  consumo_kwh_mes: number | null
  potencia_modulo_wp: number | null
  numero_modulos: number | null
  tipo_rede: string
  potencia_sistema_kwp: number | null // auto-computed
  geracao_estimada_kwh_mes: number | null
  area_utilizada_m2: number | null
  modelo_modulo: string
  modelo_inversor: string
}

/**
 * Auto-computes derived Usina fields from the two primary inputs using the
 * SAME engine as the proposta leasing (reverseGenerationToKwp +
 * estimateMonthlyGenerationKWh — both backed by the leasing financial engine).
 *
 * Returns null for each derived field when an input is missing or invalid.
 */
function computeUsinaAuto(
  consumo: number | null,
  potModuloWp: number | null,
): {
  numero_modulos: number | null
  potencia_sistema_kwp: number | null
  geracao_estimada_kwh_mes: number | null
} {
  const nullResult = { numero_modulos: null, potencia_sistema_kwp: null, geracao_estimada_kwh_mes: null }
  if (!consumo || consumo <= 0 || !potModuloWp || potModuloWp <= 0) return nullResult

  // Step 1: find required kWp to cover monthly consumption
  const kwpNecessario = reverseGenerationToKwp(consumo, {
    hsp: IRRADIACAO_FALLBACK,
    pr: DEFAULT_PERFORMANCE_RATIO,
    dias_mes: DEFAULT_DIAS_MES,
  })
  if (!kwpNecessario) return nullResult

  // Step 2: round up to whole modules (same rounding as calcularBaseSistema)
  const numero_modulos = Math.ceil((kwpNecessario * 1000) / potModuloWp)
  if (numero_modulos <= 0) return nullResult

  // Step 3: exact system capacity from actual modules
  const potencia_sistema_kwp = (numero_modulos * potModuloWp) / 1000

  // Step 4: monthly generation from installed capacity
  const geracao_estimada_kwh_mes = estimateMonthlyGenerationKWh({
    potencia_instalada_kwp: potencia_sistema_kwp,
    irradiacao_kwh_m2_dia: IRRADIACAO_FALLBACK,
    performance_ratio: DEFAULT_PERFORMANCE_RATIO,
    dias_mes: DEFAULT_DIAS_MES,
  }) || null

  return { numero_modulos, potencia_sistema_kwp, geracao_estimada_kwh_mes }
}

function pvDataToForm(pv: ProjectPvData | null): UsinaFormData {
  return {
    consumo_kwh_mes: pv?.consumo_kwh_mes ?? null,
    potencia_modulo_wp: pv?.potencia_modulo_wp ?? null,
    numero_modulos: pv?.numero_modulos ?? null,
    tipo_rede: pv?.tipo_rede ?? '',
    potencia_sistema_kwp: pv?.potencia_sistema_kwp ?? null,
    geracao_estimada_kwh_mes: pv?.geracao_estimada_kwh_mes ?? null,
    area_utilizada_m2: pv?.area_utilizada_m2 ?? null,
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
  const [form, setForm] = useState<UsinaFormData>(() => pvDataToForm(pv))
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

  // setField handles auto-computation of derived fields using the leasing engine
  const setField = useCallback(<K extends keyof UsinaFormData>(key: K, value: UsinaFormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Re-compute derived fields whenever consumo or module wattage changes
      if (key === 'consumo_kwh_mes' || key === 'potencia_modulo_wp') {
        const auto = computeUsinaAuto(
          key === 'consumo_kwh_mes' ? (value as number | null) : prev.consumo_kwh_mes,
          key === 'potencia_modulo_wp' ? (value as number | null) : prev.potencia_modulo_wp,
        )
        next.numero_modulos = auto.numero_modulos
        next.potencia_sistema_kwp = auto.potencia_sistema_kwp
        next.geracao_estimada_kwh_mes = auto.geracao_estimada_kwh_mes
      }
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      await patchProjectPvData(projectId, {
        consumo_kwh_mes: form.consumo_kwh_mes,
        potencia_modulo_wp: form.potencia_modulo_wp,
        numero_modulos: form.numero_modulos,
        tipo_rede: form.tipo_rede || null,
        potencia_sistema_kwp: form.potencia_sistema_kwp,
        geracao_estimada_kwh_mes: form.geracao_estimada_kwh_mes,
        area_utilizada_m2: form.area_utilizada_m2,
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

          {/* Consumo */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-consumo">Consumo (kWh/mês)</label>
            <input
              id="usina-consumo"
              className="fm-form-input"
              type="number"
              min="0"
              step="any"
              value={form.consumo_kwh_mes ?? ''}
              onChange={(e) => {
                const v = e.target.valueAsNumber
                setField('consumo_kwh_mes', isNaN(v) ? null : v)
              }}
            />
          </div>

          {/* Potência do módulo — select with standard Wp values */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-pot-modulo">Potência do módulo (Wp)</label>
            <select
              id="usina-pot-modulo"
              className="fm-form-select"
              value={form.potencia_modulo_wp ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Number(e.target.value)
                setField('potencia_modulo_wp', v)
              }}
            >
              <option value="">Selecione…</option>
              {POTENCIA_MODULO_OPTIONS.map((wp) => (
                <option key={wp} value={wp}>{wp.toLocaleString('pt-BR')} Wp</option>
              ))}
            </select>
          </div>

          {/* Número de módulos — auto-computed from consumo + module wattage */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-n-modulos">
              Número de módulos
              <span className="fm-field-hint"> (auto)</span>
            </label>
            <input
              id="usina-n-modulos"
              className="fm-form-input"
              type="number"
              readOnly
              aria-readonly="true"
              value={form.numero_modulos ?? ''}
              tabIndex={-1}
            />
          </div>

          {/* Tipo de rede — select */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-tipo-rede">Tipo de rede</label>
            <select
              id="usina-tipo-rede"
              className="fm-form-select"
              value={form.tipo_rede}
              onChange={(e) => setField('tipo_rede', e.target.value)}
            >
              {TIPO_REDE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Potência do sistema — auto-computed, read-only */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-pot-sistema">
              Potência do sistema (kWp)
              <span className="fm-field-hint"> (auto)</span>
            </label>
            <input
              id="usina-pot-sistema"
              className="fm-form-input"
              type="number"
              readOnly
              aria-readonly="true"
              value={form.potencia_sistema_kwp != null
                ? form.potencia_sistema_kwp.toFixed(3)
                : ''}
              tabIndex={-1}
            />
          </div>

          {/* Geração estimada — auto-computed, but can be manually adjusted */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-geracao">
              Geração estimada (kWh/mês)
              <span className="fm-field-hint"> (auto)</span>
            </label>
            <input
              id="usina-geracao"
              className="fm-form-input"
              type="number"
              min="0"
              step="any"
              value={form.geracao_estimada_kwh_mes ?? ''}
              onChange={(e) => {
                const v = e.target.valueAsNumber
                setField('geracao_estimada_kwh_mes', isNaN(v) ? null : v)
              }}
            />
          </div>

          {/* Área utilizada */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-area">Área utilizada (m²)</label>
            <input
              id="usina-area"
              className="fm-form-input"
              type="number"
              min="0"
              step="any"
              value={form.area_utilizada_m2 ?? ''}
              onChange={(e) => {
                const v = e.target.valueAsNumber
                setField('area_utilizada_m2', isNaN(v) ? null : v)
              }}
            />
          </div>

          {/* Modelo do módulo */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-modelo-modulo">Modelo do módulo</label>
            <input
              id="usina-modelo-modulo"
              className="fm-form-input"
              type="text"
              value={form.modelo_modulo}
              onChange={(e) => setField('modelo_modulo', e.target.value)}
            />
          </div>

          {/* Modelo do inversor */}
          <div className="fm-detail-field fm-detail-field--edit">
            <label className="fm-detail-field-label" htmlFor="usina-modelo-inversor">Modelo do inversor</label>
            <input
              id="usina-modelo-inversor"
              className="fm-form-input"
              type="text"
              value={form.modelo_inversor}
              onChange={(e) => setField('modelo_inversor', e.target.value)}
            />
          </div>

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
          <Field
            label="Tipo de rede"
            value={pv.tipo_rede ? (TIPO_REDE_LABELS[pv.tipo_rede] ?? pv.tipo_rede) : '—'}
          />
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
  const pvData = cached?.pv_data ?? null

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
      <ProjectFinanceSection
        projectId={projectId}
        pvData={pvData}
        stateUf={project?.state_snapshot ?? null}
      />
    </div>
  )
}
