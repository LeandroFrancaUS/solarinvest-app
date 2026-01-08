const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000]

export class GraphRequestError extends Error {
  constructor(message, { status, retryable } = {}) {
    super(message)
    this.name = 'GraphRequestError'
    this.status = status
    this.retryable = Boolean(retryable)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getRetryDelayMs = (attempt, response) => {
  const retryAfterHeader = response?.headers?.get?.('Retry-After')
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000
  }
  return DEFAULT_RETRY_DELAYS_MS[Math.min(attempt, DEFAULT_RETRY_DELAYS_MS.length - 1)] ?? 0
}

const fetchWithTimeout = async (url, options, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export const requestWithRetry = async (requestFn, { retries = 5 } = {}) => {
  let attempt = 0
  while (true) {
    try {
      return await requestFn(attempt)
    } catch (error) {
      const retryable = error instanceof GraphRequestError ? error.retryable : false
      if (!retryable || attempt >= retries) {
        throw error
      }
      const delay = error?.retryAfterMs ?? DEFAULT_RETRY_DELAYS_MS[Math.min(attempt, DEFAULT_RETRY_DELAYS_MS.length - 1)] ?? 0
      if (delay > 0) {
        await sleep(delay)
      }
      attempt += 1
    }
  }
}

export const graphFetch = async (url, {
  method = 'GET',
  headers = {},
  body,
  accessToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  expectedStatus = 200,
  allowStatus = [],
  retryOnStatus = (status) => status === 429 || status >= 500,
  retries = 5,
} = {}) => {
  const mergedHeaders = {
    ...headers,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }

  return requestWithRetry(async (attempt) => {
    const response = await fetchWithTimeout(url, { method, headers: mergedHeaders, body }, timeoutMs)
    if (allowStatus.includes(response.status) || response.status === expectedStatus) {
      return response
    }
    if (retryOnStatus(response.status)) {
      const error = new GraphRequestError('Falha temporária ao comunicar com Microsoft Graph.', {
        status: response.status,
        retryable: true,
      })
      error.retryAfterMs = getRetryDelayMs(attempt, response)
      throw error
    }
    throw new GraphRequestError('Falha ao comunicar com Microsoft Graph.', {
      status: response.status,
      retryable: false,
    })
  }, { retries })
}

export const uploadFetch = async (url, {
  method = 'PUT',
  headers = {},
  body,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = 5,
} = {}) => {
  return requestWithRetry(async (attempt) => {
    const response = await fetchWithTimeout(url, { method, headers, body }, timeoutMs)
    if (response.ok || response.status === 202) {
      return response
    }
    if (response.status === 429 || response.status >= 500) {
      const error = new GraphRequestError('Falha temporária ao enviar arquivo.', {
        status: response.status,
        retryable: true,
      })
      error.retryAfterMs = getRetryDelayMs(attempt, response)
      throw error
    }
    throw new GraphRequestError('Falha ao enviar arquivo.', { status: response.status })
  }, { retries })
}
