import { isDevelopment } from '../config.js'

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message })
}

export function applySecurityHeaders(res) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  )
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), usb=(), fullscreen=*',
  )
  if (!isDevelopment()) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }
}
