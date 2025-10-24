import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import util from 'node:util'

const DOCX_PART_REGEX = /^word\/(document|header\d*|footer\d*)\.xml$/

const execFilePromise = util.promisify(execFile)

export const CONTRACT_RENDER_PATH = '/api/contracts/render'

const TEMPLATE_RELATIVE_PATH = 'assets/templates/contratos/CONTRATO_LEASING.dotx'
const TMP_DIR = path.resolve(process.cwd(), 'tmp')
const MAX_BODY_SIZE_BYTES = 256 * 1024

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

const escapeXmlText = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const replaceTagsInRun = (runXml, data) => {
  const nodes = []
  const textNodeRegex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g
  let cursor = 0
  let match

  while ((match = textNodeRegex.exec(runXml)) !== null) {
    if (match.index > cursor) {
      nodes.push(runXml.slice(cursor, match.index))
    }
    nodes.push({ open: match[1], text: match[2], close: match[3] })
    cursor = match.index + match[0].length
  }

  if (cursor < runXml.length) {
    nodes.push(runXml.slice(cursor))
  }

  const textNodes = nodes.filter((node) => typeof node !== 'string')
  if (textNodes.length === 0) {
    return runXml
  }

  const combined = textNodes.map((node) => node.text).join('')
  const replaced = replaceTagsInValue(combined, data)

  if (replaced === combined) {
    return runXml
  }

  let first = true
  return nodes
    .map((node) => {
      if (typeof node === 'string') {
        return node
      }
      if (first) {
        first = false
        return `${node.open}${escapeXmlText(replaced)}${node.close}`
      }
      return `${node.open}${node.close}`
    })
    .join('')
}

const replaceTagsInXmlContent = (xmlContent, data) => {
  let updated = xmlContent.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (runXml) => replaceTagsInRun(runXml, data))

  updated = updated.replace(/(<w:instrText\b[^>]*>)([\s\S]*?)(<\/w:instrText>)/g, (match, open, text, close) => {
    const replaced = replaceTagsInValue(text, data)
    if (replaced === text) {
      return match
    }
    return `${open}${escapeXmlText(replaced)}${close}`
  })

  return updated
}

const extractDocxTemplate = async (templatePath, workDir) => {
  try {
    await execFilePromise('unzip', ['-q', templatePath, '-d', workDir])
  } catch (error) {
    throw new ContractRenderError(500, 'Falha ao extrair o template do contrato.')
  }
}

const rezipDocx = async (sourceDir, destinationFile) => {
  try {
    await execFilePromise('zip', ['-qr', destinationFile, '.'], { cwd: sourceDir })
  } catch (error) {
    throw new ContractRenderError(500, 'Falha ao compactar o contrato atualizado.')
  }
}

const updateDocxParts = async (workDir, data) => {
  const wordDir = path.join(workDir, 'word')
  let entries
  try {
    entries = await fs.readdir(wordDir)
  } catch (error) {
    throw new ContractRenderError(500, 'Estrutura do template de contrato é inválida.')
  }

  await Promise.all(
    entries
      .filter((name) => DOCX_PART_REGEX.test(name))
      .map(async (name) => {
        const filePath = path.join(wordDir, name)
        const xmlContent = await fs.readFile(filePath, 'utf8')
        const replaced = replaceTagsInXmlContent(xmlContent, data)
        await fs.writeFile(filePath, replaced, 'utf8')
      }),
  )
}

const formatDateExtenso = (date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)

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

const cleanupTmpFiles = async (...targets) => {
  await Promise.all(
    targets
      .filter(Boolean)
      .map(async (target) => {
        try {
          await fs.rm(target, { recursive: true, force: true })
        } catch (error) {
          if (error && error.code !== 'ENOENT') {
            console.warn(`[contracts] Não foi possível remover o recurso temporário ${target}:`, error)
          }
        }
      }),
  )
}

const generateContractPdf = async (cliente) => {
  const templatePath = await ensureTemplateExists()
  const dataAtualExtenso = formatDateExtenso(new Date())
  const data = { ...cliente, dataAtualExtenso }

  await fs.mkdir(TMP_DIR, { recursive: true })
  const uniqueId = `contrato_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const workDir = await fs.mkdtemp(path.join(TMP_DIR, `${uniqueId}_`))
  const extractedDir = path.join(workDir, 'docx')
  await fs.mkdir(extractedDir, { recursive: true })
  const docxPath = path.join(TMP_DIR, `${uniqueId}.docx`)
  const pdfPath = path.join(TMP_DIR, `${uniqueId}.pdf`)

  try {
    await extractDocxTemplate(templatePath, extractedDir)
    await updateDocxParts(extractedDir, data)
    await rezipDocx(extractedDir, docxPath)

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
    await cleanupTmpFiles(docxPath, pdfPath, workDir)
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
