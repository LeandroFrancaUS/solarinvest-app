// src/shared/projects/portfolioProjectOps.ts
// Pure (no React, no export *) module for portfolio-project operational logic.
// Shared between ClientPortfolioPage (ProjetoTab) and ProjectDetailPage (ProjetoSection).

import type { PortfolioClientRow, ProjectStatus } from '../../types/clientPortfolio'
import { PROJECT_STATUS_LABELS } from '../../types/clientPortfolio'

// ─────────────────────────────────────────────────────────────────────────────
// Re-export PROJECT_STATUS_LABELS so consumers only need to import from here
// ─────────────────────────────────────────────────────────────────────────────

export { PROJECT_STATUS_LABELS }
export type { ProjectStatus }

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_INTEGRATOR = 'Solarinvest'
export const DEFAULT_ENGINEER = 'Tiago Souza'
export const DEFAULT_ENGINEERING_STATUS = 'Não Iniciado'

// ─────────────────────────────────────────────────────────────────────────────
// Status option lists
// ─────────────────────────────────────────────────────────────────────────────

export const INSTALLATION_STATUS_OPTIONS: ReadonlyArray<string> = [
  'Aguardando Agendamento',
  'Agendado',
  'Em Andamento',
  'Concluído',
]

export const ENGINEERING_STATUS_OPTIONS: ReadonlyArray<string> = [
  'Não Iniciado',
  'Análise Técnica',
  'Enviado à Concessionária',
  'Aprovado',
  'Reprovado',
]

export const HOMOLOGATION_STATUS_OPTIONS: ReadonlyArray<string> = [
  'Solicitado',
  'Aguardando Vistoria',
  'Homologado',
  'Reprovado',
  'Pendências',
]

export const COMMISSIONING_STATUS_OPTIONS: ReadonlyArray<string> = [
  'Pendente',
  'Em execução',
  'Concluído',
]

export const ART_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'emitida', label: 'Emitida' },
  { value: 'cancelada', label: 'Cancelada' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Form data type
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjetoFormData {
  project_status: string
  installation_status: string
  engineering_status: string
  homologation_status: string
  commissioning_status: string
  commissioning_date: string
  integrator_name: string
  engineer_name: string
  engineer_id: number | null
  installer_id: number | null
  art_number: string
  art_issued_at: string
  art_status: string
  project_notes: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Form builder — derives initial form state from a PortfolioClientRow
// ─────────────────────────────────────────────────────────────────────────────

export function buildProjetoForm(
  client: Pick<
    PortfolioClientRow,
    | 'project_status'
    | 'installation_status'
    | 'engineering_status'
    | 'homologation_status'
    | 'commissioning_status'
    | 'commissioning_date'
    | 'integrator_name'
    | 'engineer_name'
    | 'engineer_id'
    | 'installer_id'
    | 'art_number'
    | 'art_issued_at'
    | 'art_status'
    | 'project_notes'
  >,
): ProjetoFormData {
  return {
    project_status: client.project_status ?? 'pending',
    installation_status: client.installation_status ?? '',
    engineering_status: client.engineering_status ?? DEFAULT_ENGINEERING_STATUS,
    homologation_status: client.homologation_status ?? '',
    commissioning_status: client.commissioning_status ?? '',
    commissioning_date: client.commissioning_date?.slice(0, 10) ?? '',
    integrator_name: client.integrator_name ?? DEFAULT_INTEGRATOR,
    engineer_name: client.engineer_name ?? DEFAULT_ENGINEER,
    engineer_id: client.engineer_id ?? null,
    installer_id: client.installer_id ?? null,
    art_number: client.art_number ?? '',
    art_issued_at: client.art_issued_at?.slice(0, 10) ?? '',
    art_status: client.art_status ?? '',
    project_notes: client.project_notes ?? '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation — returns an error string or null when valid
// ─────────────────────────────────────────────────────────────────────────────

export function validateProjetoSave(form: ProjetoFormData): string | null {
  if (form.art_number.trim() && !form.engineer_id) {
    return 'Não é possível salvar ART sem selecionar um engenheiro.'
  }
  const needsObservation =
    form.homologation_status === 'Reprovado' ||
    form.homologation_status === 'Pendências' ||
    form.commissioning_status === 'Reprovado' ||
    form.commissioning_status === 'Pendências'
  if (needsObservation && !form.project_notes.trim()) {
    return 'Observação obrigatória quando status é Reprovado ou Pendências.'
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes — prepend timestamp/origin label when observation is mandatory
// ─────────────────────────────────────────────────────────────────────────────

export function resolveProjetoNotes(form: ProjetoFormData): string {
  const notes = form.project_notes
  const needsObservation =
    form.homologation_status === 'Reprovado' ||
    form.homologation_status === 'Pendências' ||
    form.commissioning_status === 'Reprovado' ||
    form.commissioning_status === 'Pendências'
  if (needsObservation && notes.trim() && !notes.startsWith('[')) {
    const ts = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const origin =
      form.homologation_status === 'Reprovado' || form.homologation_status === 'Pendências'
        ? 'Homologação'
        : 'Comissionamento'
    return `[${ts}] [${origin}] ${notes}`
  }
  return notes
}

// ─────────────────────────────────────────────────────────────────────────────
// Save payload builder — converts form data to the API patch body
// ─────────────────────────────────────────────────────────────────────────────

export function buildProjetoSavePayload(form: ProjetoFormData): Record<string, unknown> {
  const notes = resolveProjetoNotes(form)
  return {
    project_status: form.project_status,
    installation_status: form.installation_status || null,
    engineering_status: form.engineering_status || null,
    homologation_status: form.homologation_status || null,
    commissioning_status: form.commissioning_status || null,
    commissioning_date: form.commissioning_date || null,
    integrator_name: form.integrator_name || null,
    engineer_name: form.engineer_name || null,
    engineer_id: form.engineer_id ?? null,
    installer_id: form.installer_id ?? null,
    art_number: form.art_number.trim() || null,
    art_issued_at: form.art_issued_at || null,
    art_status: form.art_status || null,
    notes: notes || null,
  }
}
