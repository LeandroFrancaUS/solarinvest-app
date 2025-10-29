import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import util from 'node:util'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const execFilePromise = util.promisify(execFile)

export const CONTRACT_RENDER_PATH = '/api/contracts/render'
export const CONTRACT_TEMPLATES_PATH = '/api/contracts/templates'

const CONTRACT_TEMPLATE_CATEGORIES = new Set(['leasing', 'vendas'])
const DEFAULT_TEMPLATE_CATEGORY = 'leasing'
const DEFAULT_TEMPLATE_FILE_NAME = 'CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO.docx'
const CONTRACT_TEMPLATES_DIR_RELATIVE = 'assets/templates/contratos'
const DEFAULT_TEMPLATE_FILE = path.join(DEFAULT_TEMPLATE_CATEGORY, DEFAULT_TEMPLATE_FILE_NAME)
const TMP_DIR = path.resolve(process.cwd(), 'tmp')
const MAX_BODY_SIZE_BYTES = 256 * 1024

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: true,
  trimValues: false,
})

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  preserveOrder: true,
})

class ContractRenderError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   */
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.name = 'ContractRenderError'
  }
}

class LibreOfficeConversionError extends Error {
  /**
   * @param {string} message
   * @param {{ tried?: Array<{ binary: string, error: unknown }> }} [details]
   */
  constructor(message, details = undefined) {
    super(message)
    this.name = 'LibreOfficeConversionError'
    this.details = details
  }
}

class GoogleDriveConversionError extends Error {
  /**
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(message, cause = undefined) {
    super(message)
    this.name = 'GoogleDriveConversionError'
    if (cause) {
      this.cause = cause
    }
  }
}

let jsZipLoaderPromise

const loadJsZip = async () => {
  if (!jsZipLoaderPromise) {
    jsZipLoaderPromise = import('jszip')
      .then((module) => module.default ?? module)
      .catch((error) => {
        jsZipLoaderPromise = undefined
        if (error && (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND')) {
          throw new ContractRenderError(
            500,
            'Dependência de geração de contratos ausente (jszip). Execute "npm install" para habilitar este recurso.',
          )
        }
        throw error
      })
  }
  return jsZipLoaderPromise
}

/**
 * @param {import('node:http').ServerResponse} res
 */
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')
}

const maskCpfCnpj = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) {
    return ''
  }
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

const replaceTagsInValue = (text, data) => {
  const replaceTag = (input, key, value) =>
    input
      .replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '')
      .replace(new RegExp(`\\{${key}\\}`, 'g'), value ?? '')

  return replaceTag(
    replaceTag(
      replaceTag(
        replaceTag(
          replaceTag(text, 'nomeCompleto', data.nomeCompleto ?? ''),
          'cpfCnpj',
          maskCpfCnpj(data.cpfCnpj),
        ),
        'enderecoCompleto',
        data.enderecoCompleto ?? '',
      ),
      'unidadeConsumidora',
      data.unidadeConsumidora ?? '',
    ),
    'dataAtualExtenso',
    data.dataAtualExtenso ?? '',
  )
}

const replaceTagsInNode = (node, data) => {
  if (typeof node === 'string') {
    return replaceTagsInValue(node, data)
  }
  if (Array.isArray(node)) {
    return node.map((item) => replaceTagsInNode(item, data))
  }
  if (node && typeof node === 'object') {
    const updated = {}
    for (const [key, value] of Object.entries(node)) {
      updated[key] = replaceTagsInNode(value, data)
    }
    return updated
  }
  return node
}

const replaceTagsInXml = (xmlContent, data) => {
  const parsed = xmlParser.parse(xmlContent)
  const replaced = replaceTagsInNode(parsed, data)
  return xmlBuilder.build(replaced)
}

const readJsonBody = async (req) => {
  let totalLength = 0
  let rawBody = ''

  req.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      totalLength += chunk.length
      if (totalLength > MAX_BODY_SIZE_BYTES) {
        reject(new ContractRenderError(413, 'Payload acima do limite permitido.'))
        return
      }
      rawBody += chunk
    })

    req.on('end', () => {
      if (!rawBody) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(rawBody)
        resolve(parsed)
      } catch (error) {
        reject(new ContractRenderError(400, 'JSON inválido na requisição.'))
      }
    })

    req.on('error', (error) => {
      reject(error)
    })
  })
}

const sanitizeTemplateCategory = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  return CONTRACT_TEMPLATE_CATEGORIES.has(normalized) ? normalized : null
}

