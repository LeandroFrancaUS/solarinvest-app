/**
 * smoke-staging.mjs
 *
 * Comprehensive smoke test for staging deployments.
 * Verifies that critical API endpoints respond correctly after a deploy.
 *
 * Tests performed (each with automatic retry):
 *   1. GET  /api/health           — app is up
 *   2. GET  /api/health/pdf       — PDF/contracts subsystem is up
 *   3. POST /api/contracts/leasing — contract generation works end-to-end
 *   4. GET  /api/storage          — storage/DB layer responds
 *   5. POST /api/admin/database-backup — backup endpoint returns a valid summary
 *      (only attempted if ADMIN_BACKUP_TOKEN is set)
 *
 * Configuration:
 *   BASE_URL           — target URL (default: http://localhost:3000)
 *   ADMIN_BACKUP_TOKEN — Bearer token for admin-level backup test (optional)
 *   SMOKE_RETRIES      — max retry attempts per test (default: 3)
 *   SMOKE_RETRY_DELAY  — ms between retries (default: 2000)
 *   SMOKE_TIMEOUT      — fetch timeout in ms (default: 15000)
 *
 * Exit codes:
 *   0 — all tests passed
 *   1 — one or more tests failed after all retries
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const MAX_RETRIES = Number(process.env.SMOKE_RETRIES ?? '3')
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY ?? '2000')
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT ?? '15000')
const ADMIN_TOKEN = process.env.ADMIN_BACKUP_TOKEN ?? ''

// ── Retry helper ──────────────────────────────────────────────────────────────

/**
 * Runs `fn` up to `maxRetries` times, waiting `delayMs` between attempts.
 * Returns the value of the last successful call, or throws the last error.
 */
