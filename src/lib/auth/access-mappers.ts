// src/lib/auth/access-mappers.ts
// Helpers to derive UI state from MeResponse.

import type { AccessState, MeResponse, StackPermission } from './access-types'

export function deriveAccessState(me: MeResponse | null, loading: boolean): AccessState {
  if (loading || me === null) return 'loading'
  // When the server confirms the user is not authenticated, we return 'pending'
  // (a resolved, non-loading state) rather than 'loading'. The caller
  // (RequireAuthorizedUser) handles authState === 'anonymous' before ever reading
  // accessState, so this value is never rendered to the user in that case.
  if (!me.authenticated) return 'pending'
  if (me.accessStatus === 'approved' && me.authorized) return 'approved'
  if (me.accessStatus === 'blocked') return 'blocked'
  if (me.accessStatus === 'revoked') return 'revoked'
  return 'pending'
}

export function isAdminUser(me: MeResponse | null): boolean {
  return me?.authorized === true && me?.role === 'admin'
}

export function accessStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'approved': return 'Aprovado'
    case 'pending': return 'Pendente'
    case 'blocked': return 'Bloqueado'
    case 'revoked': return 'Revogado'
    default: return 'Desconhecido'
  }
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'admin': return 'Administrador'
    case 'manager': return 'Gerente'
    case 'user': return 'Usuário'
    default: return 'Desconhecido'
  }
}

export const STACK_PERMISSION_LABELS: Record<StackPermission, string> = {
  role_admin: 'Administrador',
  role_comercial: 'Comercial',
  role_office: 'Office',
  role_financeiro: 'Financeiro',
}

export const ALL_STACK_PERMISSIONS: StackPermission[] = [
  'role_admin',
  'role_comercial',
  'role_office',
  'role_financeiro',
]

export function stackPermissionLabel(perm: string): string {
  return STACK_PERMISSION_LABELS[perm as StackPermission] ?? perm
}
