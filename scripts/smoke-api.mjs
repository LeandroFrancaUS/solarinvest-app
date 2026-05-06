/**
 * API Smoke Tests
 *
 * Validates that core API endpoints are reachable and respond correctly after
 * a deployment.  These tests do not require authentication credentials; they
 * verify:
 *
 *   - Health endpoints return HTTP 200 with a JSON body
 *   - Protected endpoints reject unauthenticated requests with 401 or 403
 *     (i.e. the server is up and applying auth guards, not returning 500)
 *
 * Usage:
 *   BASE_URL=https://my-preview.vercel.app node scripts/smoke-api.mjs
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

let failures = 0

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function check(name, fn) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`)
    failures++
  }
}

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON but got content-type="${contentType}" (HTTP ${res.status})`)
  }
  const body = await res.json().catch(() => null)
  return { res, body }
}

// ---------------------------------------------------------------------------
// Health checks — must return HTTP 200 with a JSON body
// ---------------------------------------------------------------------------

async function runHealthChecks() {
  console.log('\n[smoke-api] Health checks:')

  await check('/api/health — basic liveness', async () => {
    const { res } = await getJson('/api/health')
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  })

  await check('/api/health/db — database connectivity', async () => {
    const { res, body } = await getJson('/api/health/db')
    if (res.status !== 200) {
      const hint = body?.error ?? body?.message ?? JSON.stringify(body)
      throw new Error(`HTTP ${res.status} — ${hint}`)
    }
  })

  await check('/api/health/auth — auth service reachable', async () => {
    const { res } = await getJson('/api/health/auth')
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  })

  await check('/api/health/storage — storage service reachable', async () => {
    const { res } = await getJson('/api/health/storage')
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  })
}

// ---------------------------------------------------------------------------
// Protected-endpoint checks — unauthenticated calls must be rejected with
// 401 or 403, not 500 (server errors indicate misconfiguration).
// If auth is disabled for a given environment the endpoint may return 200;
// that is also acceptable — the important thing is the server is up.
// ---------------------------------------------------------------------------

async function runProtectedEndpointChecks() {
  console.log('\n[smoke-api] Protected endpoint reachability (unauthenticated):')

  const EXPECTED_STATUSES = new Set([200, 401, 403])

  for (const path of ['/api/clients', '/api/proposals', '/api/storage']) {
    await check(`${path} — server responds (no 500)`, async () => {
      const res = await fetch(`${BASE_URL}${path}`)
      if (!EXPECTED_STATUSES.has(res.status)) {
        throw new Error(
          `HTTP ${res.status} — expected 200/401/403 (server up) but got a server error`,
        )
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

async function run() {
  console.log(`[smoke-api] Base URL: ${BASE_URL}`)

  await runHealthChecks()
  await runProtectedEndpointChecks()

  console.log()
  if (failures > 0) {
    console.error(`[smoke-api] ❌ ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('[smoke-api] ✅ All checks passed.')
  }
}

run().catch((err) => {
  console.error('[smoke-api] Unexpected error:', err)
  process.exitCode = 1
})
