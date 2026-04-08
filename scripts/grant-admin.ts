/**
 * scripts/grant-admin.ts
 *
 * One-time utility to grant `role_admin` (global) to a Stack Auth user.
 *
 * Usage:
 *   npx tsx scripts/grant-admin.ts [userId]
 */

const STACK_API_BASE = 'https://api.stack-auth.com'
const ADMIN_PERMISSION = 'role_admin'

const projectId = process.env.STACK_PROJECT_ID ?? process.env.VITE_STACK_PROJECT_ID ?? ''
const secretServerKey = process.env.STACK_SECRET_SERVER_KEY ?? ''

if (!projectId || !secretServerKey) {
  console.error(
    '[grant-admin] Missing required environment variables.\n' +
    'Set STACK_PROJECT_ID (or VITE_STACK_PROJECT_ID) and STACK_SECRET_SERVER_KEY.',
  )
  process.exit(1)
}

const userId = process.argv[2] ?? 'ae1f8d08-a591-454f-915b-ba003b120f75'

async function grantPermission(targetUserId: string, permissionId: string) {
  const url = `${STACK_API_BASE}/api/v1/users/${encodeURIComponent(targetUserId)}/permissions/${encodeURIComponent(permissionId)}?type=global`
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

console.info(`[grant-admin] Granting ${ADMIN_PERMISSION} to user ${userId} …`)
await grantPermission(userId, ADMIN_PERMISSION)
console.info(`[grant-admin] ✓ ${ADMIN_PERMISSION} granted to ${userId}`)
