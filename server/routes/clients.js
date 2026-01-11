import { ClientsService } from '../database/clientsService.js'
import { requireAuth } from '../middleware/requireAuth.js'

const CLIENTS_API_PATH = '/api/clients'

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function sendNoContent(res) {
  res.statusCode = 204
  res.end()
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
 * Handle clients API requests
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {object} databaseClient - Database client
 * @param {string} pathname - Request pathname
 */
export async function handleClientsRequest(req, res, databaseClient, pathname) {
  const clientsService = new ClientsService(databaseClient.sql)

  await requireAuth(req, res, async () => {
    const userId = req.user?.id
    if (!userId) {
      sendJson(res, 401, { error: 'Usuário não autenticado' })
      return
    }

    const method = req.method?.toUpperCase() ?? 'GET'
    const url = new URL(req.url, 'http://localhost')
    const pathSegments = pathname.split('/').filter(Boolean)
    const clientId = pathSegments.length > 2 ? pathSegments[2] : null

    try {
      // GET /api/clients/:id - Get specific client
      if (method === 'GET' && clientId) {
        const client = await clientsService.getClient(userId, clientId)
        if (!client) {
          sendJson(res, 404, { error: 'Cliente não encontrado' })
          return
        }
        sendJson(res, 200, client)
        return
      }

      // GET /api/clients - List clients
      if (method === 'GET') {
        const page = url.searchParams.get('page')
        const perPage = url.searchParams.get('perPage')
        const search = url.searchParams.get('search')

        const result = await clientsService.listClients(userId, {
          page,
          perPage,
          search
        })
        sendJson(res, 200, result)
        return
      }

      // POST /api/clients - Create client
      if (method === 'POST') {
        const body = await readJsonBody(req)
        
        if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
          sendJson(res, 400, { error: 'Nome do cliente é obrigatório' })
          return
        }

        const client = await clientsService.createClient(userId, body)
        sendJson(res, 201, client)
        return
      }

      // PUT /api/clients/:id - Update client
      if (method === 'PUT' && clientId) {
        const body = await readJsonBody(req)
        const client = await clientsService.updateClient(userId, clientId, body)
        
        if (!client) {
          sendJson(res, 404, { error: 'Cliente não encontrado' })
          return
        }

        sendJson(res, 200, client)
        return
      }

      // DELETE /api/clients/:id - Delete client
      if (method === 'DELETE' && clientId) {
        const deleted = await clientsService.deleteClient(userId, clientId)
        
        if (!deleted) {
          sendJson(res, 404, { error: 'Cliente não encontrado' })
          return
        }

        sendNoContent(res)
        return
      }

      sendJson(res, 405, { error: 'Método não suportado' })
    } catch (error) {
      console.error('[clients] Erro ao processar requisição:', error)
      sendJson(res, 500, { 
        error: 'Erro ao processar requisição',
        message: error.message
      })
    }
  })
}

export { CLIENTS_API_PATH }
