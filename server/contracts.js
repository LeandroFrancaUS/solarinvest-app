import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import util from 'node:util'
import JSZip from 'jszip'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const execFilePromise = util.promisify(execFile)

export const CONTRACT_RENDER_PATH = '/api/contracts/render'

const TEMPLATE_RELATIVE_PATH =
  'assets/templates/contratos/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO.docx'
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

/**
 * @param {import('node:http').ServerResponse} res
 */
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
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

const replaceTagsInValue = (text, data) =>
  text
    .replace(/{nomeCompleto}/g, data.nomeCompleto ?? '')
    .replace(/{cpfCnpj}/g, maskCpfCnpj(data.cpfCnpj))
    .replace(/{enderecoCompleto}/g, data.enderecoCompleto ?? '')
    .replace(/{unidadeConsumidora}/g, data.unidadeConsumidora ?? '')
    .replace(/{dataAtualExtenso}/g, data.dataAtualExtenso ?? '')

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

const ensureTemplateExists = async () => {
  const absolutePath = path.resolve(process.cwd(), TEMPLATE_RELATIVE_PATH)
  try {
    await fs.access(absolutePath)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new ContractRenderError(404, 'Template de contrato não encontrado no servidor.')
    }
    throw new ContractRenderError(500, 'Não foi possível acessar o template do contrato.')
  }
  return absolutePath
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

const generateContractPdf = async (cliente) => {
  const templatePath = await ensureTemplateExists()
  const templateBuffer = await fs.readFile(templatePath)
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
    await execFilePromise('soffice', [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      TMP_DIR,
      docxPath,
    ])

    const pdfBuffer = await fs.readFile(pdfPath)
    return pdfBuffer
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
    if (!body || body.template !== 'leasing') {
      throw new ContractRenderError(400, 'Template de contrato inválido.')
    }

    const cliente = normalizeClientePayload(body.cliente)
    const pdfBuffer = await generateContractPdf(cliente)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="Contrato_Leasing.pdf"')
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
    if (url.pathname !== CONTRACT_RENDER_PATH) {
      next()
      return
    }

    await handleContractRenderRequest(req, res)
    return
  }