const resolveTemplatePath = async (templateName) => {
  const trimmed = typeof templateName === 'string' ? templateName.trim() : ''
  let relativePath = DEFAULT_TEMPLATE_FILE

  if (trimmed) {
    const normalized = path.posix.normalize(trimmed.replace(/\\/g, '/'))
    const segments = normalized.split('/').filter(Boolean)
    if (segments.length === 1) {
      const fileName = path.basename(segments[0])
      if (!fileName.toLowerCase().endsWith('.docx')) {
        throw new ContractRenderError(400, 'Template de contrato inválido.')
      }
      relativePath = path.join(DEFAULT_TEMPLATE_CATEGORY, fileName)
    } else if (segments.length === 2) {
      const category = sanitizeTemplateCategory(segments[0])
      if (!category) {
        throw new ContractRenderError(400, 'Categoria de template inválida.')
      }
      const fileName = path.basename(segments[1])
      if (!fileName.toLowerCase().endsWith('.docx')) {
        throw new ContractRenderError(400, 'Template de contrato inválido.')
      }
      relativePath = path.join(category, fileName)
    } else {
      throw new ContractRenderError(400, 'Caminho de template inválido.')
    }
  }

  const absolutePath = path.resolve(process.cwd(), CONTRACT_TEMPLATES_DIR_RELATIVE, relativePath)
  try {
    await fs.access(absolutePath)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new ContractRenderError(404, 'Template de contrato não encontrado no servidor.')
    }
    throw new ContractRenderError(500, 'Não foi possível acessar o template do contrato.')
  }
  return { absolutePath, fileName: path.basename(relativePath) }
}

const buildEnderecoCompleto = (cliente) => {
  const partes = []
  const endereco = typeof cliente.endereco === 'string' ? cliente.endereco.trim() : ''
  const cidade = typeof cliente.cidade === 'string' ? cliente.cidade.trim() : ''
  const uf = typeof cliente.uf === 'string' ? cliente.uf.trim() : ''
  const cep = typeof cliente.cep === 'string' ? cliente.cep.trim() : ''

  if (endereco) {
    partes.push(endereco)
  }

  if (cidade || uf) {
    partes.push([cidade, uf].filter(Boolean).join('/'))
  }

  if (cep) {
    partes.push(cep)
  }

  return partes.join(', ')
}

const normalizeClientePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new ContractRenderError(400, 'Objeto "cliente" é obrigatório na requisição.')
  }

  const nomeCompleto = typeof payload.nomeCompleto === 'string' ? payload.nomeCompleto.trim() : ''
  const cpfCnpj = typeof payload.cpfCnpj === 'string' ? payload.cpfCnpj.trim() : ''
  const enderecoCompleto = typeof payload.enderecoCompleto === 'string' && payload.enderecoCompleto.trim()
    ? payload.enderecoCompleto.trim()
    : buildEnderecoCompleto(payload)
  const unidadeConsumidora = typeof payload.unidadeConsumidora === 'string' ? payload.unidadeConsumidora.trim() : ''

  const faltantes = []
  if (!nomeCompleto) faltantes.push('nome completo')
  if (!cpfCnpj) faltantes.push('CPF/CNPJ')
  if (!enderecoCompleto) faltantes.push('endereço completo')
  if (!unidadeConsumidora) faltantes.push('unidade consumidora (UC)')

  if (faltantes.length > 0) {
    const ultimo = faltantes[faltantes.length - 1]
    const inicio = faltantes.slice(0, -1)
    const mensagem = inicio.length > 0 ? `${inicio.join(', ')} e ${ultimo}` : ultimo
    throw new ContractRenderError(400, `Campos obrigatórios ausentes: ${mensagem}.`)
  }

  return {
    nomeCompleto,
    cpfCnpj,
    enderecoCompleto,
    unidadeConsumidora,
  }
}

const cleanupTmpFiles = async (...files) => {
  await Promise.all(
    files
      .filter(Boolean)
      .map(async (filePath) => {
        try {
          await fs.unlink(filePath)
        } catch (error) {
          if (error && error.code !== 'ENOENT') {
            console.warn(`[contracts] Não foi possível remover o arquivo temporário ${filePath}:`, error)
          }
        }
      }),
  )
}

const MACOS_LIBREOFFICE_BINARIES = [
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice.bin',
]

const getLibreOfficeCandidates = () => {
  const configured = typeof process.env.LIBREOFFICE_BIN === 'string'
    ? process.env.LIBREOFFICE_BIN.trim()
    : ''

  const candidates = []
  if (configured) {
    candidates.push(configured)
  }

  if (process.platform === 'darwin') {
    candidates.push(...MACOS_LIBREOFFICE_BINARIES)
  }

  candidates.push('soffice', 'libreoffice', 'lowriter')

  return [...new Set(candidates)]
}

