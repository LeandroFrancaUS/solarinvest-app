import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'
import { getNeonDatabaseConfig } from '../server/database/neonConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolveConnectionString() {
  const { directConnectionString, connectionString } = getNeonDatabaseConfig()
  return directConnectionString || connectionString || ''
}

// Ensure the migration tracking table exists.
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

// Returns a Set of filenames that have already been applied.
async function loadAppliedMigrations(client) {
  const res = await client.query('SELECT filename FROM public.schema_migrations')
  return new Set(res.rows.map((r) => r.filename))
}

async function recordMigration(client, filename) {
  await client.query(
    'INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
    [filename],
  )
}

/**
 * Detect a "legacy" DB — one where migrations were applied manually before the
 * tracking table was introduced.  We check for the presence of the `clients`
 * table (created by migration 0002) as a reliable signal.
 *
 * On a brand-new (empty) DB this returns false so the script runs every
 * migration from scratch.  On production / preview DBs that already have the
 * full schema it returns true so we skip the SQL and only seed the tracking
 * table, preventing destructive re-runs of non-idempotent migrations (e.g.
 * 0044 which drops and re-adds columns).
 */
async function isLegacyDatabase(client) {
  const res = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'clients'
    ) AS exists
  `)
  return res.rows[0]?.exists === true
}

async function run() {
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations')
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  if (files.length === 0) {
    console.log('No migration files found in', migrationsDir)
    return
  }

  const databaseUrl = resolveConnectionString()
  if (!databaseUrl) {
    console.error('DATABASE_URL/NEON_DATABASE_URL is not set')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    await ensureMigrationsTable(client)
    const applied = await loadAppliedMigrations(client)

    // First run on a legacy DB: tracking table is empty but the schema already
    // exists. Seed the table with all file names without executing their SQL to
    // prevent destructive re-runs of non-idempotent migrations.
    if (applied.size === 0 && (await isLegacyDatabase(client))) {
      console.log(
        'Legacy database detected — seeding schema_migrations without re-running SQL...',
      )
      for (const file of files) {
        await recordMigration(client, file)
        console.log(`  seeded: ${file}`)
      }
      console.log(`\nSeeded ${files.length} existing migration(s). Future runs will only apply new files.`)
      return
    }

    let skipped = 0
    let ran = 0

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping already-applied migration: ${file}`)
        skipped++
        continue
      }

      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf8')
      console.log(`Running migration: ${file}`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await recordMigration(client, file)
        await client.query('COMMIT')
        console.log(`Migration ${file} applied successfully`)
        ran++
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`Error applying migration ${file}:`, err.message || err)
        throw err
      }
    }

    console.log(`\nMigrations complete — ran: ${ran}, skipped: ${skipped}`)
  } finally {
    await client.end()
  }
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
