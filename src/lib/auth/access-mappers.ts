// src/lib/auth/access-mappers.ts
// Helpers to derive UI state from MeResponse.

import type { AccessState, MeResponse } from './access-types'

export function deriveAccessState(me: MeResponse | null, loading: boolean): AccessState {
  if (loading || me === null) return 'loading'
  if (!me.authenticated) return 'loading'
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
