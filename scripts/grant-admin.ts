/**
 * scripts/grant-admin.ts
 *
 * One-time utility to grant the `role:admin` Stack Auth permission to a user.
 *
 * Prerequisites:
 *   - The permission `role:admin` must already be created in the Stack Auth dashboard.
 *   - The following environment variables must be set:
 *       STACK_PROJECT_ID (or VITE_STACK_PROJECT_ID)
 *       VITE_STACK_PUBLISHABLE_CLIENT_KEY
 *       STACK_SECRET_SERVER_KEY
 *
 * Usage:
 *   npx tsx scripts/grant-admin.ts [userId]
 *
 * Default userId: ae1f8d08-a591-454f-915b-ba003b120f75 (brsolarinvest@gmail.com)
 */

// NOTE: @stackframe/react exports both the client-side StackClientApp and the
// server-side StackServerApp in the same package. StackServerApp is safe to use
// in Node.js scripts and does not depend on React.
import { StackServerApp } from '@stackframe/react'

const projectId =
  process.env.STACK_PROJECT_ID ??
  process.env.VITE_STACK_PROJECT_ID ??
  ''

const publishableClientKey =
  process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ?? ''

const secretServerKey =
  process.env.STACK_SECRET_SERVER_KEY ?? ''

if (!projectId || !publishableClientKey || !secretServerKey) {
  console.error(
    '[grant-admin] Missing required environment variables.\n' +
    'Set STACK_PROJECT_ID (or VITE_STACK_PROJECT_ID), ' +
    'VITE_STACK_PUBLISHABLE_CLIENT_KEY, and STACK_SECRET_SERVER_KEY.',
  )
  process.exit(1)
}

const serverApp = new StackServerApp({
  projectId,
  publishableClientKey,
  secretServerKey,
  tokenStore: 'memory',
})

const userId = process.argv[2] ?? 'ae1f8d08-a591-454f-915b-ba003b120f75'

console.info(`[grant-admin] Granting role:admin to user ${userId} …`)

const user = await serverApp.getUser(userId)

if (!user) {
  console.error(`[grant-admin] User not found: ${userId}`)
  process.exit(1)
}

await user.grantPermission('role:admin')

console.info(`[grant-admin] ✓ role:admin granted to ${user.displayName ?? user.primaryEmail ?? userId}`)
