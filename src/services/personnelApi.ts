// src/services/personnelApi.ts
// REST client for /api/consultants, /api/engineers, /api/installers
// CRUD operations for the personnel management feature.

import { apiFetch } from '../app/services/httpClient'
import type {
  Consultant,
  Engineer,
  Installer,
  CreateConsultantRequest,
  UpdateConsultantRequest,
  CreateEngineerRequest,
  UpdateEngineerRequest,
  CreateInstallerRequest,
  UpdateInstallerRequest,
} from '../types/personnel'

// ─────────────────────────────────────────────────────────────────────────────
// Consultants
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchConsultants(activeOnly = false): Promise<Consultant[]> {
  const path = activeOnly ? '/api/consultants?active=true' : '/api/consultants'
  const res = await apiFetch<{ consultants: Consultant[] }>(path)
  return res.consultants ?? []
}

export async function createConsultant(data: CreateConsultantRequest): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    '/api/consultants',
    { method: 'POST', body: data },
  )
  return res.consultant
}

export async function updateConsultant(id: number, data: UpdateConsultantRequest): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    `/api/consultants/${id}`,
    { method: 'PUT', body: data },
  )
  return res.consultant
}

export async function deactivateConsultant(id: number): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    `/api/consultants/${id}/deactivate`,
    { method: 'PATCH' },
  )
  return res.consultant
}

/**
 * Links a consultant to a user. Admin only.
 * A user can only be linked to ONE consultant, but a consultant can be linked to multiple users.
 */
export async function linkConsultantToUser(consultantId: number, userId: string): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    `/api/consultants/${consultantId}/link`,
    { method: 'POST', body: { userId } },
  )
  return res.consultant
}

/**
 * Unlinks a consultant from a user. Admin only.
 */
export async function unlinkConsultantFromUser(consultantId: number): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    `/api/consultants/${consultantId}/link`,
    { method: 'DELETE' },
  )
  return res.consultant
}

/**
 * Auto-detects a consultant linked to the current user.
 * Returns null if no match is found.
 * Matching priority: 1) linked_user_id, 2) email, 3) first+last name
 */
export async function autoDetectLinkedConsultant(): Promise<{ consultant: Consultant | null; matchType?: string }> {
  const res = await apiFetch<{ consultant: Consultant | null; matchType?: string }>('/api/consultants/auto-detect')
  return res
}

// ─────────────────────────────────────────────────────────────────────────────
// Engineers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchEngineers(activeOnly = false): Promise<Engineer[]> {
  const path = activeOnly ? '/api/engineers?active=true' : '/api/engineers'
  const res = await apiFetch<{ engineers: Engineer[] }>(path)
  return res.engineers ?? []
}

export async function createEngineer(data: CreateEngineerRequest): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    '/api/engineers',
    { method: 'POST', body: data },
  )
  return res.engineer
}

export async function updateEngineer(id: number, data: UpdateEngineerRequest): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    `/api/engineers/${id}`,
    { method: 'PUT', body: data },
  )
  return res.engineer
}

export async function deactivateEngineer(id: number): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    `/api/engineers/${id}/deactivate`,
    { method: 'PATCH' },
  )
  return res.engineer
}

// ─────────────────────────────────────────────────────────────────────────────
// Installers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchInstallers(activeOnly = false): Promise<Installer[]> {
  const path = activeOnly ? '/api/installers?active=true' : '/api/installers'
  const res = await apiFetch<{ installers: Installer[] }>(path)
  return res.installers ?? []
}

export async function createInstaller(data: CreateInstallerRequest): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    '/api/installers',
    { method: 'POST', body: data },
  )
  return res.installer
}

export async function updateInstaller(id: number, data: UpdateInstallerRequest): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    `/api/installers/${id}`,
    { method: 'PUT', body: data },
  )
  return res.installer
}

export async function deactivateInstaller(id: number): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    `/api/installers/${id}/deactivate`,
    { method: 'PATCH' },
  )
  return res.installer
}

// ─────────────────────────────────────────────────────────────────────────────
// Consultant Picker (any authenticated user)
// ─────────────────────────────────────────────────────────────────────────────

/** Lightweight consultant entry returned by /api/consultants/picker. */
export interface ConsultantPickerEntry {
  id: number
  full_name: string
  /** Optional display nickname. Falls back to full_name when null or empty. */
  apelido: string | null
  email: string
  linked_user_id: string | null
}

/** Returns the first word of a full name, or an empty string if the name is empty. */
export function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] || ''
}

/**
 * Returns the display name for a consultant in closed/read-view fields.
 * Priority: apelido → first name → full_name → email → fallback.
 * This ensures proposals and client portfolio show a short, friendly name.
 */
export function consultorDisplayName(c: Pick<ConsultantPickerEntry, 'full_name' | 'apelido'> & { email?: string }): string {
  const nickname = c.apelido?.trim() ?? ''
  if (nickname) return nickname
  const fullName = c.full_name?.trim() ?? ''
  const firstName = getFirstName(fullName)
  if (firstName) return firstName
  if (fullName) return fullName
  const email = c.email?.trim() ?? ''
  return email || 'Consultor não informado'
}

/**
 * Returns the label for a consultant dropdown option.
 * Format: `(apelido) full_name` when apelido is set, otherwise `full_name`.
 * Falls back to email or a placeholder when neither name field is available.
 * Example: `(Kim) Joaquim Amarildo de Oliveira`
 */
export function formatConsultantOptionLabel(c: Pick<ConsultantPickerEntry, 'full_name' | 'apelido'> & { email?: string }): string {
  const nickname = c.apelido?.trim() ?? ''
  const fullName = c.full_name?.trim() ?? ''
  if (nickname && fullName) return `(${nickname}) ${fullName}`
  if (nickname) return nickname
  if (fullName) return fullName
  const email = c.email?.trim() ?? ''
  return email || 'Consultor sem nome'
}

/**
 * Fetches active consultants for use in the proposal form dropdown.
 * Accessible to any authenticated user. Does not expose sensitive fields (CPF, etc.).
 */
export async function fetchConsultantsForPicker(): Promise<ConsultantPickerEntry[]> {
  const res = await apiFetch<{ consultants: ConsultantPickerEntry[] }>('/api/consultants/picker')
  return res.consultants ?? []
}