const convertDocxToPdfUsingLibreOffice = async (docxPath) => {
  const args = ['--headless', '--convert-to', 'pdf', '--outdir', TMP_DIR, docxPath]

  const tried = []
  for (const binary of getLibreOfficeCandidates()) {
    try {
      await execFilePromise(binary, args)
      return
    } catch (error) {
      tried.push({ binary, error })

      // Se for erro diferente de binário inexistente, não há motivo para tentar outros
      if (!(error && error.code === 'ENOENT')) {
        break
      }
    }
  }

  const details = tried
    .map(({ binary, error }) =>
      `${binary}: ${error && error.code ? error.code : 'falha desconhecida'}`,
    )
    .join('; ')

  throw new LibreOfficeConversionError(
    details
      ? `Falha ao converter o contrato para PDF com o LibreOffice (tentativas: ${details}).`
      : 'Falha ao converter o contrato para PDF com o LibreOffice.',
    { tried },
  )
}

const GOOGLE_DRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

const base64UrlEncode = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

const getGoogleDriveCredentials = () => {
  const clientEmail = typeof process.env.GOOGLE_DRIVE_CLIENT_EMAIL === 'string'
    ? process.env.GOOGLE_DRIVE_CLIENT_EMAIL.trim()
    : ''
  const privateKeyRaw = typeof process.env.GOOGLE_DRIVE_PRIVATE_KEY === 'string'
    ? process.env.GOOGLE_DRIVE_PRIVATE_KEY.trim()
    : ''

  if (!clientEmail || !privateKeyRaw) {
    return undefined
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')

  return { clientEmail, privateKey }
}

const requestGoogleDriveAccessToken = async (clientEmail, privateKey) => {
  const headerSegment = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payloadSegment = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: GOOGLE_DRIVE_SCOPE,
      aud: GOOGLE_DRIVE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  )

  const toSign = `${headerSegment}.${payloadSegment}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(toSign)
  signer.end()
  const signature = signer.sign(privateKey)
  const signatureSegment = base64UrlEncode(signature)

  const assertion = `${toSign}.${signatureSegment}`

  const params = new URLSearchParams()
  params.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  params.set('assertion', assertion)

  const response = await fetch(GOOGLE_DRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new GoogleDriveConversionError(
      `Falha ao obter token de acesso do Google Drive (${response.status}).`,
      errorBody,
    )
  }

  const json = await response.json()
  if (!json || typeof json.access_token !== 'string') {
    throw new GoogleDriveConversionError('Resposta inválida ao obter token de acesso do Google Drive.', json)
  }

  return json.access_token
}

const uploadDocxToGoogleDrive = async (docxBuffer, accessToken) => {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const metadata = {
    name: `contrato_${Date.now()}.docx`,
    mimeType: 'application/vnd.google-apps.document',
  }

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
  )
  const middle = Buffer.from(
    `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`,
  )
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`)

  const body = Buffer.concat([preamble, middle, docxBuffer, closing])

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new GoogleDriveConversionError(
      `Falha ao enviar documento para o Google Drive (${response.status}).`,
      errorBody,
    )
  }

  const json = await response.json()
  if (!json || typeof json.id !== 'string') {
    throw new GoogleDriveConversionError('Resposta inválida ao enviar documento para o Google Drive.', json)
  }

  return json.id
}

