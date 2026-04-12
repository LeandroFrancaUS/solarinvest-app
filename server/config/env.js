/**
 * server/config/env.js
 *
 * Centralized environment variable helpers for the SolarInvest backend.
 *
 * Rules:
 *  - DATABASE_URL is the canonical DB connection string.
 *  - Fallbacks are accepted for legacy deployments, in priority order.
 *  - Secrets are never logged; only key names appear in error messages.
 */

'use strict'

import { getCanonicalDatabaseConnection, getCanonicalDirectDatabaseConnection } from '../database/connection.js'

/**
 * Returns the primary pooled database connection string.
 *
 * Tries (in order):
 *   DATABASE_URL  ← preferred for all serverless/API routes
 *   POSTGRES_URL
 *   NEON_DATABASE_URL
 *   PGURI
 *
 * Returns '' when none are set (callers should gate on this).
 */
export function getDatabaseUrl() {
  const { connectionString } = getCanonicalDatabaseConnection()
  return connectionString || process.env.POSTGRES_URL || ''
}

/**
 * Returns the direct (unpooled) database connection string.
 * Use only when you need a persistent connection (e.g., migrations, long
 * transactions). Regular API routes should use getDatabaseUrl().
 *
 * Tries (in order):
 *   DATABASE_URL_UNPOOLED
 *   POSTGRES_URL_NON_POOLING
 *   NEON_DATABASE_URL_UNPOOLED
 */
export function getDatabaseUrlUnpooled() {
  const { connectionString } = getCanonicalDirectDatabaseConnection()
  return connectionString || process.env.POSTGRES_URL_NON_POOLING || ''
}

/**
 * Returns the Stack Auth project ID.
 *
 * Tries (in order):
 *   STACK_PROJECT_ID            ← preferred server-side name
 *   NEXT_PUBLIC_STACK_PROJECT_ID ← set on Vercel dashboard, available at runtime
 *   VITE_STACK_PROJECT_ID       ← last resort (Vercel exposes all vars to functions)
 */
export function getStackProjectId() {
  return (
    process.env.STACK_PROJECT_ID ||
    process.env.NEXT_PUBLIC_STACK_PROJECT_ID ||
    process.env.VITE_STACK_PROJECT_ID ||
    ''
  )
}

/**
 * Returns the Stack Auth secret server key.
 * Required for permission management API calls.
 */
export function getStackSecretKey() {
  return (process.env.STACK_SECRET_SERVER_KEY || '').trim()
}

/**
 * Returns the value of a required environment variable.
 * Throws a clear error if the variable is not set, so misconfigured deploys
 * fail fast instead of causing cryptic runtime errors.
 *
 * @param {string} name - Environment variable name
 * @returns {string} The value
 */
export function getRequiredEnv(name) {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      'Add it to your .env file or Vercel environment settings.',
    )
  }
  return value.trim()
}
