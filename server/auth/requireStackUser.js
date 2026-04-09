// server/auth/requireStackUser.js
// Central authentication middleware for protected API routes.
//
// Usage:
//   import { requireStackUser } from './requireStackUser.js'
//
//   export default async function handler(req, res) {
//     const { stackUserId } = await requireStackUser(req)
//     // ... proceed with stackUserId as trusted identity
//   }
//
// Throws an error with statusCode 401 when:
//   - No x-stack-access-token / Authorization: Bearer header is present.
//   - The token fails JWKS verification (expired, wrong project, forged).
//
// The caller receives { stackUserId, payload } where:
//   - stackUserId  : string — the verified Stack Auth user sub (payload.sub).
//   - payload      : object — full decoded JWT payload (for role / email claims).
//
// Identity comes exclusively from the validated token — never from body/query params.

import { getStackUser, isStackAuthBypassed } from './stackAuth.js'

/**
 * Extracts and verifies the Stack Auth access token from the request.
 *
 * Supports:
 *   1. x-stack-access-token header  (Stack Auth SDK native)
 *   2. Authorization: Bearer <token> (standard HTTP auth)
 *
 * In STACK_AUTH_BYPASS=true (dev/test) mode a synthetic bypass user is returned
 * so that local development doesn't require live Stack Auth credentials.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ stackUserId: string, payload: object }>}
 * @throws {{ message: string, statusCode: 401 }} when unauthenticated
 */
export async function requireStackUser(req) {
  // Dev/test bypass — allows local development without real Stack Auth tokens.
  if (isStackAuthBypassed()) {
    return {
      stackUserId: 'bypass-admin',
      payload: { sub: 'bypass-admin', email: 'bypass@solarinvest.info' },
    }
  }

  const stackUser = await getStackUser(req)

  // getStackUser returns null when no token is present or verification fails.
  if (!stackUser?.id) {
    const err = new Error('Unauthorized: valid Stack Auth token required')
    err.statusCode = 401
    throw err
  }

  return {
    stackUserId: stackUser.id,
    payload: stackUser.payload ?? {},
  }
}
