// api/auth/logout.js
// POST /api/auth/logout
// Clears the backend session cookie and returns a success response.

const COOKIE_NAME = (process.env.AUTH_COOKIE_NAME ?? '').trim() || 'solarinvest_session'

function isProductionEnv() {
  return (
    process.env.NODE_ENV === 'production' ||
    (typeof process.env.VERCEL_ENV === 'string' &&
      process.env.VERCEL_ENV !== 'development')
  )
}

export default async function handler(req, res) {
  // Pre-flight (CORS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS')
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
    return
  }

  const secure = isProductionEnv() ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`,
  )
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: true }))
}
