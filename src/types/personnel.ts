// src/types/personnel.ts
// Type definitions for the Consultants, Engineers, and Installers entities.
// These are distinct from app users (app_user_profiles) — a person may be both.

export interface Consultant {
  id: number
  consultant_code: string
  full_name: string
  phone: string
  email: string
  /** Array of Brazilian state abbreviations (UFs) */
  regions: string[]
  linked_user_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

export interface Engineer {
  id: number
  engineer_code: string
  full_name: string
  phone: string
  email: string
  crea: string
  linked_user_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

export interface Installer {
  id: number
  installer_code: string
  full_name: string
  phone: string
  email: string
  linked_user_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

export interface CreateConsultantRequest {
  consultant_code: string
  full_name: string
  phone: string
  email: string
  regions: string[]
  linked_user_id?: string | null
}

export interface UpdateConsultantRequest {
  full_name: string
  phone: string
  email: string
  regions: string[]
  linked_user_id?: string | null
}

export interface CreateEngineerRequest {
  engineer_code: string
  full_name: string
  phone: string
  email: string
  crea: string
  linked_user_id?: string | null
}

export interface UpdateEngineerRequest {
  full_name: string
  phone: string
  email: string
  crea: string
  linked_user_id?: string | null
}

export interface CreateInstallerRequest {
  installer_code: string
  full_name: string
  phone: string
  email: string
  linked_user_id?: string | null
}

export interface UpdateInstallerRequest {
  full_name: string
  phone: string
  email: string
  linked_user_id?: string | null
}

/** All Brazilian state abbreviations for region selection */
export const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export type BrazilUF = (typeof BRAZIL_UFS)[number]

export const PERSONNEL_CODE_REGEX = /^[A-Za-z0-9]{4}$/
