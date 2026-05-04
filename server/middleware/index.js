// server/middleware/index.js
// Barrel export for all route middleware.
//
// Usage:
//   import { withAuth, withErrorHandler, withRateLimit } from '../middleware/index.js'
//
//   const handler = withErrorHandler(
//     withRateLimit(
//       withAuth(innerHandler, { roles: ['admin', 'office'] }),
//       { check: isAdminRateLimited },
//     ),
//   )

export { withAuth } from './withAuth.js'
export { withErrorHandler } from './withErrorHandler.js'
export { withRateLimit } from './withRateLimit.js'
