// src/domain/projects/mapPlanToProject.ts
// Pure mappers and validators for the plan→project transition. No React,
// no storage, no I/O. Safe to consume from the backend service.

import type { ProjectPlanSnapshot, ProjectStatus, ProjectType } from './types'
import { PROJECT_STATUSES, PROJECT_TYPES } from './types'

/**
 * Maps a contract_type (as used across the app — 'leasing' | 'sale' | 'buyout')
 * to the canonical ProjectType. Returns null when the contract_type is
 * unknown/invalid so the caller can reject the transition.
 *
 * The app's vernacular uses "venda" in Portuguese, while the legacy schema
 * uses 'sale' in English. Both map to the same ProjectType ('venda').
 * 'buyout' is treated as a purchase (venda) since it is the final acquisition
 * step of an existing plan.
 */
export function mapContractTypeToProjectType(
  contractType: string | null | undefined,
): ProjectType | null {
  if (!contractType) return null
  const normalized = String(contractType).trim().toLowerCase()
  if (normalized === 'leasing') return 'leasing'
  if (normalized === 'venda' || normalized === 'sale' || normalized === 'buyout') return 'venda'
  return null
}

/**
 * Narrows an arbitrary string into a ProjectType.
 */
export function isProjectType(value: unknown): value is ProjectType {
  return typeof value === 'string' && (PROJECT_TYPES as readonly string[]).includes(value)
}

/**
 * Narrows an arbitrary string into a ProjectStatus.
 */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value)
}

export interface PlanValidationError {
  code:
    | 'MISSING_CLIENT_ID'
    | 'MISSING_PLAN_ID'
    | 'INVALID_CONTRACT_TYPE'
  message: string
}

/**
 * Validates that a plan snapshot is sufficient to originate a Project.
 * Returns an array of errors; empty array means valid.
 */
export function validatePlanSnapshot(
  snapshot: Partial<ProjectPlanSnapshot>,
): PlanValidationError[] {
  const errors: PlanValidationError[] = []

  if (!snapshot.client_id || !Number.isFinite(Number(snapshot.client_id))) {
    errors.push({
      code: 'MISSING_CLIENT_ID',
      message: 'Plano sem cliente vinculado — não é possível criar projeto.',
    })
  }

  if (!snapshot.plan_id || !String(snapshot.plan_id).trim()) {
    errors.push({
      code: 'MISSING_PLAN_ID',
      message: 'Plano sem identificador — não é possível criar projeto.',
    })
  }

  if (mapContractTypeToProjectType(snapshot.contract_type ?? null) === null) {
    errors.push({
      code: 'INVALID_CONTRACT_TYPE',
      message:
        'Tipo do plano inválido. Esperado: "leasing" ou "venda" (aceita também "sale"/"buyout").',
    })
  }

  return errors
}

/**
 * Given a plan snapshot, returns the fields needed to INSERT a new project
 * into the projects table. Throws when the snapshot is invalid so that the
 * caller can surface a clear error (this mirrors the DB constraints).
 */
export interface NewProjectFields {
  client_id: number
  plan_id: string
  contract_id: number | null
  proposal_id: string | null
  project_type: ProjectType
  status: ProjectStatus
  client_name_snapshot: string | null
  cpf_cnpj_snapshot: string | null
  city_snapshot: string | null
  state_snapshot: string | null
}

export function buildNewProjectFields(
  snapshot: ProjectPlanSnapshot,
  initialStatus: ProjectStatus = 'Aguardando',
): NewProjectFields {
  const errors = validatePlanSnapshot(snapshot)
  if (errors.length > 0) {
    const err = new Error(errors.map((e) => e.message).join(' | '))
    // Attach structured errors so the caller can inspect them.
    ;(err as Error & { validationErrors: PlanValidationError[] }).validationErrors = errors
    throw err
  }

  const projectType = mapContractTypeToProjectType(snapshot.contract_type)
  // validatePlanSnapshot guarantees projectType is non-null here; narrow for TS.
  if (projectType === null) {
    throw new Error('Invariant violated: contract_type resolution failed after validation.')
  }

  return {
    client_id: Number(snapshot.client_id),
    plan_id: String(snapshot.plan_id).trim(),
    contract_id: snapshot.contract_id ?? null,
    proposal_id: snapshot.proposal_id ?? null,
    project_type: projectType,
    status: initialStatus,
    client_name_snapshot: snapshot.client_name?.trim() || null,
    cpf_cnpj_snapshot: snapshot.cpf_cnpj?.trim() || null,
    city_snapshot: snapshot.city?.trim() || null,
    state_snapshot: snapshot.state?.trim() || null,
  }
}

/**
 * Builds the stable plan_id TEXT key from a contract row. Centralised here
 * so every caller (backfill script, service, tests) agrees on the format.
 */
export function buildPlanIdFromContract(contractId: number | string): string {
  return `contract:${contractId}`
}
