import { ContractsService } from '../database/contractsService.js'
import { requireAuth } from '../middleware/requireAuth.js'

const CONTRACTS_API_PATH = '/api/contracts'

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req, maxBytes = 256 * 1024) {
  if (!req.readable) {
    return {}
  }

  let accumulated = ''
  let totalLength = 0

  req.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      totalLength += chunk.length
      if (totalLength > maxBytes) {
        reject(new Error('Payload acima do limite permitido.'))
        return
      }
      accumulated += chunk
    })

    req.on('end', () => {
      if (!accumulated) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(accumulated)
        resolve(parsed)
      } catch (error) {
        reject(new Error('JSON inválido na requisição.'))
      }
    })

    req.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Handle contracts API requests
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {object} databaseClient - Database client
 * @param {string} pathname - Request pathname
 */
export async function handleContractsRequest(req, res, databaseClient, pathname) {
  const contractsService = new ContractsService(databaseClient.sql)

  await requireAuth(req, res, async () => {
    const userId = req.user?.id
    if (!userId) {
      sendJson(res, 401, { error: 'Usuário não autenticado' })
      return
    }

    const method = req.method?.toUpperCase() ?? 'GET'
    const url = new URL(req.url, 'http://localhost')
    const pathSegments = pathname.split('/').filter(Boolean)
    const contractId = pathSegments.length > 2 ? pathSegments[2] : null

    try {
      // POST /api/contracts/generate - Generate and save contract record
      if (method === 'POST' && pathname === '/api/contracts/generate') {
        const body = await readJsonBody(req)
        
        if (!body.uf || !body.templateKey) {
          sendJson(res, 400, { 
            error: 'UF e templateKey são obrigatórios',
            required: ['uf', 'templateKey']
          })
          return
        }

        // Create contract record
        const contract = await contractsService.createContract(userId, {
          clientId: body.clientId,
          uf: body.uf,
          templateKey: body.templateKey,
          status: 'generated',
          contractType: body.contractType || 'leasing',
          metadata: body.metadata || {}
        })

        sendJson(res, 201, {
          success: true,
          contract,
          message: 'Contrato criado com sucesso. Use o endpoint de renderização para gerar o PDF.'
        })
        return
      }

      // GET /api/contracts/:id - Get specific contract
      if (method === 'GET' && contractId) {
        const contract = await contractsService.getContract(userId, contractId)
        if (!contract) {
          sendJson(res, 404, { error: 'Contrato não encontrado' })
          return
        }
        sendJson(res, 200, contract)
        return
      }

      // GET /api/contracts - List contracts
      if (method === 'GET') {
        const page = url.searchParams.get('page')
        const perPage = url.searchParams.get('perPage')

        const result = await contractsService.listContracts(userId, {
          page,
          perPage
        })
        sendJson(res, 200, result)
        return
      }

      // PUT /api/contracts/:id/status - Update contract status
      if (method === 'PUT' && contractId && pathname.endsWith('/status')) {
        const body = await readJsonBody(req)
        
        if (!body.status) {
          sendJson(res, 400, { error: 'Status é obrigatório' })
          return
        }

        const contract = await contractsService.updateContractStatus(userId, contractId, body.status)
        
        if (!contract) {
          sendJson(res, 404, { error: 'Contrato não encontrado' })
          return
        }

        sendJson(res, 200, contract)
        return
      }

      sendJson(res, 405, { error: 'Método não suportado' })
    } catch (error) {
      console.error('[contracts] Erro ao processar requisição:', error)
      sendJson(res, 500, { 
        error: 'Erro ao processar requisição',
        message: error.message
      })
    }
  })
}

export { CONTRACTS_API_PATH }
