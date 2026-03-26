type PerfDomain =
  | 'LOGIN'
  | 'NAV'
  | 'SCROLL'
  | 'PROPOSAL'
  | 'CONTRACT'
  | 'FILE'
  | 'LOGOUT'
  | 'BOOT'

type PerfLevel = 'debug' | 'warn' | 'error'

const isPerfEnabled = () => import.meta.env.DEV

const now = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

export function perfNow(): number {
  return now()
}

export function perfLog(domain: PerfDomain, tag: string, payload?: Record<string, unknown>, level: PerfLevel = 'debug') {
  if (!isPerfEnabled()) return
  const prefix = `[PERF][${domain}][${tag}]`
  if (level === 'warn') {
    console.warn(prefix, payload ?? '')
    return
  }
  if (level === 'error') {
    console.error(prefix, payload ?? '')
    return
  }
  console.debug(prefix, payload ?? '')
}

export function perfMeasure(
  domain: PerfDomain,
  tag: string,
  start: number,
  payload?: Record<string, unknown>,
): number {
  const elapsedMs = Math.round((now() - start) * 100) / 100
  perfLog(domain, tag, { elapsedMs, ...(payload ?? {}) })
  return elapsedMs
}
