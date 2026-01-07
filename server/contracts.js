import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import util from 'node:util'
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

// Valid Brazilian state codes (UF)
const VALID_UF_CODES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
])

/**
 * Validates if a string is a valid Brazilian UF code
 * @param {string} uf - UF code to validate
 * @returns {boolean} true if valid, false otherwise
 */
const isValidUf = (uf) => {
  if (typeof uf !== 'string') return false
  const normalized = uf.trim().toUpperCase()
  return normalized.length === 2 && VALID_UF_CODES.has(normalized)
}
const PDF_PAGE_WIDTH = 612
const PDF_PAGE_HEIGHT = 792
const PDF_MARGIN = 72
const PDF_FONT_SIZE = 11
const PDF_LINE_HEIGHT = 14
const PDF_MAX_LINE_LENGTH = 90

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

const XML_CHAR_ESCAPE_REGEX = /[&<>"']/g
const XML_CHAR_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

const escapeXmlValue = (value) =>
  String(value ?? '').replace(XML_CHAR_ESCAPE_REGEX, (char) => XML_CHAR_ESCAPE_MAP[char] ?? char)

const buildPlaceholderMap = (data) => {
  // Formata endereço do contratante em ALL CAPS
  const enderecoContratante = formatarEnderecoCompleto({
    endereco: data.endereco ?? '',
    cidade: data.cidade ?? '',
    uf: data.uf ?? '',
    cep: data.cep ?? '',
  })

  // Formata endereço da UC geradora em ALL CAPS (se diferente do contratante)
  const enderecoUCGeradora = data.enderecoUCGeradora 
    ? (typeof data.enderecoUCGeradora === 'string' ? data.enderecoUCGeradora.trim().toUpperCase() : '')
    : enderecoContratante

  return {
    // Core client info
    nomeCompleto: data.nomeCompleto ?? '',
    cpfCnpj: maskCpfCnpj(data.cpfCnpj),
    cnpj: data.cnpj ?? '',
    rg: data.rg ?? '',
    razaoSocial: data.razaoSocial ?? '',
    representanteLegal: data.representanteLegal ?? '',
    
    // Personal info
    estadoCivil: data.estadoCivil ?? '',
    nacionalidade: data.nacionalidade ?? '',
    profissao: data.profissao ?? '',
    
    // Address fields - formatted for contracts
    enderecoCompleto: data.enderecoCompleto ?? '',
    enderecoCliente: data.enderecoCliente ?? data.enderecoCompleto ?? '',
    enderecoContratante, // Endereço do contratante em ALL CAPS
    enderecoUCGeradora,  // Endereço da UC geradora em ALL CAPS
    endereco: data.endereco ?? '',
    cidade: data.cidade ?? '',
    uf: data.uf ?? '',
    cep: data.cep ?? '',
    
    // Contact info
    telefone: data.telefone ?? '',
    email: data.email ?? '',
    
    // UC and installation
    unidadeConsumidora: data.unidadeConsumidora ?? '',
    localEntrega: data.localEntrega ?? '',
    
    // Contractor company info
    cnpjContratada: data.cnpjContratada ?? '',
    enderecoContratada: data.enderecoContratada ?? '',
    
    // Dates
    dataAtualExtenso: data.dataAtualExtenso ?? '',
    dataInicio: data.dataInicio ?? '',
    dataFim: data.dataFim ?? '',
    dataHomologacao: data.dataHomologacao ?? '',
    anoContrato: data.anoContrato ?? '',
    diaVencimento: data.diaVencimento ?? '',
    prazoContratual: data.prazoContratual ?? '',
    
    // Technical specs
    potencia: data.potencia ?? '',
    kWhContratado: data.kWhContratado ?? '',
    tarifaBase: data.tarifaBase ?? '',
    modulosFV: data.modulosFV ?? '',
    inversoresFV: data.inversoresFV ?? '',
  }
}

const applyPlaceholderReplacements = (text, data, { escapeXml = false } = {}) => {
  if (typeof text !== 'string' || !text) {
    return typeof text === 'string' ? text : ''
  }

  const placeholders = buildPlaceholderMap(data)
  let output = text

  for (const [key, rawValue] of Object.entries(placeholders)) {
    const replacement = escapeXml ? escapeXmlValue(rawValue) : rawValue ?? ''
    if (!key) {
      continue
    }
    const doublePattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    const singlePattern = new RegExp(`\\{${key}\\}`, 'g')
    output = output.replace(doublePattern, replacement)
    output = output.replace(singlePattern, replacement)
  }

  return output
}

const replaceTagsInXml = (xmlContent, data) => applyPlaceholderReplacements(xmlContent, data, { escapeXml: true })

const decodeXmlEntities = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")

const extractPlainTextFromWordXml = (xmlContent) => {
  if (!xmlContent) {
    return ''
  }

  const replaced = xmlContent
    .replace(/<w:tab[^>]*\/>/gi, '\t')
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')

  const decoded = decodeXmlEntities(replaced).replace(/\r/g, '')
  const rawLines = decoded.split('\n')
  const cleanedLines = []

  for (const rawLine of rawLines) {
    const trimmed = rawLine.replace(/\s+/g, ' ').trim()
    if (trimmed) {
      cleanedLines.push(trimmed)
    } else if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
      cleanedLines.push('')
    }
  }

  return cleanedLines.join('\n').trim()
}

