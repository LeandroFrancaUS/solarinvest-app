import { getDatabaseClient } from '../database/neonClient.js'
import { resolveActor } from '../proposals/permissions.js'
import { createUserScopedSql } from '../database/withRLSContext.js'

export async function handleFinancialAnalyses(req, res, ctx) {
  const { method, readJsonBody, sendJson } = ctx
  const db = getDatabaseClient()
  if (!db) return sendJson(503, { error: 'DB not configured' })

  const actor = await resolveActor(req)
  const sql = createUserScopedSql(db.sql, { userId: actor.userId, role: actor.role })

  if (method === 'POST') {
    const body = await readJsonBody(req)

    const { client_id, analysis_name, mode, payload } = body
    if (!analysis_name) return sendJson(400, { error: 'analysis_name required' })

    const rows = await sql`
      INSERT INTO financial_analyses (client_id, analysis_name, mode, payload_json, created_by_user_id)
      VALUES (${client_id}, ${analysis_name}, ${mode}, ${JSON.stringify(payload)}, ${actor.userId})
      RETURNING *
    `

    return sendJson(201, { data: rows[0] })
  }

  if (method === 'GET') {
    const rows = await sql`SELECT * FROM financial_analyses ORDER BY created_at DESC LIMIT 50`
    return sendJson(200, { data: rows })
  }
}
