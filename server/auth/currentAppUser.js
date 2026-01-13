// server/auth/currentAppUser.js
import { query } from '../db.js'
import { getStackUser } from './stackAuth.js'

export async function getCurrentAppUser(req) {
  // 1) pega usuário autenticado (Stack Auth)
  const stackUser = await getStackUser(req)
  if (!stackUser?.email) {
    return null
  }

  // 2) busca no seu RBAC (app_users)
  const { rows } = await query(
    `SELECT id, email, full_name, role, status
     FROM public.app_users
     WHERE email = $1
     LIMIT 1`,
    [stackUser.email]
  )

  const appUser = rows[0]
  if (!appUser) {
    // usuário logou no Stack, mas não está cadastrado no RBAC
    return null
  }

  if (appUser.status !== 'active') {
    return null
  }

  return appUser
}
