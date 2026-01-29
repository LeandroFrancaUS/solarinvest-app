const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

const payload = {
  tipoContrato: 'residencial',
  dadosLeasing: {
    nomeCompleto: 'Cliente Teste',
    cpfCnpj: '00000000000',
    enderecoCompleto: 'Rua Exemplo, 100, Goiânia - GO, 74000-000',
    endereco: 'Rua Exemplo, 100',
    cidade: 'Goiânia',
    cep: '74000-000',
    uf: 'GO',
    telefone: '62999990000',
    email: 'cliente@example.com',
    unidadeConsumidora: '123456',
    localEntrega: 'Rua Exemplo, 100',
    potencia: '5',
    kWhContratado: '500',
    tarifaBase: '1.20',
  },
  anexosSelecionados: [],
}

const run = async () => {
  console.log(`[smoke] Base URL: ${baseUrl}`)

  const healthResponse = await fetch(`${baseUrl}/api/health/pdf`)
  const healthBody = await healthResponse.json().catch(() => ({}))
  console.log('[smoke] /api/health/pdf', healthResponse.status, healthBody)

  const response = await fetch(`${baseUrl}/api/contracts/leasing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const contentType = response.headers.get('content-type') ?? ''
  const notice = response.headers.get('x-contracts-notice')
  const requestId = response.headers.get('x-request-id')

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[smoke] Leasing contracts failed:', response.status, errorText)
    process.exitCode = 1
    return
  }

  console.log('[smoke] Leasing contracts OK:', response.status, contentType)
  if (notice) {
    console.log('[smoke] Notice:', notice)
  }
  if (requestId) {
    console.log('[smoke] Request ID:', requestId)
  }

  const smokeResponse = await fetch(`${baseUrl}/api/contracts/leasing/smoke`, {
    method: 'POST',
  })
  const smokeBody = await smokeResponse.text()
  console.log('[smoke] /api/contracts/leasing/smoke', smokeResponse.status, smokeBody)
}

run().catch((error) => {
  console.error('[smoke] Unexpected error:', error)
  process.exitCode = 1
})
