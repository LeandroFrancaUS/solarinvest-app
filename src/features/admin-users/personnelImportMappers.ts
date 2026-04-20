// src/features/admin-users/personnelImportMappers.ts
// Pure mapping functions that translate an existing user or client record into
// a partial draft for the personnel form fields.
//
// Rules:
// - Only fills compatible, non-sensitive fields (name, email, phone, region).
// - The entity-specific code (consultant_code / engineer_code / installer_code)
//   is NEVER copied — it is always auto-generated server-side.
// - CREA is NEVER copied — it must be entered manually.
// - These functions are pure and side-effect free — they only compute a draft
//   object; callers decide whether to overwrite existing form fields.

import type { ImportableUser, ImportableClient } from '../../services/personnelImport'

// ─────────────────────────────────────────────────────────────────────────────
// Shared draft types (partial — only fields that CAN be imported)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsultantImportDraft {
  full_name: string
  email: string
  phone: string
  regions: string[]
}

export interface EngineerImportDraft {
  full_name: string
  email: string
  phone: string
}

export interface InstallerImportDraft {
  full_name: string
  email: string
  phone: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: infer Brazilian UF from a state string
// ─────────────────────────────────────────────────────────────────────────────

const BRAZIL_UF_NAMES: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapá: 'AP', amapa: 'AP', amazonas: 'AM',
  bahia: 'BA', ceará: 'CE', ceara: 'CE', 'distrito federal': 'DF',
  'espírito santo': 'ES', 'espirito santo': 'ES', goiás: 'GO', goias: 'GO',
  maranhão: 'MA', maranhao: 'MA', 'mato grosso': 'MT',
  'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  pará: 'PA', para: 'PA', paraíba: 'PB', paraiba: 'PB',
  paraná: 'PR', parana: 'PR', pernambuco: 'PE', piauí: 'PI', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  'rio grande do sul': 'RS', rondônia: 'RO', rondonia: 'RO',
  roraima: 'RR', 'santa catarina': 'SC', 'são paulo': 'SP', 'sao paulo': 'SP',
  sergipe: 'SE', tocantins: 'TO',
}

const VALID_UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
])

function inferUF(state: string | undefined | null): string | null {
  if (!state) return null
  const trimmed = state.trim()
  const upper = trimmed.toUpperCase()
  // Exact 2-letter UF abbreviation
  if (VALID_UFS.has(upper)) return upper
  // Full state name lookup
  const mapped = BRAZIL_UF_NAMES[trimmed.toLowerCase()]
  return mapped ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Consultant mappers
// ─────────────────────────────────────────────────────────────────────────────

export function mapUserToConsultantDraft(user: ImportableUser): ConsultantImportDraft {
  return {
    full_name: user.full_name ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    regions: [],
  }
}

export function mapClientToConsultantDraft(client: ImportableClient): ConsultantImportDraft {
  const uf = inferUF(client.state)
  return {
    full_name: client.name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    regions: uf ? [uf] : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engineer mappers
// ─────────────────────────────────────────────────────────────────────────────

export function mapUserToEngineerDraft(user: ImportableUser): EngineerImportDraft {
  return {
    full_name: user.full_name ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
  }
}

export function mapClientToEngineerDraft(client: ImportableClient): EngineerImportDraft {
  return {
    full_name: client.name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Installer mappers
// ─────────────────────────────────────────────────────────────────────────────

export function mapUserToInstallerDraft(user: ImportableUser): InstallerImportDraft {
  return {
    full_name: user.full_name ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
  }
}

export function mapClientToInstallerDraft(client: ImportableClient): InstallerImportDraft {
  return {
    full_name: client.name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
  }
}
