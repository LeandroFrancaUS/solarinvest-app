/**
 * scripts/grant-role.ts
 *
 * General-purpose utility to grant any Stack Auth global permission to a user
 * identified by email address.
 *
 * Usage:
 *   npx tsx scripts/grant-role.ts <email> <permission>
 */

const STACK_API_BASE = 'https://api.stack-auth.com'

const projectId = process.env.STACK_PROJECT_ID ?? process.env.VITE_STACK_PROJECT_ID ?? ''
const secretServerKey = process.env.STACK_SECRET_SERVER_KEY ?? ''

if (!projectId || !secretServerKey) {
  console.error(
    '[grant-role] Missing required environment variables.\n' +
    'Set STACK_PROJECT_ID (or VITE_STACK_PROJECT_ID) and STACK_SECRET_SERVER_KEY.',
  )
  process.exit(1)
}

const email = process.argv[2]?.trim().toLowerCase()
const permission = process.argv[3]?.trim()

if (!email || !permission) {
  console.error('[grant-role] Usage: npx tsx scripts/grant-role.ts <email> <permission>')
  process.exit(1)
}

async function listUsersByQuery(query: string) {
  const url = `${STACK_API_BASE}/api/v1/users?query=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'x-stack-access-type': 'server',
      'x-stack-project-id': projectId,
      'x-stack-secret-server-key': secretServerKey,
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`List users failed: HTTP ${res.status} ${body}`)
  }

  const data = await res.json()
  const items = Array.isArray(data?.items) ? data.items : []
  return items as Array<{ id?: string; primary_email?: string; primaryEmail?: string; display_name?: string; displayName?: string }>
}

async function grantPermission(userId: string, permissionId: string) {
  const url = `${STACK_API_BASE}/api/v1/users/${encodeURIComponent(userId)}/permissions/${encodeURIComponent(permissionId)}?type=global`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-stack-access-type': 'server',
      'x-stack-project-id': projectId,
      'x-stack-secret-server-key': secretServerKey,
      'content-type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Grant failed: HTTP ${res.status} ${body}`)
  }
}

console.info(`[grant-role] Looking up user by email: ${email} …`)
const users = await listUsersByQuery(email)
const user = users.find((u) => (u.primary_email ?? u.primaryEmail ?? '').toLowerCase() === email)

if (!user?.id) {
  console.error(`[grant-role] No user found with email: ${email}`)
  process.exit(1)
}

console.info(`[grant-role] Found user: ${(user.display_name ?? user.displayName ?? user.primary_email ?? user.primaryEmail ?? user.id)} (${user.id})`)
console.info(`[grant-role] Granting permission: ${permission} …`)

await grantPermission(user.id, permission)

console.info(`[grant-role] ✓ ${permission} granted to ${user.id}`)
