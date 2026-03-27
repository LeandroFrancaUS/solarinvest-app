// src/lib/auth/logout.ts
// Centralized logout orchestrator — browser-safe, Safari-hardened.

import { clearAllClientData } from '../persist/clearOnLogout'
import { perfLog, perfMeasure, perfNow } from '../../utils/perf'

type SignOutFn = () => Promise<unknown>

const LOCAL_CLEAR_TIMEOUT_MS = 2_000
const API_LOGOUT_TIMEOUT_MS = 3_000
const STACK_SIGNOUT_TIMEOUT_MS = 2_000

let logoutInFlight: Promise<void> | null = null

function logDev(tag: string, ...args: unknown[]): void {
  if (!import.meta.env.DEV) return
  console.debug(tag, ...args)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      resolve(null)
    }, timeoutMs)

    promise
      .then((value) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(null)
      })
  })
}

function clearStackAuthCookies(): void {
  if (typeof document === 'undefined') return
  try {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
    const cookies = document.cookie.split(';')
    for (const rawCookie of cookies) {
      const eqIdx = rawCookie.indexOf('=')
      const name = (eqIdx >= 0 ? rawCookie.slice(0, eqIdx) : rawCookie).trim()
      if (!name) continue
      if (!name.startsWith('stack-') && !name.startsWith('__Host-stack-')) continue

      const secureAttr = (isHttps || name.startsWith('__Host-')) ? '; Secure' : ''
      document.cookie = `${name}=; Max-Age=0; Path=/${secureAttr}; SameSite=Lax`
      if (secureAttr) {
        document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=None`
        document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=None; Partitioned`
      }
    }
  } catch {
    // Non-fatal
  }
}

async function callServerLogout(): Promise<void> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => { controller.abort() }, API_LOGOUT_TIMEOUT_MS)
  try {
    logDev('[LOGOUT][API_START]')
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    })
    logDev('[LOGOUT][API_OK]', response.status)
  } catch (error) {
    logDev('[LOGOUT][API_FAIL]', error)
  } finally {
    window.clearTimeout(timer)
  }
}

async function runLogout(signOut?: SignOutFn): Promise<void> {
  const logoutStart = perfNow()
  perfLog('LOGOUT', 'START')

  try {
    logDev('[LOGOUT][LOCAL_CLEAR_START]')
    const clearStart = perfNow()
    const clearResult = await withTimeout(clearAllClientData(), LOCAL_CLEAR_TIMEOUT_MS)
    logDev(clearResult === null ? '[LOGOUT][LOCAL_CLEAR_TIMEOUT]' : '[LOGOUT][LOCAL_CLEAR_DONE]')
    perfMeasure('LOGOUT', 'LOCAL_CLEAR_DONE', clearStart, {
      timedOut: clearResult === null,
    })

    const remoteTasks: Array<Promise<unknown>> = [callServerLogout()]

    if (signOut) {
      logDev('[LOGOUT][STACK_START]')
      const signOutTask = withTimeout(
        signOut().catch((error) => {
          logDev('[LOGOUT][STACK_FAIL]', error)
        }),
        STACK_SIGNOUT_TIMEOUT_MS,
      ).then((signOutResult) => {
        logDev(signOutResult === null ? '[LOGOUT][STACK_FAIL]' : '[LOGOUT][STACK_OK]')
        return signOutResult
      })
      remoteTasks.push(signOutTask)
    }

    await Promise.allSettled(remoteTasks)
  } finally {
    clearStackAuthCookies()
    perfMeasure('LOGOUT', 'DONE', logoutStart)
    logDev('[LOGOUT][REDIRECT] /')
    window.location.assign('/')
  }
}

export async function performLogout(signOut?: SignOutFn): Promise<void> {
  if (logoutInFlight) return logoutInFlight

  logoutInFlight = runLogout(signOut).finally(() => {
    logoutInFlight = null
  })

  return logoutInFlight
}
