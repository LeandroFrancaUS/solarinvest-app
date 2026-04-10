import crypto from 'node:crypto'
import { getDatabaseClient } from '../database/neonClient.js'
import { resolveActor } from '../proposals/permissions.js'

const BACKUP_TABLE = 'db_backup_snapshots'
const MAX_PLATFORM_BACKUPS_PER_USER = 20

function toIsoString(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toISOString === 'function') return value.toISOString()
  return String(value)
}

function parseDestination(value) {
  if (typeof value !== 'string') return 'local'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'platform' || normalized === 'cloud') return normalized
  return 'local'
}

async function buildBackupPayload(sql, actor) {
  const [metaRow] = await sql`
    SELECT
      now() AS generated_at,
      current_database() AS database_name,
      version() AS postgres_version
  `

  const [clientsCountRow, proposalsCountRow, auditCountRow] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM public.clients`,
    sql`SELECT COUNT(*)::int AS total FROM public.proposals`,
    sql`SELECT COUNT(*)::int AS total FROM public.client_audit_log`,
  ])

  const [clients, proposals, clientAuditLog, users] = await Promise.all([
    sql`SELECT * FROM public.clients ORDER BY id ASC`,
    sql`SELECT * FROM public.proposals ORDER BY created_at ASC`,
    sql`SELECT * FROM public.client_audit_log ORDER BY id ASC`,
    sql`SELECT id, auth_provider_user_id, email, full_name, role, access_status, approved_at, created_at
        FROM public.app_user_access
       ORDER BY created_at ASC`,
  ])

  return {
    generatedAt: toIsoString(metaRow?.generated_at) ?? new Date().toISOString(),
    generatedBy: {
      userId: actor.userId,
      email: actor.email ?? null,
      role: actor.isAdmin ? 'role_admin' : 'role_office',
    },
    database: {
      name: metaRow?.database_name ?? null,
      postgresVersion: metaRow?.postgres_version ?? null,
    },
    summary: {
      totalClients: clientsCountRow?.total ?? clients.length,
      totalProposals: proposalsCountRow?.total ?? proposals.length,
      totalClientAuditRows: auditCountRow?.total ?? clientAuditLog.length,
    },
    data: {
      clients,
      proposals,
      clientAuditLog,
      appUserAccess: users,
    },
  }
}

async function ensureBackupTable(sql) {
  await sql(`
    CREATE TABLE IF NOT EXISTS public.${BACKUP_TABLE} (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_email TEXT,
      destination TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      backup_payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function persistPlatformBackup(sql, actor, payload, checksum) {
  await ensureBackupTable(sql)

  await sql`
    INSERT INTO public.db_backup_snapshots (
      actor_user_id,
      actor_email,
      destination,
      checksum_sha256,
      backup_payload
    ) VALUES (
      ${actor.userId},
      ${actor.email ?? null},
      'platform',
      ${checksum},
      ${JSON.stringify(payload)}::jsonb
    )
  `

  await sql`
    DELETE FROM public.db_backup_snapshots
     WHERE actor_user_id = ${actor.userId}
       AND id NOT IN (
         SELECT id
           FROM public.db_backup_snapshots
          WHERE actor_user_id = ${actor.userId}
          ORDER BY created_at DESC
          LIMIT ${MAX_PLATFORM_BACKUPS_PER_USER}
       )
  `
}

export async function handleDatabaseBackupRequest(req, res, { sendJson, body }) {
  let actor
  try {
    actor = await resolveActor(req)
  } catch {
    sendJson(res, 401, { ok: false, error: 'Autenticação obrigatória.' })
    return
  }

  if (!actor?.userId) {
    sendJson(res, 401, { ok: false, error: 'Autenticação obrigatória.' })
    return
  }

  if (!actor.isAdmin && !actor.isOffice) {
    sendJson(res, 403, { ok: false, error: 'Apenas perfis Admin e Office podem gerar backup.' })
    return
  }

  const db = getDatabaseClient()
  if (!db?.sql) {
    sendJson(res, 503, { ok: false, error: 'Banco de dados não configurado.' })
    return
  }

  const destination = parseDestination(body?.destination)

  try {
    const payload = await buildBackupPayload(db.sql, actor)
    const serialized = JSON.stringify(payload)
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex')

    if (destination === 'platform') {
      await persistPlatformBackup(db.sql, actor, payload, checksum)
    }

    sendJson(res, 200, {
      ok: true,
      destination,
      fileName: `solarinvest-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      checksumSha256: checksum,
      platformSaved: destination === 'platform',
      payload,
    })
  } catch (error) {
    console.error('[backup] failed to generate backup:', error)
    sendJson(res, 500, { ok: false, error: 'Falha ao gerar backup do banco.' })
  }
}
