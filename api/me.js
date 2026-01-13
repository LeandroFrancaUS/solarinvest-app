// api/me.js
import { getCurrentAppUser } from '../server/auth/currentAppUser.js'

export default async function handler(req, res) {
  try {
    const user = await getCurrentAppUser(req)
    if (!user) {
      res.status(401).json({ error: 'Not authenticated (or not in app_users)' })
      return
    }

    res.status(200).json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      status: user.status,
    })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' })
  }
}
