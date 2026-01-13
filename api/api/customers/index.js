import { getCurrentAppUser } from '../../server/auth/currentAppUser.js'
import { requireRole } from '../../server/auth/rbac.js'
import { query } from '../../server/db.js'

export default async function handler(req, res) {
  try {
    // 1) quem está logado?
    const appUser = await getCurrentAppUser(req)

    // 2) porteiro: quem pode entrar aqui?
    requireRole(appUser, ['admin', 'consultant', 'supervisor'])

    // 3) só GET por enquanto
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      res.status(405).end('Method Not Allowed')
      return
    }

    // 4) admin vê tudo, outros veem só os próprios
    const isAdmin = appUser.role === 'admin'

    const sql = isAdmin
      ? `SELECT * FROM public.customers ORDER BY created_at DESC LIMIT 100`
      : `SELECT * FROM public.customers WHERE created_by = $1 ORDER BY created_at DESC LIMIT 100`

    const params = isAdmin ? [] : [appUser.id]

    const { rows } = await query(sql, params)

    // 5) resposta
    res.status(200).json(rows)
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.message || 'Internal error',
    })
  }
}
