#!/usr/bin/env node
// scripts/run-migrations.mjs
//
// Idempotent migration runner for SolarInvest's Neon/PostgreSQL database.
//
// Usage:
//   DATABASE_URL=<connection-string> node scripts/run-migrations.mjs
//   DATABASE_URL_UNPOOLED=<direct-connection> node scripts/run-migrations.mjs
//
// For migrations, prefer DATABASE_URL_UNPOOLED (direct, non-pooled connection)
// because PgBouncer's default transaction-pooling mode cannot handle the
// SET LOCAL / BEGIN blocks that some migrations emit.
//
// Uses @neondatabase/serverless (already in project deps) with the 'ws' package
// (already a transitive dependency) so no new packages are required.
//
// Algorithm:
//   1. Connect to the database via WebSocket (full PostgreSQL protocol).
//   2. Create the schema_migrations table (idempotent).
//   3. Read every *.sql file in db/migrations/ sorted by name.
//   4. For each file NOT already in schema_migrations, execute it inside a
//      transaction and record it on success.
//   5. Exit 0 on success, 1 on any error.

import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neonConfig, Client } from '@neondatabase/serverless'
import { WebSocket } from 'ws'

// Enable WebSocket-based connection so we can run multi-statement SQL files.
neonConfig.webSocketConstructor = WebSocket

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'db', 'migrations')

// Prefer the unpooled (direct) connection string for migrations.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL

if (!connectionString) {
  console.error(
    '[migrate] ERROR: No database connection string found.\n' +
    '  Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL before running this script.'
  )
  process.exit(1)
}

const client = new Client({ connectionString })

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function appliedSet() {
  const res = await client.query('SELECT filename FROM public.schema_migrations')
  return new Set(res.rows.map((r) => r.filename))
}

async function applyMigration(filename, sql) {
  console.log(`[migrate] Applying: ${filename}`)
  try {
    // Run the migration SQL as-is. Migration files manage their own transactions
    // (they include BEGIN; ... COMMIT;), so we don't wrap them in an extra one.
    await client.query(sql)

    // Record the migration in a separate, independent transaction.
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO public.schema_migrations (filename) VALUES ($1)',
      [filename]
    )
    await client.query('COMMIT')
    console.log(`[migrate]   ✓ Done`)
  } catch (err) {
    // Attempt a rollback in case we're mid-transaction; ignore any error from
    // the rollback itself (e.g. if the connection is already in a good state).
    try { await client.query('ROLLBACK') } catch { /* ignored */ }
    throw err
  }
}

async function main() {
  console.log('[migrate] Connecting to database…')
  await client.connect()

  try {
    await ensureMigrationsTable()

    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql') && !f.includes('.down.'))
      .sort()

    const applied = await appliedSet()
    const pending = allFiles.filter((f) => !applied.has(f))

    if (pending.length === 0) {
      console.log('[migrate] No pending migrations. Database is up-to-date.')
      return
    }

    console.log(`[migrate] ${pending.length} migration(s) to apply…`)

    for (const filename of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8')
      await applyMigration(filename, sql)
    }

    console.log('[migrate] All migrations applied successfully.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[migrate] FATAL:', err.message || err)
  process.exit(1)
})
