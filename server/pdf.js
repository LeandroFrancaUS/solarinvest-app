import { convertDocxBufferToPdfBuffer, isGraphConfigured, sanitizeFileName } from './docxToPdf/index.js'
import { parseMultipartFormData } from './docxToPdf/multipart.js'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

const readBodyBuffer = async (req, maxBytes) => {
  let total = 0
  const chunks = []

  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > maxBytes) {
        reject(new Error('Payload acima do limite permitido.'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', (error) => reject(error))
  })
}

const parseMultipartDocx = (bodyBuffer, contentType) => {
  const boundaryMatch = /boundary=(.+)$/i.exec(contentType)
  if (!boundaryMatch) {
    throw new Error('Boundary não encontrado no multipart/form-data.')
  }
  const boundary = boundaryMatch[1].replace(/^\"|\"$/g, '')
  const parts = parseMultipartFormData(bodyBuffer, boundary)
  const filePart = parts.find((part) => part.filename)
  if (!filePart || !filePart.content || filePart.content.length === 0) {
    throw new Error('Arquivo DOCX não encontrado no payload.')
  }
  return {
    buffer: filePart.content,
    fileName: filePart.filename,
  }
}

const parseJsonDocx = (bodyBuffer) => {
  const raw = bodyBuffer.toString('utf8')
  const payload = raw ? JSON.parse(raw) : {}
  const base64 = typeof payload?.docxBase64 === 'string' ? payload.docxBase64 : ''
  if (!base64) {
    throw new Error('Payload JSON sem docxBase64.')
  }
  const buffer = Buffer.from(base64, 'base64')
  return {
    buffer,
    fileName: payload?.fileName || 'documento.docx',
  }
}

const getContractId = (req) => {
  const headerValue = typeof req.headers['x-contract-id'] === 'string' ? req.headers['x-contract-id'] : ''
  return headerValue.trim() || undefined
}

export const handleDocxToPdfRequest = async (req, res, { requestId } = {}) => {
  if (requestId) {
    res.setHeader('X-Request-Id', requestId)
  }
  if (req.method && req.method.toUpperCase() === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Allow', 'POST,OPTIONS')
    res.end()
    return
  }
  if (!req.method || req.method.toUpperCase() !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST,OPTIONS')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Método não permitido.' }))
    return
  }

  if (!isGraphConfigured()) {
    res.statusCode = 424
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      error: 'Conversão indisponível. Verifique as variáveis de ambiente do Microsoft Graph.',
    }))
    return
  }

  const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : ''
  if (!contentType) {
    res.statusCode = 415
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Content-Type não informado.' }))
    return
  }

  try {
    const bodyBuffer = await readBodyBuffer(req, MAX_UPLOAD_BYTES)

    let docxBuffer
    let fileName

    if (contentType.includes('multipart/form-data')) {
      const result = parseMultipartDocx(bodyBuffer, contentType)
      docxBuffer = result.buffer
      fileName = result.fileName
    } else if (contentType.includes('application/json')) {
      const result = parseJsonDocx(bodyBuffer)
      docxBuffer = result.buffer
      fileName = result.fileName
    } else {
      res.statusCode = 415
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Content-Type não suportado.' }))
      return
    }

    if (docxBuffer.length > MAX_UPLOAD_BYTES) {
      res.statusCode = 413
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Arquivo excede o tamanho máximo permitido.' }))
      return
    }

    const contractId = getContractId(req)
    const safeFileName = sanitizeFileName(fileName || `contract-${Date.now()}.docx`)

    console.info({
      scope: 'docx-to-pdf',
      step: 'request_received',
      requestId,
      contractId,
      status: 'started',
    })

    const pdfBuffer = await convertDocxBufferToPdfBuffer(docxBuffer, {
      fileName: safeFileName,
      requestId,
      contractId,
    })

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="Contrato_SolarInvest.pdf"')
    res.setHeader('Cache-Control', 'no-store')
    res.end(pdfBuffer)

    console.info({
      scope: 'docx-to-pdf',
      step: 'request_completed',
      requestId,
      contractId,
      status: 'ok',
    })
  } catch (error) {
    const statusCode = error?.message?.includes('Payload acima do limite') ? 413 : 500
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Falha ao converter DOCX para PDF.' }))

    console.warn({
      scope: 'docx-to-pdf',
      step: 'request_failed',
      requestId,
      contractId: getContractId(req),
      status: statusCode,
    })
  }
}
