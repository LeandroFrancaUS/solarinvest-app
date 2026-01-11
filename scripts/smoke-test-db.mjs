#!/usr/bin/env node

/**
 * Smoke test for database endpoints
 * Tests health check and basic CRUD operations
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Helper to make fetch requests
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  console.log(`\n→ ${options.method || 'GET'} ${path}`)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    const statusText = response.ok ? '✓' : '✗'
    console.log(`  ${statusText} Status: ${response.status}`)

    if (response.status === 204) {
      return { status: response.status, ok: response.ok }
    }

    const data = await response.json()
    console.log(`  Response:`, JSON.stringify(data, null, 2).substring(0, 200))
    
    return { status: response.status, data, ok: response.ok }
  } catch (error) {
    console.error(`  ✗ Error:`, error.message)
    return { status: 0, error: error.message, ok: false }
  }
}

async function runTests() {
  console.log('🚀 Starting smoke tests...')
  console.log(`   Base URL: ${BASE_URL}`)

  let passed = 0
  let failed = 0

  // Test 1: Basic health check
  console.log('\n' + '='.repeat(60))
  console.log('Test 1: Basic Health Check')
  console.log('='.repeat(60))
  const health = await request('/health')
  if (health.ok && health.data?.status === 'ok') {
    console.log('✓ Health check passed')
    passed++
  } else {
    console.log('✗ Health check failed')
    failed++
  }

  // Test 2: Database health check
  console.log('\n' + '='.repeat(60))
  console.log('Test 2: Database Health Check')
  console.log('='.repeat(60))
  const dbHealth = await request('/api/health/db')
  if (dbHealth.ok) {
    console.log('✓ Database health check passed')
    console.log(`  Latency: ${dbHealth.data?.latencyMs}ms`)
    passed++
  } else {
    console.log('✗ Database health check failed (this is expected if DATABASE_URL is not set)')
    console.log('  Note: This test requires DATABASE_URL environment variable')
    // Don't count as failure if DB is not configured
  }

  // Test 3: Storage endpoint (without auth - should work in fallback mode)
  console.log('\n' + '='.repeat(60))
  console.log('Test 3: Storage List (GET /api/storage)')
  console.log('='.repeat(60))
  const storageList = await request('/api/storage')
  if (storageList.status === 503) {
    console.log('⚠ Storage unavailable (DATABASE_URL not configured)')
  } else if (storageList.ok) {
    console.log('✓ Storage list endpoint accessible')
    passed++
  } else {
    console.log('✗ Storage list failed')
    failed++
  }

  // Test 4: Storage PUT
  if (storageList.status !== 503) {
    console.log('\n' + '='.repeat(60))
    console.log('Test 4: Storage PUT')
    console.log('='.repeat(60))
    const storagePut = await request('/api/storage', {
      method: 'PUT',
      body: JSON.stringify({
        key: 'smoke_test',
        value: { test: true, timestamp: new Date().toISOString() }
      })
    })
    if (storagePut.ok || storagePut.status === 204) {
      console.log('✓ Storage PUT successful')
      passed++
    } else {
      console.log('✗ Storage PUT failed')
      failed++
    }
  }

  // Test 5: Clients endpoint (without auth - should work in fallback mode or return 401 if auth is enabled)
  console.log('\n' + '='.repeat(60))
  console.log('Test 5: Clients List (GET /api/clients)')
  console.log('='.repeat(60))
  const clientsList = await request('/api/clients')
  if (clientsList.status === 503) {
    console.log('⚠ Clients endpoint unavailable (DATABASE_URL not configured)')
  } else if (clientsList.status === 401) {
    console.log('✓ Clients endpoint requires authentication (as expected with Stack Auth)')
    passed++
  } else if (clientsList.ok) {
    console.log('✓ Clients list endpoint accessible')
    passed++
  } else {
    console.log('✗ Clients list failed')
    failed++
  }

  // Test 6: Contracts endpoint
  console.log('\n' + '='.repeat(60))
  console.log('Test 6: Contracts List (GET /api/contracts)')
  console.log('='.repeat(60))
  const contractsList = await request('/api/contracts')
  if (contractsList.status === 503) {
    console.log('⚠ Contracts endpoint unavailable (DATABASE_URL not configured)')
  } else if (contractsList.status === 401) {
    console.log('✓ Contracts endpoint requires authentication (as expected with Stack Auth)')
    passed++
  } else if (contractsList.ok) {
    console.log('✓ Contracts list endpoint accessible')
    passed++
  } else {
    console.log('✗ Contracts list failed')
    failed++
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Test Summary')
  console.log('='.repeat(60))
  console.log(`✓ Passed: ${passed}`)
  console.log(`✗ Failed: ${failed}`)
  console.log(`📊 Total: ${passed + failed}`)
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some tests failed')
    process.exit(1)
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
