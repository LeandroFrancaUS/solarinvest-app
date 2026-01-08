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

const ensureJsonError = async (response) => {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Resposta ${response.status} sem JSON (content-type=${contentType || 'n/a'}).`)
  }
  return response.json().catch(() => ({}))
}

const run = async () => {
  console.log(`[smoke] Base URL: ${baseUrl}`)

  const healthResponse = await fetch(`${baseUrl}/api/health/contracts`)
  const healthBody = await healthResponse.json().catch(() => ({}))
  console.log('[smoke] /api/health/contracts', healthResponse.status, healthBody)

  const response = await fetch(`${baseUrl}/api/contracts/leasing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const contentType = response.headers.get('content-type') ?? ''
  const requestId = response.headers.get('x-request-id')
  const vercelId = response.headers.get('x-vercel-id')

  if (!response.ok) {
    const errorBody = await ensureJsonError(response)
    console.error('[smoke] Leasing contracts failed:', response.status, errorBody)
    process.exitCode = 1
    return
  }

  const isPdf = contentType.includes('application/pdf')
  const isDocx = contentType.includes(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )

  if (!isPdf && !isDocx) {
    console.error('[smoke] Leasing contracts unexpected content-type:', contentType || 'n/a')
    process.exitCode = 1
    return
  }

  console.log('[smoke] Leasing contracts OK:', response.status, contentType)
  if (requestId) {
    console.log('[smoke] Request ID:', requestId)
  }
  if (vercelId) {
    console.log('[smoke] Vercel ID:', vercelId)
  }
}

run().catch((error) => {
  console.error('[smoke] Unexpected error:', error)
  process.exitCode = 1
})