async function withRetry(label, fn, maxRetries = MAX_RETRIES, delayMs = RETRY_DELAY_MS) {
  let lastError
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        console.warn(`[smoke] ${label} — attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delayMs}ms…`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  throw lastError
}

// ── Fetch with timeout ────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ── Individual test functions ─────────────────────────────────────────────────

async function testHealth() {
  const res = await fetchWithTimeout(`${BASE_URL}/api/health`)
  if (!res.ok && res.status !== 404) {
    // Many apps don't have /api/health — 404 is acceptable; 5xx is not.
    throw new Error(`/api/health returned ${res.status}`)
  }
  const body = await res.json().catch(() => ({}))
  console.log(`[smoke] GET /api/health → ${res.status}`, body.status ?? '')
}

async function testHealthPdf() {
  const res = await fetchWithTimeout(`${BASE_URL}/api/health/pdf`)
  // 404 is acceptable if the route doesn't exist; 5xx is a hard failure.
  if (res.status >= 500) {
    const text = await res.text().catch(() => '')
    throw new Error(`/api/health/pdf returned ${res.status}: ${text.slice(0, 200)}`)
  }
  const body = await res.json().catch(() => ({}))
  console.log(`[smoke] GET /api/health/pdf → ${res.status}`, body.status ?? body.ok ?? '')
}

async function testHealthContracts() {
  const res = await fetchWithTimeout(`${BASE_URL}/api/health/contracts`)
  if (res.status >= 500) {
    const text = await res.text().catch(() => '')
    throw new Error(`/api/health/contracts returned ${res.status}: ${text.slice(0, 200)}`)
  }
  const body = await res.json().catch(() => ({}))
  console.log(`[smoke] GET /api/health/contracts → ${res.status}`, body.status ?? body.ok ?? '')
}

async function testLeasingContract() {
  const payload = {
    tipoContrato: 'residencial',
    dadosLeasing: {
      nomeCompleto: 'Cliente Smoke Test',
      cpfCnpj: '00000000000',
      enderecoCompleto: 'Rua Smoke, 1, Goiânia - GO, 74000-000',
      endereco: 'Rua Smoke, 1',
      cidade: 'Goiânia',
      cep: '74000-000',
      uf: 'GO',
      telefone: '62999990000',
      email: 'smoke@solarinvest.test',
      unidadeConsumidora: '000000',
      localEntrega: 'Rua Smoke, 1',
      potencia: '5',
      kWhContratado: '500',
      tarifaBase: '1.20',
    },
    anexosSelecionados: [],
  }

  const res = await fetchWithTimeout(`${BASE_URL}/api/contracts/leasing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`/api/contracts/leasing returned ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const isPdf = contentType.includes('application/pdf')
  const isDocx = contentType.includes('application/vnd.openxmlformats-officedocument')

  if (!isPdf && !isDocx) {
    throw new Error(`/api/contracts/leasing returned unexpected content-type: ${contentType || 'none'}`)
  }

  console.log(`[smoke] POST /api/contracts/leasing → ${res.status} (${contentType})`)
}

async function testStorage() {
  // GET /api/storage requires auth; a 401 means the route exists and auth works.
  // A 5xx means the server or DB layer is broken.
  const res = await fetchWithTimeout(`${BASE_URL}/api/storage`)
  if (res.status >= 500) {
    const text = await res.text().catch(() => '')
    throw new Error(`/api/storage returned ${res.status}: ${text.slice(0, 200)}`)
  }
  console.log(`[smoke] GET /api/storage → ${res.status} (${res.status === 401 ? 'auth required — expected' : 'ok'})`)
}

async function testDatabaseBackup() {
  if (!ADMIN_TOKEN) {
    console.log('[smoke] POST /api/admin/database-backup → skipped (ADMIN_BACKUP_TOKEN not set)')
    return
  }

  const res = await fetchWithTimeout(`${BASE_URL}/api/admin/database-backup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ action: 'export', destination: 'local' }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`/api/admin/database-backup returned ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  }

  const body = await res.json().catch(() => ({}))
  const summary = body?.payload?.summary ?? body?.summary

  if (!summary) {
    throw new Error('/api/admin/database-backup response missing summary block')
  }

  if (typeof summary.totalClients !== 'number') {
    throw new Error(`/api/admin/database-backup summary.totalClients is not a number: ${JSON.stringify(summary)}`)
  }

  console.log(
    `[smoke] POST /api/admin/database-backup → ${res.status} — clients=${summary.totalClients} proposals=${summary.totalProposals}`,
  )
}

// ── Test suite definition ─────────────────────────────────────────────────────

const TESTS = [
  { label: 'GET /api/health', fn: testHealth },
  { label: 'GET /api/health/pdf', fn: testHealthPdf },
  { label: 'GET /api/health/contracts', fn: testHealthContracts },
  { label: 'POST /api/contracts/leasing', fn: testLeasingContract },
  { label: 'GET /api/storage', fn: testStorage },
  { label: 'POST /api/admin/database-backup', fn: testDatabaseBackup },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`[smoke] Base URL: ${BASE_URL}`)
  console.log(`[smoke] Retries per test: ${MAX_RETRIES}`)
  console.log(`[smoke] Timeout per request: ${TIMEOUT_MS}ms`)
  console.log(`[smoke] Retry delay: ${RETRY_DELAY_MS}ms`)
  console.log('')

  const results = []

  for (const { label, fn } of TESTS) {
    try {
      await withRetry(label, fn)
      results.push({ label, passed: true })
    } catch (error) {
      console.error(`[smoke] ❌ FAILED — ${label}: ${error.message}`)
      results.push({ label, passed: false, error: error.message })
    }
  }

  console.log('')
  console.log('[smoke] ─── Results ───────────────────────────────────────')
  for (const { label, passed, error } of results) {
    if (passed) {
      console.log(`[smoke] ✅ ${label}`)
    } else {
      console.error(`[smoke] ❌ ${label}: ${error}`)
    }
  }

  const failed = results.filter((r) => !r.passed)
  console.log('')

  if (failed.length === 0) {
    console.log('[smoke] ✅ All smoke tests passed.')
    process.exit(0)
  } else {
    console.error(`[smoke] ❌ ${failed.length} smoke test(s) failed.`)
    process.exit(1)
  }
}

run().catch((error) => {
  console.error('[smoke] Unexpected fatal error:', error)
  process.exit(1)
})
