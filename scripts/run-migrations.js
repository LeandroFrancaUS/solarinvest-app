import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'
import { getDatabaseConfig, getDirectDatabaseUrl } from '../server/database/getDatabaseConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolveConnectionString() {
  return getDirectDatabaseUrl() || getDatabaseConfig().connectionString
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
    console.error('Database configuration missing. Set DATABASE_URL (preferred) or optional legacy PG* variables.')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    for (const file of files) {
      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf8')
      console.log(`Running migration: ${file}`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('COMMIT')
        console.log(`Migration ${file} applied successfully`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`Error applying migration ${file}:`, err.message || err)
        throw err
      }
    }
    console.log('All migrations applied')
  } finally {
    await client.end()
  }
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
