// src/pages/ProjectDetailPage.tsx
// Gestão Financeira > Projetos > Detalhe do Projeto.
// PR 2: Header + 3 placeholder areas (Projeto, Usina Fotovoltaica, Financeiro).
// PR 3 will fill Área Projeto, PR 4 will fill Usina + Financeiro.

import React, { useEffect } from 'react'
import '../styles/financial-management.css'
import { useProjectsStore } from '../store/useProjectsStore'
import type { ProjectStatus } from '../domain/projects/types'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  onBack: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
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
// Section placeholder
// ─────────────────────────────────────────────────────────────────────────────

interface SectionPlaceholderProps {
  icon: string
  title: string
  description: string
}

function SectionPlaceholder({ icon, title, description }: SectionPlaceholderProps) {
  return (
    <div className="fm-project-section">
      <div className="fm-project-section-header">
        <span className="fm-project-section-icon" aria-hidden="true">{icon}</span>
        <h2 className="fm-project-section-title">{title}</h2>
      </div>
      <div className="fm-project-section-body fm-project-section-placeholder">
        <p>{description}</p>
      </div>
    </div>
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
      <SectionPlaceholder
        icon="📋"
        title="Projeto"
        description="Dados gerais do projeto: status, tipo de contrato, datas e informações administrativas. Disponível no PR 3."
      />

      {/* ── Section 2: Usina Fotovoltaica ── */}
      <SectionPlaceholder
        icon="☀️"
        title="Usina Fotovoltaica"
        description="Dados técnicos da usina: consumo, potência, módulos, inversores e geração estimada. Disponível no PR 4."
      />

      {/* ── Section 3: Financeiro ── */}
      <SectionPlaceholder
        icon="💰"
        title="Financeiro"
        description="Análise financeira do projeto: motor de Leasing ou Venda, fluxo de caixa e retorno sobre investimento. Disponível no PR 4."
      />
    </div>
  )
}