const exportGoogleDriveFileToPdf = async (fileId, accessToken) => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf&supportsAllDrives=true`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new GoogleDriveConversionError(
      `Falha ao exportar documento do Google Drive (${response.status}).`,
      errorBody,
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

const deleteGoogleDriveFile = async (fileId, accessToken) => {
  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )
  } catch (error) {
    console.warn('[contracts] Falha ao remover arquivo temporário do Google Drive:', error)
  }
}

const convertDocxToPdfUsingGoogleDrive = async (docxPath, pdfPath) => {
  const credentials = getGoogleDriveCredentials()
  if (!credentials) {
    throw new GoogleDriveConversionError('Credenciais do Google Drive não configuradas.')
  }

  const accessToken = await requestGoogleDriveAccessToken(credentials.clientEmail, credentials.privateKey)
  const docxBuffer = await fs.readFile(docxPath)
  const fileId = await uploadDocxToGoogleDrive(docxBuffer, accessToken)

  try {
    const pdfBuffer = await exportGoogleDriveFileToPdf(fileId, accessToken)
    await fs.writeFile(pdfPath, pdfBuffer)
  } finally {
    await deleteGoogleDriveFile(fileId, accessToken)
  }
}

const convertDocxToPdf = async (docxPath, pdfPath) => {
  try {
    await convertDocxToPdfUsingLibreOffice(docxPath)
    return
  } catch (error) {
    if (!(error instanceof LibreOfficeConversionError)) {
      throw error
    }

    console.warn('[contracts] Falha na conversão via LibreOffice, tentando Google Drive...', error)

    try {
      await convertDocxToPdfUsingGoogleDrive(docxPath, pdfPath)
    } catch (driveError) {
      console.error('[contracts] Falha na conversão via Google Drive:', driveError)

      if (driveError instanceof GoogleDriveConversionError && driveError.message.includes('Credenciais')) {
        throw new ContractRenderError(
          500,
          'Falha ao converter o contrato para PDF com o LibreOffice. Configure as credenciais do Google Drive para usar o fallback.',
        )
      }

      throw new ContractRenderError(
        500,
        'Falha ao converter o contrato para PDF. Verifique o LibreOffice ou as credenciais do Google Drive.',
      )
    }
  }
}

const generateContractPdf = async (cliente, templateName) => {
  const { absolutePath: templatePath, fileName: templateFileName } =
    await resolveTemplatePath(templateName)
  const templateBuffer = await fs.readFile(templatePath)
  const JSZip = await loadJsZip()
  const zip = await JSZip.loadAsync(templateBuffer)

  const dataAtualExtenso = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const data = { ...cliente, dataAtualExtenso }

  const partNames = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(name),
  )

  await Promise.all(
    partNames.map(async (name) => {
      const file = zip.file(name)
      if (!file) {
        return
      }
      const xmlContent = await file.async('string')
      const replaced = replaceTagsInXml(xmlContent, data)
      zip.file(name, replaced)
    }),
  )

  await fs.mkdir(TMP_DIR, { recursive: true })
  const uniqueId = `contrato_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const docxPath = path.join(TMP_DIR, `${uniqueId}.docx`)
  const pdfPath = path.join(TMP_DIR, `${uniqueId}.pdf`)

  const docxBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  await fs.writeFile(docxPath, docxBuffer)

  try {
    await convertDocxToPdf(docxPath, pdfPath)
    const pdfBuffer = await fs.readFile(pdfPath)
    return { pdfBuffer, templateFileName }
  } catch (error) {
    if (error instanceof ContractRenderError) {
      throw error
    }

    if (error && error.code === 'ENOENT' && typeof error.path === 'string' && error.path.endsWith('.pdf')) {
      throw new ContractRenderError(500, 'PDF do contrato não foi gerado.')
    }

    throw new ContractRenderError(
      500,
      'Falha ao converter o contrato para PDF. Verifique se o LibreOffice está instalado corretamente.',
    )
  } finally {
    await cleanupTmpFiles(docxPath, pdfPath)
  }
}

const sanitizeTemplateDownloadName = (templateFileName) => {
  const withoutExtension = templateFileName.replace(/\.docx$/i, '')
  const normalized = withoutExtension.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/_+/g, '_')
  return normalized || 'Contrato'
}

const listAvailableTemplates = async (category) => {
  const directory = path.resolve(process.cwd(), CONTRACT_TEMPLATES_DIR_RELATIVE, category)
  let entries = []
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.docx'))
    .map((entry) => `${category}/${entry.name}`)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export const handleContractRenderRequest = async (req, res) => {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (!req.method || req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Método não permitido. Utilize POST.' }))
    return
  }

  try {
    const body = await readJsonBody(req)
    const template = typeof body?.template === 'string' ? body.template.trim() : ''

    const cliente = normalizeClientePayload(body.cliente)
    const { pdfBuffer, templateFileName } = await generateContractPdf(cliente, template)
    const downloadName = sanitizeTemplateDownloadName(templateFileName)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${downloadName}.pdf"`)
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    res.end(pdfBuffer)
  } catch (error) {
    const statusCode = error instanceof ContractRenderError ? error.statusCode : 500
    const message =
      error instanceof ContractRenderError
        ? error.message
        : 'Falha ao gerar contrato PDF. Verifique os logs do servidor.'

    if (!(error instanceof ContractRenderError)) {
      console.error('[contracts] Erro inesperado na geração de contrato:', error)
    }

    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}

export const createContractRenderMiddleware = () =>
  async (req, res, next) => {
    if (!req.url) {
      next()
      return
    }

    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === CONTRACT_RENDER_PATH) {
      await handleContractRenderRequest(req, res)
      return
    }

    if (url.pathname === CONTRACT_TEMPLATES_PATH) {
      await handleContractTemplatesRequest(req, res)
      return
    }

    next()
  }

export const handleContractTemplatesRequest = async (req, res) => {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (!req.method || req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Método não permitido. Utilize GET.' }))
    return
  }

  try {
    const requestUrl = req.url ? new URL(req.url, 'http://localhost') : null
    const categoryParam = requestUrl?.searchParams.get('categoria') ?? ''
    const category = sanitizeTemplateCategory(categoryParam) ?? DEFAULT_TEMPLATE_CATEGORY
    const templates = await listAvailableTemplates(category)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ templates }))
  } catch (error) {
    console.error('[contracts] Não foi possível listar templates de contrato:', error)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Não foi possível listar os templates de contrato.' }))
  }
}
