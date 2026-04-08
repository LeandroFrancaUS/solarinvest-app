/**
 * scripts/grant-role.ts
 *
 * General-purpose utility to grant any Stack Auth permission to a user
 * identified by email address.
 *
 * Prerequisites:
 *   - The permission must already be created in the Stack Auth dashboard.
 *   - The following environment variables must be set:
 *       STACK_PROJECT_ID (or VITE_STACK_PROJECT_ID)
 *       VITE_STACK_PUBLISHABLE_CLIENT_KEY
 *       STACK_SECRET_SERVER_KEY
 *
 * Usage:
 *   npx tsx scripts/grant-role.ts <email> <permission>
 *
 * Examples:
 *   npx tsx scripts/grant-role.ts laienygomes1@gmail.com role_office
 *   npx tsx scripts/grant-role.ts someone@example.com role_admin
 *   npx tsx scripts/grant-role.ts someone@example.com role_comercial
 *   npx tsx scripts/grant-role.ts someone@example.com role_financeiro
 */

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
    '[grant-role] Missing required environment variables.\n' +
    'Set STACK_PROJECT_ID (or VITE_STACK_PROJECT_ID), ' +
    'VITE_STACK_PUBLISHABLE_CLIENT_KEY, and STACK_SECRET_SERVER_KEY.',
  )
  process.exit(1)
}

const email = process.argv[2]
const permission = process.argv[3]

if (!email || !permission) {
  console.error('[grant-role] Usage: npx tsx scripts/grant-role.ts <email> <permission>')
  console.error('  Example: npx tsx scripts/grant-role.ts laienygomes1@gmail.com role_office')
  process.exit(1)
}

const serverApp = new StackServerApp({
  projectId,
  publishableClientKey,
  secretServerKey,
  tokenStore: 'memory',
})

console.info(`[grant-role] Looking up user by email: ${email} …`)

const users = await serverApp.listUsers({ query: email })
const user = users.find((u) => u.primaryEmail?.toLowerCase() === email.toLowerCase())

if (!user) {
  console.error(`[grant-role] No user found with email: ${email}`)
  process.exit(1)
}

console.info(`[grant-role] Found user: ${user.displayName ?? user.primaryEmail ?? user.id} (${user.id})`)
console.info(`[grant-role] Granting permission: ${permission} …`)

await user.grantPermission(permission)

console.info(`[grant-role] ✓ ${permission} granted to ${user.displayName ?? user.primaryEmail ?? user.id}`)
