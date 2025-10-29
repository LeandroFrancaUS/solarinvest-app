export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const CSRF_COOKIE_NAME = 'solarinvest_csrf'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  if (!match) return null
  const [, value] = match.split('=')
  try {
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}

export interface ApiFetchOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  skipCsrf?: boolean
}

export interface ApiError extends Error {
  status?: number
  details?: unknown
}

function buildApiError(message: string, status?: number, details?: unknown): ApiError {
  const error = new Error(message) as ApiError
  error.status = status
  error.details = details
  return error
}

export async function apiFetch<TResponse = unknown>(path: string, options: ApiFetchOptions = {}): Promise<TResponse> {
  const method = options.method ?? 'GET'
  const headers = new Headers({ Accept: 'application/json', ...(options.headers ?? {}) })
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers,
  }

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    init.body = JSON.stringify(options.body)
  }

  if (!options.skipCsrf && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME)
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }
  }

  const response = await fetch(path, init)
  const contentType = response.headers.get('content-type')
  const isJson = contentType && contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error ?? `Erro HTTP ${response.status}`
    throw buildApiError(message, response.status, payload)
  }

  return (payload as TResponse) ?? ({} as TResponse)
}
