// scripts/backfill-projects.js
// Backfill utility: for every "effectivated" plan (client_contracts row with
// contract_status in ('active','completed')) that doesn't have a matching
// project, create one using the same idempotent service the runtime uses.
//
// Usage:
//   node scripts/backfill-projects.js           # dry run — reports only
//   node scripts/backfill-projects.js --apply   # actually create projects
//
// The script uses the unscoped service connection (no RLS context), so it
// must be run by an operator with full DB access.

import { Client } from 'pg'
import { getNeonDatabaseConfig } from '../server/database/neonConfig.js'
import { buildNewProjectFields, isUuid } from '../server/projects/planMapper.js'

function resolveConnectionString() {
  const { directConnectionString, connectionString } = getNeonDatabaseConfig()
  return directConnectionString || connectionString || ''
}

/**
 * Thin wrapper that exposes a Neon-compatible `sql` API backed by pg. The
 * shared repository layer only uses the tagged-template form and the
 * (text, params) form — both are implemented here.
 */
function createSqlFromPg(client) {
  function sqlText(text, params) {
    return client.query(text, params).then((r) => r.rows)
  }
  const sql = (stringsOrText, ...values) => {
    if (typeof stringsOrText === 'string') {
      return sqlText(stringsOrText, values[0])
    }
    // Tagged-template: convert to $1…$N form
    const strings = stringsOrText
    let text = ''
    const params = []
    for (let i = 0; i < strings.length; i += 1) {
      text += strings[i]
      if (i < values.length) {
        params.push(values[i])
        text += `$${params.length}`
      }
    }
    return sqlText(text, params)
  }
  return sql
}

async function run() {
  const apply = process.argv.includes('--apply')
  const databaseUrl = resolveConnectionString()
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pgClient = new Client({ connectionString: databaseUrl })
  await pgClient.connect()

  const stats = { scanned: 0, created: 0, reused: 0, skipped: 0, failed: 0 }

  try {
    const sql = createSqlFromPg(pgClient)

    // Lazy-import repository & service so that the pg-backed sql works
    // interchangeably with the neon-backed sql used at runtime.
    const { listEffectivatedContractsWithoutProject } = await import(
      '../server/projects/repository.js'
    )
    const { createOrReuseProjectFromPlan } = await import('../server/projects/service.js')

    const rows = await listEffectivatedContractsWithoutProject(sql)
    stats.scanned = rows.length
    console.log(`[backfill-projects] Found ${rows.length} effectivated plan(s) without project.`)

    for (const row of rows) {
      const snapshot = {
        client_id: Number(row.client_id),
        plan_id: `contract:${row.contract_id}`,
        contract_id: Number(row.contract_id),
        proposal_id: isUuid(row.source_proposal_id) ? row.source_proposal_id : null,
        contract_type: row.contract_type,
        client_name: row.client_name,
        cpf_cnpj: row.cpf_cnpj,
        city: row.city,
        state: row.state,
      }

      // Pre-validate so we can emit useful skip messages before hitting the DB.
      try {
        buildNewProjectFields(snapshot)
      } catch (err) {
        stats.skipped += 1
        console.warn(`  [skip] contract=${row.contract_id} client=${row.client_id} :: ${err.message}`)
        continue
      }

      if (!apply) {
        console.log(
          `  [dry-run] would create project  contract=${row.contract_id}  client=${row.client_id}  type=${row.contract_type}  name="${row.client_name}"`,
        )
        continue
      }

      try {
        const result = await createOrReuseProjectFromPlan(sql, snapshot)
        if (result.created) {
          stats.created += 1
          console.log(`  [created] project=${result.project.id}  contract=${row.contract_id}`)
        } else {
          stats.reused += 1
          console.log(`  [reused]  project=${result.project.id}  contract=${row.contract_id}`)
        }
      } catch (err) {
        stats.failed += 1
        console.error(`  [failed]  contract=${row.contract_id} :: ${err.message}`)
      }
    }
  } finally {
    await pgClient.end()
  }

  console.log('[backfill-projects] done', stats)
  if (stats.failed > 0) process.exit(2)
}

run().catch((err) => {
  console.error('[backfill-projects] fatal', err)
  process.exit(1)
})