const wrapLineForPdf = (line) => {
  if (!line) {
    return ['']
  }

  const maxLength = PDF_MAX_LINE_LENGTH
  if (line.length <= maxLength) {
    return [line]
  }

  const words = line.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return ['']
  }

  const wrapped = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxLength) {
      current = candidate
    } else {
      if (current) {
        wrapped.push(current)
      }
      current = word
    }
  }

  if (current) {
    wrapped.push(current)
  }

  return wrapped.length > 0 ? wrapped : ['']
}

const normalizeLinesForPdf = (text) => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = normalized.split('\n')
  const wrapped = []

  rawLines.forEach((line, index) => {
    const trimmedLine = line.replace(/\s+$/g, '')
    if (trimmedLine) {
      wrapped.push(...wrapLineForPdf(trimmedLine))
    } else {
      if (index === rawLines.length - 1) {
        wrapped.push('')
      } else if (wrapped.length === 0 || wrapped[wrapped.length - 1] !== '') {
        wrapped.push('')
      }
    }
  })

  return wrapped.length > 0 ? wrapped : ['']
}

const escapePdfString = (value) => {
  const buffer = Buffer.from(value, 'latin1')
  let escaped = ''

  for (const byte of buffer.values()) {
    const char = String.fromCharCode(byte)
    if (char === '\\' || char === '(' || char === ')') {
      escaped += `\\${char}`
    } else if (byte < 32 || byte > 126) {
      escaped += `\\${byte.toString(8).padStart(3, '0')}`
    } else {
      escaped += char
    }
  }

  return escaped
}

