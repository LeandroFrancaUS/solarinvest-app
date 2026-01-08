import { requireGraphConfig } from './graphConfig.js'

const TOKEN_ENDPOINT_BASE = 'https://login.microsoftonline.com'
const TOKEN_SKEW_MS = 60 * 1000

let cachedToken = null

const buildTokenEndpoint = (tenantId) => `${TOKEN_ENDPOINT_BASE}/${tenantId}/oauth2/v2.0/token`

export const getGraphAccessToken = async () => {
  const config = requireGraphConfig()
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - TOKEN_SKEW_MS > now) {
    return cachedToken.token
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
    scope: config.scope,
  })

  const response = await fetch(buildTokenEndpoint(config.tenantId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error('Falha ao autenticar no Microsoft Graph.')
  }

  const payload = await response.json()
  if (!payload?.access_token) {
    throw new Error('Resposta inválida ao autenticar no Microsoft Graph.')
  }

  const expiresIn = Number(payload.expires_in) || 0
  cachedToken = {
    token: payload.access_token,
    expiresAt: now + expiresIn * 1000,
  }

  return cachedToken.token
}