const createPdfBufferFromPlainText = (text) => {
  const lines = normalizeLinesForPdf(text)
  const linesPerPage = Math.max(1, Math.floor((PDF_PAGE_HEIGHT - PDF_MARGIN * 2) / PDF_LINE_HEIGHT))
  const pages = []

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage))
  }

  if (pages.length === 0) {
    pages.push([''])
  }

  const objects = []
  const addObject = (content = '') => {
    const id = objects.length + 1
    objects.push({ id, content })
    return id
  }

  const catalogId = addObject()
  const pagesId = addObject()
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  const contentIds = pages.map((pageLines) => {
    let content = 'BT\n'
    content += `/F1 ${PDF_FONT_SIZE} Tf\n`
    content += `${PDF_MARGIN} ${PDF_PAGE_HEIGHT - PDF_MARGIN} Td\n`

    pageLines.forEach((line, index) => {
      content += `(${escapePdfString(line)}) Tj\n`
      if (index !== pageLines.length - 1) {
        content += `0 -${PDF_LINE_HEIGHT} Td\n`
      }
    })

    content += 'ET'
    const length = Buffer.byteLength(content, 'utf8')
    return addObject(`<< /Length ${length} >>\nstream\n${content}\nendstream`)
  })

  const pageIds = pages.map(() => addObject())

  pageIds.forEach((pageId, index) => {
    const contentId = contentIds[index]
    objects[pageId - 1].content = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
  })

  objects[pagesId - 1].content = `<< /Type /Pages /Kids [${pageIds
    .map((pageId) => `${pageId} 0 R`)
    .join(' ')}] /Count ${pageIds.length} >>`

  objects[catalogId - 1].content = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`

  const headerBuffer = Buffer.from('%PDF-1.4\n', 'utf8')
  const bodyChunks = [headerBuffer]
  let currentOffset = headerBuffer.length
  const xrefEntries = ['0000000000 65535 f \n']

  objects.forEach(({ id, content }) => {
    const objectString = `${id} 0 obj\n${content}\nendobj\n`
    const buffer = Buffer.from(objectString, 'utf8')
    xrefEntries.push(currentOffset.toString().padStart(10, '0') + ' 00000 n \n')
    bodyChunks.push(buffer)
    currentOffset += buffer.length
  })

  const xrefOffset = currentOffset
  const xrefHeader = `xref\n0 ${objects.length + 1}\n`
  const xrefBuffer = Buffer.from(xrefHeader + xrefEntries.join(''), 'utf8')
  bodyChunks.push(xrefBuffer)
  currentOffset += xrefBuffer.length

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  bodyChunks.push(Buffer.from(trailer, 'utf8'))

  return Buffer.concat(bodyChunks)
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

/**
 * Resolve o caminho do template com suporte a templates específicos por UF.
 * Ordem de busca:
 * 1. Template específico do UF (ex: leasing/GO/template.docx)
 * 2. Template padrão da categoria (ex: leasing/template.docx)
 * 
 * @param {string} templateName - Nome do template ou caminho relativo
 * @param {string} [clienteUf] - UF do cliente para resolução de templates específicos
 */
const resolveTemplatePath = async (templateName, clienteUf) => {
  const trimmed = typeof templateName === 'string' ? templateName.trim() : ''
  const uf = typeof clienteUf === 'string' ? clienteUf.trim().toUpperCase() : ''
  let relativePath = DEFAULT_TEMPLATE_FILE
  let category = DEFAULT_TEMPLATE_CATEGORY
  let fileName = ''

  if (trimmed) {
    const normalized = path.posix.normalize(trimmed.replace(/\\/g, '/'))
    const segments = normalized.split('/').filter(Boolean)
    if (segments.length === 1) {
      fileName = path.basename(segments[0])
      if (!fileName.toLowerCase().endsWith('.docx')) {
        throw new ContractRenderError(400, 'Template de contrato inválido.')
      }
      category = DEFAULT_TEMPLATE_CATEGORY
    } else if (segments.length === 2) {
      category = sanitizeTemplateCategory(segments[0])
      if (!category) {
        throw new ContractRenderError(400, 'Categoria de template inválida.')
      }
      fileName = path.basename(segments[1])
      if (!fileName.toLowerCase().endsWith('.docx')) {
        throw new ContractRenderError(400, 'Template de contrato inválido.')
      }
    } else if (segments.length === 3) {
      // Suporta caminho completo: categoria/UF/arquivo.docx
      category = sanitizeTemplateCategory(segments[0])
      if (!category) {
        throw new ContractRenderError(400, 'Categoria de template inválida.')
      }
      // Validate UF segment
      if (!isValidUf(segments[1])) {
        throw new ContractRenderError(400, 'UF inválido no caminho do template.')
      }
      fileName = path.basename(segments[2])
      if (!fileName.toLowerCase().endsWith('.docx')) {
        throw new ContractRenderError(400, 'Template de contrato inválido.')
      }
      relativePath = path.join(category, segments[1].toUpperCase(), fileName)
      const absolutePath = path.resolve(process.cwd(), CONTRACT_TEMPLATES_DIR_RELATIVE, relativePath)
      try {
        await fs.access(absolutePath)
        return { absolutePath, fileName: path.basename(relativePath), uf: segments[1].toUpperCase() }
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          throw new ContractRenderError(404, 'Template de contrato não encontrado no servidor.')
        }
        throw new ContractRenderError(500, 'Não foi possível acessar o template do contrato.')
      }
    } else {
      throw new ContractRenderError(400, 'Caminho de template inválido.')
    }
  } else {
    // Use default template file name from DEFAULT_TEMPLATE_FILE
    fileName = path.basename(DEFAULT_TEMPLATE_FILE)
  }

  // Se UF foi fornecida, tenta encontrar template específico do estado
  if (uf && fileName) {
    // Validate UF before using in path
    if (!isValidUf(uf)) {
      console.warn(`[contracts] UF inválido fornecido: ${uf}`)
      // Continue to fallback instead of throwing error
    } else {
      const ufSpecificPath = path.join(category, uf, fileName)
      const ufSpecificAbsolutePath = path.resolve(process.cwd(), CONTRACT_TEMPLATES_DIR_RELATIVE, ufSpecificPath)
      
      try {
        await fs.access(ufSpecificAbsolutePath)
        console.log(`[contracts] Usando template específico para UF ${uf}: ${ufSpecificPath}`)
        return { absolutePath: ufSpecificAbsolutePath, fileName, uf }
      } catch (error) {
        // Template específico do UF não existe, continua para o template padrão
        if (error && error.code !== 'ENOENT') {
          console.warn(`[contracts] Erro ao acessar template específico do UF ${uf}:`, error)
        }
      }
    }
  }

  // Fallback para template padrão da categoria
  relativePath = fileName ? path.join(category, fileName) : DEFAULT_TEMPLATE_FILE
  const absolutePath = path.resolve(process.cwd(), CONTRACT_TEMPLATES_DIR_RELATIVE, relativePath)
  
  try {
    await fs.access(absolutePath)
    if (uf) {
      console.log(`[contracts] Template específico para UF ${uf} não encontrado, usando template padrão: ${relativePath}`)
    }
    return { absolutePath, fileName: path.basename(relativePath), uf: null }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new ContractRenderError(404, 'Template de contrato não encontrado no servidor.')
    }
    throw new ContractRenderError(500, 'Não foi possível acessar o template do contrato.')
  }
}

/**
 * Formata um endereço completo em formato ALL CAPS para contratos
 * Formato: ENDEREÇO, CIDADE - UF, CEP
 * @param {Object} dados - Dados do endereço
 * @param {string} dados.endereco - Logradouro, número, complemento
 * @param {string} dados.cidade - Cidade
 * @param {string} dados.uf - UF (estado)
 * @param {string} dados.cep - CEP
 * @returns {string} Endereço formatado em ALL CAPS. Retorna string vazia se todos os campos estiverem vazios.
 */
const formatarEnderecoCompleto = (dados) => {
  const partes = []
  const endereco = typeof dados.endereco === 'string' ? dados.endereco.trim().toUpperCase() : ''
  const cidade = typeof dados.cidade === 'string' ? dados.cidade.trim().toUpperCase() : ''
  const uf = typeof dados.uf === 'string' ? dados.uf.trim().toUpperCase() : ''
  const cep = typeof dados.cep === 'string' ? dados.cep.trim() : ''

  if (endereco) {
    partes.push(endereco)
  }

  if (cidade && uf) {
    partes.push(`${cidade} - ${uf}`)
  } else if (cidade) {
    partes.push(cidade)
  } else if (uf) {
    partes.push(uf)
  }

  if (cep) {
    partes.push(cep)
  }

  return partes.join(', ')
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
  const telefone = typeof payload.telefone === 'string' ? payload.telefone.trim() : ''
  const email = typeof payload.email === 'string' ? payload.email.trim() : ''

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

  // Extract individual address components if available
  const endereco = typeof payload.endereco === 'string' ? payload.endereco.trim() : ''
  const cidade = typeof payload.cidade === 'string' ? payload.cidade.trim() : ''
  const uf = typeof payload.uf === 'string' ? payload.uf.trim().toUpperCase() : ''
  const cep = typeof payload.cep === 'string' ? payload.cep.trim() : ''

  return {
    nomeCompleto,
    cpfCnpj,
    enderecoCompleto,
    unidadeConsumidora,
    telefone,
    email,
    endereco,
    cidade,
    uf,
    cep,
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

const convertDocxToPdfUsingTextFallback = async (docxPath, pdfPath) => {
  const JSZip = await loadJsZip()
  const docxBuffer = await fs.readFile(docxPath)
  const zip = await JSZip.loadAsync(docxBuffer)
  const documentFile = zip.file('word/document.xml')

  if (!documentFile) {
    throw new Error('Arquivo word/document.xml ausente no DOCX gerado.')
  }

  const xmlContent = await documentFile.async('string')
  const plainText = extractPlainTextFromWordXml(xmlContent)

  if (!plainText) {
    throw new Error('Não foi possível extrair conteúdo textual do contrato gerado.')
  }

  const pdfBuffer = createPdfBufferFromPlainText(plainText)
  await fs.writeFile(pdfPath, pdfBuffer)
}

const convertDocxToPdf = async (docxPath, pdfPath) => {
  try {
    await convertDocxToPdfUsingLibreOffice(docxPath)
    return
  } catch (error) {
    if (!(error instanceof LibreOfficeConversionError)) {
      throw error
    }

    console.warn('[contracts] Falha na conversão via LibreOffice, tentando fallbacks alternativos...', error)
  }

  const fallbackErrors = []
  const driveCredentials = getGoogleDriveCredentials()

  if (driveCredentials) {
    try {
      await convertDocxToPdfUsingGoogleDrive(docxPath, pdfPath)
      return
    } catch (driveError) {
      fallbackErrors.push(driveError)
      console.error('[contracts] Falha na conversão via Google Drive:', driveError)
    }
  }

  try {
    await convertDocxToPdfUsingTextFallback(docxPath, pdfPath)
    console.warn('[contracts] Contrato convertido via fallback interno em modo texto simplificado.')
    return
  } catch (textError) {
    fallbackErrors.push(textError)
    console.error('[contracts] Falha no fallback interno de conversão para PDF:', textError)
  }

  const message = driveCredentials
    ? 'Falha ao converter o contrato para PDF. Verifique o LibreOffice, o Google Drive ou o fallback interno.'
    : 'Falha ao converter o contrato para PDF. Verifique a instalação do LibreOffice ou habilite o fallback interno.'

  if (fallbackErrors.length > 0) {
    fallbackErrors.forEach((err) => {
      console.error('[contracts] Detalhes adicionais da falha de conversão:', err)
    })
  }

  throw new ContractRenderError(500, message)
}

const DOCX_TEMPLATE_PARTS_REGEX = /^word\/(document|header\d*|footer\d*)\.xml$/

const generateContractPdfFromDocx = async ({ templatePath, templateFileName }, data) => {
  const templateBuffer = await fs.readFile(templatePath)
  const JSZip = await loadJsZip()
  const zip = await JSZip.loadAsync(templateBuffer)

  const partNames = Object.keys(zip.files).filter((name) => DOCX_TEMPLATE_PARTS_REGEX.test(name))

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

const resolvePlainTextTemplatePath = async (templatePath) => {
  const textPath = templatePath.replace(/\.docx$/i, '.txt')
  try {
    await fs.access(textPath)
    return textPath
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const generateContractPdfFromPlainText = async ({ templatePath, templateFileName }, data) => {
  const textPath = await resolvePlainTextTemplatePath(templatePath)
  if (!textPath) {
    throw new ContractRenderError(
      500,
      'Fallback textual de contratos indisponível. Verifique se os templates em texto estão presentes.',
    )
  }

  const templateText = await fs.readFile(textPath, 'utf8')
  const replacedText = applyPlaceholderReplacements(templateText, data)
  const pdfBuffer = createPdfBufferFromPlainText(replacedText)
  return { pdfBuffer, templateFileName }
}

const shouldFallbackToPlainText = (error) => {
  if (!error) {
    return false
  }

  if (error instanceof ContractRenderError) {
    if (typeof error.statusCode === 'number' && error.statusCode !== 500) {
      return false
    }
    return true
  }

  if (error && typeof error === 'object') {
    const code = /** @type {{ code?: string }} */ (error).code
    if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
      return true
    }
  }

  return true
}

const generateContractPdf = async (cliente, templateName) => {
  // Extrai UF do cliente para resolução de template específico
  const clienteUf = typeof cliente.uf === 'string' ? cliente.uf.trim().toUpperCase() : ''
  
  const { absolutePath: templatePath, fileName: templateFileName, uf: resolvedUf } =
    await resolveTemplatePath(templateName, clienteUf)

  const templateInfo = { templatePath, templateFileName }
  const dataAtualExtenso = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const data = { ...cliente, dataAtualExtenso }

  try {
    return await generateContractPdfFromDocx(templateInfo, data)
  } catch (error) {
    if (!shouldFallbackToPlainText(error)) {
      throw error
    }

    console.warn(
      `[contracts] Falha ao gerar contrato utilizando template DOCX (${templateFileName}). Aplicando fallback em modo texto.`,
      error,
    )

    try {
      return await generateContractPdfFromPlainText(templateInfo, data)
    } catch (fallbackError) {
      console.error('[contracts] Falha ao gerar contrato via fallback textual:', fallbackError)
      throw error instanceof Error ? error : new ContractRenderError(500, 'Falha ao gerar contrato PDF.')
    }
  }
}

const sanitizeTemplateDownloadName = (templateFileName) => {
  const withoutExtension = templateFileName.replace(/\.docx$/i, '')
  const normalized = withoutExtension.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/_+/g, '_')
  return normalized || 'Contrato'
}

/**
 * Lista templates disponíveis em uma categoria, incluindo templates específicos por UF.
 * Retorna templates no formato:
 * - categoria/arquivo.docx (templates padrão)
 * - categoria/UF/arquivo.docx (templates específicos por estado)
 * 
 * @param {string} category - Categoria de template (leasing, vendas)
 * @param {string} [ufFilter] - Opcional: filtrar apenas templates de um UF específico
 */
const listAvailableTemplates = async (category, ufFilter) => {
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

  const templates = []

  // Adiciona templates diretos da categoria (templates padrão)
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.docx')) {
      if (!ufFilter) {
        templates.push(`${category}/${entry.name}`)
      }
    } else if (entry.isDirectory()) {
      // Verifica se é um diretório de UF (2 letras maiúsculas)
      const dirName = entry.name.toUpperCase()
      if (isValidUf(dirName)) {
        // Se há filtro de UF e não corresponde, pula
        if (ufFilter && dirName !== ufFilter.toUpperCase()) {
          continue
        }

        // Lista templates dentro do diretório do UF
        const ufDirectory = path.join(directory, entry.name)
        try {
          const ufEntries = await fs.readdir(ufDirectory, { withFileTypes: true })
          for (const ufEntry of ufEntries) {
            if (ufEntry.isFile() && ufEntry.name.toLowerCase().endsWith('.docx')) {
              templates.push(`${category}/${dirName}/${ufEntry.name}`)
            }
          }
        } catch (error) {
          console.warn(`[contracts] Erro ao listar templates do UF ${dirName}:`, error)
        }
      }
    }
  }

  return templates.sort((a, b) => a.localeCompare(b, 'pt-BR'))
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
    const ufParam = requestUrl?.searchParams.get('uf') ?? ''
    const category = sanitizeTemplateCategory(categoryParam) ?? DEFAULT_TEMPLATE_CATEGORY
    const ufFilter = ufParam.trim().toUpperCase() || undefined
    const templates = await listAvailableTemplates(category, ufFilter)
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
