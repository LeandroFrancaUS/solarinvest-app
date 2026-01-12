import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import JSZip from 'jszip'
import Mustache from 'mustache'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { convertDocxToPdf, isConvertApiConfigured, isGotenbergConfigured } from './contracts.js'

const JSON_BODY_LIMIT = 256 * 1024
const DOCX_TEMPLATE_PARTS_REGEX = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i
const LEASING_TEMPLATES_DIR = path.resolve(
  process.cwd(),
  'public/templates/contratos/leasing',
)
const LEASING_ANEXOS_DIR = path.resolve(
  process.cwd(),
  'public/templates/contratos/leasing/anexos',
)
const BASE_TMP_DIR = path.join(os.tmpdir(), 'solarinvest')
const MAX_DOCX_BYTES = 8 * 1024 * 1024
const MAX_PDF_BYTES = 12 * 1024 * 1024

// Maximum iterations for merging split placeholder runs in Word XML
// Most placeholders split by Word's spell checker need 2-3 merge passes,
// but we allow more iterations to handle pathologically fragmented text
const MAX_PLACEHOLDER_MERGE_ITERATIONS = 20

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

export const LEASING_CONTRACTS_PATH = '/api/contracts/leasing'
export const LEASING_CONTRACTS_AVAILABILITY_PATH = '/api/contracts/leasing/availability'
export const LEASING_CONTRACTS_SMOKE_PATH = '/api/contracts/leasing/smoke'

export class LeasingContractsError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ code?: string, hint?: string }} [options]
   */
  constructor(statusCode, message, options = undefined) {
    super(message)
    this.statusCode = statusCode
    this.code = options?.code
    this.hint = options?.hint
    this.name = 'LeasingContractsError'
  }
}

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Disposition, X-Contracts-Notice, X-Request-Id',
  )
  res.setHeader('Access-Control-Max-Age', '600')
}

const createRequestId = () => crypto.randomUUID()

const sendErrorResponse = (res, statusCode, payload, requestId, vercelId = undefined) => {
  if (res.headersSent) {
    return
  }
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (requestId) {
    res.setHeader('X-Request-Id', requestId)
  }
  if (vercelId) {
    res.setHeader('X-Vercel-Id', vercelId)
  }
  res.end(JSON.stringify({ ok: false, requestId, vercelId, ...payload }))
}

const readJsonBody = async (req) => {
  if (!req.readable) {
    return {}
  }

  let accumulated = ''
  let totalLength = 0
  req.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      totalLength += chunk.length
      if (totalLength > JSON_BODY_LIMIT) {
        reject(new LeasingContractsError(
          413,
          'Payload acima do limite permitido.',
          { code: 'PAYLOAD_TOO_LARGE', hint: 'Reduza o tamanho da requisição.' },
        ))
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
        resolve(JSON.parse(accumulated))
      } catch (error) {
        reject(new LeasingContractsError(
          400,
          'JSON inválido na requisição.',
          { code: 'INVALID_JSON', hint: 'Verifique o JSON enviado na requisição.' },
        ))
      }
    })

    req.on('error', (error) => {
      reject(error)
    })
  })
}

const CONTRACT_TEMPLATES = {
  residencial: 'CONTRATO DE LEASING OPERACIONAL DE SISTEMA FOTOVOLTAICO.dotx',
  comercial: 'CONTRATO DE LEASING OPERACIONAL DE SISTEMA FOTOVOLTAICO.dotx',
  condominio: 'CONTRATO DE LEASING OPERACIONAL DE SISTEMA FOTOVOLTAICO.dotx',
}

/**
 * Map of Roman numerals to Arabic numbers (supports I-XII for anexos)
 * Limited to 12 as this covers all standard anexos in leasing contracts
 */
const ROMAN_TO_ARABIC = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
}

/**
 * Map of Arabic numbers to Roman numerals (supports 1-12 for anexos)
 * For anexos beyond 12, Arabic numerals will be used
 */
const ARABIC_TO_ROMAN = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X',
  11: 'XI',
  12: 'XII',
}

/**
 * Convert a Roman numeral to Arabic number
 * @param {string} roman - Roman numeral string
 * @returns {number|null} Arabic number or null if invalid
 */
const romanToArabic = (roman) => {
  const upper = roman.toUpperCase()
  return ROMAN_TO_ARABIC[upper] ?? null
}

/**
 * Convert an Arabic number to Roman numeral
 * @param {number} arabic - Arabic number
 * @returns {string|null} Roman numeral or null if invalid
 */
const arabicToRoman = (arabic) => {
  return ARABIC_TO_ROMAN[arabic] ?? null
}

/**
 * Normalize anexo number to support both Roman and Arabic numerals
 * @param {string} numStr - Number string (e.g., "II", "2", "IV", "4")
 * @returns {number|null} Normalized number or null if invalid
 */
const normalizeAnexoNumber = (numStr) => {
  // Try to parse as Arabic number first
  const asNumber = parseInt(numStr, 10)
  if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= 20) {
    return asNumber
  }
  // Try to parse as Roman numeral
  const roman = romanToArabic(numStr)
  return roman !== null ? roman : null
}

/**
 * Check if a filename matches anexo prefix pattern (case-insensitive, supports Roman/Arabic)
 * @param {string} fileName - File name to check
 * @param {number} anexoNum - Anexo number (1, 2, 3, etc.)
 * @returns {boolean} true if matches
 */
const matchesAnexoPrefix = (fileName, anexoNum) => {
  const normalized = fileName.trim().toLowerCase()
  const roman = arabicToRoman(anexoNum)
  
  // Validate that anexoNum is a safe positive integer to prevent injection
  if (!Number.isInteger(anexoNum) || anexoNum < 1 || anexoNum > 20) {
    return false
  }
  
  // Check Arabic pattern first (always valid for numbers 1-20)
  // No need to escape anexoNum since we validated it's a safe integer
  const arabicPattern = new RegExp(`^anexo\\s+${anexoNum}(?:\\s|\\W|$)`, 'i')
  if (arabicPattern.test(normalized)) {
    return true
  }
  
  // Only check Roman pattern if conversion was successful
  if (roman) {
    // No need to escape roman since it comes from our controlled ARABIC_TO_ROMAN map
    const romanPattern = new RegExp(`^anexo\\s+${roman.toLowerCase()}(?:\\s|\\W|$)`, 'i')
    return romanPattern.test(normalized)
  }
  
  return false
}

/**
 * Check if a filename is an anexo reference
 * @param {string} fileName - File name to check
 * @returns {boolean} true if this looks like an anexo reference
 */
const isAnexoReference = (fileName) => {
  const lower = fileName.toLowerCase()
  return lower.startsWith('anexos/') || lower.startsWith('anexo ')
}

/**
 * Extract anexo number from a filename
 * @param {string} fileName - File name to extract from
 * @returns {number|null} Anexo number or null if not found
 */
const extractAnexoNumber = (fileName) => {
  // Try Roman numerals first (more specific pattern)
  const romanMatch = fileName.match(/anexo\s+([ivx]+)\b/i)
  if (romanMatch) {
    const num = normalizeAnexoNumber(romanMatch[1])
    if (num) return num
  }
  
  // Try Arabic numerals
  const arabicMatch = fileName.match(/anexo\s+(\d+)\b/i)
  if (arabicMatch) {
    const num = normalizeAnexoNumber(arabicMatch[1])
    if (num) return num
  }
  
  return null
}

/**
 * Search for anexo file in the anexos directory by number (supports Roman/Arabic)
 * @param {number} anexoNum - Anexo number (1, 2, 3, etc.)
 * @param {string} [uf] - Optional UF for state-specific templates
 * @returns {Promise<string|null>} File name if found, null otherwise
 */
const findAnexoFile = async (anexoNum, uf) => {
  try {
    // Try UF-specific directory first if provided
    if (uf && isValidUf(uf)) {
      const ufAnexosDir = path.join(LEASING_ANEXOS_DIR, uf.toUpperCase())
      try {
        const ufEntries = await fs.readdir(ufAnexosDir)
        const match = ufEntries.find((entry) => 
          matchesAnexoPrefix(entry, anexoNum) && 
          (entry.toLowerCase().endsWith('.docx') || entry.toLowerCase().endsWith('.dotx'))
        )
        if (match) {
          return path.join('anexos', uf.toUpperCase(), match)
        }
      } catch (error) {
        // UF directory doesn't exist, continue to default
      }
    }

    // Search in default anexos directory
    const entries = await fs.readdir(LEASING_ANEXOS_DIR)
    const match = entries.find((entry) => 
      matchesAnexoPrefix(entry, anexoNum) && 
      (entry.toLowerCase().endsWith('.docx') || entry.toLowerCase().endsWith('.dotx'))
    )
    
    if (match) {
      return path.join('anexos', match)
    }
    
    return null
  } catch (error) {
    console.warn('[leasing-contracts] Error searching for anexo', {
      anexoNum,
      uf,
      errMessage: error?.message,
    })
    return null
  }
}

/**
 * Anexo definitions with auto-discovery support
 * For Leasing Residencial and Comercial, Anexos II, III, and IV are automatically included
 */
const ANEXO_DEFINITIONS = [
  {
    id: 'ANEXO_I',
    number: 1,
    label: 'Anexo I – Especificações Técnicas',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set([]), // Optional, not auto-included
  },
  {
    id: 'ANEXO_II',
    number: 2,
    label: 'Anexo II – Opção de Compra',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set(['residencial', 'comercial']), // Auto-include for leasing
  },
  {
    id: 'ANEXO_III',
    number: 3,
    label: 'Anexo III – Regras de Cálculo',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set(['residencial', 'comercial']), // Auto-include for leasing
  },
  {
    id: 'ANEXO_IV',
    number: 4,
    label: 'Anexo IV – Autorização do Proprietário',
    appliesTo: new Set(['residencial', 'comercial']),
    autoInclude: new Set(['residencial', 'comercial']), // Auto-include for leasing
  },
  {
    id: 'ANEXO_V',
    number: 5,
    label: 'Anexo V',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set([]),
  },
  {
    id: 'ANEXO_VI',
    number: 6,
    label: 'Anexo VI',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set([]),
  },
  {
    id: 'ANEXO_VII',
    number: 7,
    label: 'Anexo VII – Termo de Entrega e Aceite',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set([]),
  },
  {
    id: 'ANEXO_VIII',
    number: 8,
    label: 'Anexo VIII – Procuração do Condomínio',
    appliesTo: new Set(['condominio']),
    autoInclude: new Set(['condominio']),
  },
  {
    id: 'ANEXO_IX',
    number: 9,
    label: 'Anexo IX',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set([]),
  },
  {
    id: 'ANEXO_X',
    number: 10,
    label: 'Anexo X',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set([]),
  },
]

const ANEXO_BY_ID = new Map(ANEXO_DEFINITIONS.map((anexo) => [anexo.id, anexo]))
const ANEXO_BY_NUMBER = new Map(ANEXO_DEFINITIONS.map((anexo) => [anexo.number, anexo]))

const sanitizeContratoTipo = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'residencial' || normalized === 'comercial' || normalized === 'condominio') {
    return normalized
  }
  return null
}

const ensureField = (payload, key, label) => {
  const value = typeof payload[key] === 'string' ? payload[key].trim() : ''
  if (!value) {
    throw new LeasingContractsError(
      400,
      `Campo obrigatório ausente: ${label}.`,
      {
        code: 'INVALID_PAYLOAD',
        hint: 'Preencha todos os campos obrigatórios antes de gerar o contrato.',
      },
    )
  }
  return value
}

const optionalField = (payload, key) =>
  typeof payload[key] === 'string' ? payload[key].trim() : ''

const sanitizeDocumentoId = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits || 'documento'
}

const resolveEmail = (payload) => {
  const candidates = [
    payload?.email,
    payload?.emailCliente,
    payload?.cliente?.email,
    payload?.contato?.email,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed) {
        return trimmed
      }
    }
  }

  return ''
}

const resolveTelefone = (payload) => {
  const candidates = [
    payload?.telefone,
    payload?.telefoneCliente,
    payload?.cliente?.telefone,
    payload?.contato?.telefone,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed) {
        return trimmed
      }
    }
  }

  return ''
}

const formatTelefoneForContract = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    return ''
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return trimmed
}

const normalizeArray = (value) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
}

const normalizeProprietarios = (value) =>
  normalizeArray(value)
    .map((item) => ({
      nome: typeof item?.nome === 'string' ? item.nome.trim() : '',
      cpfCnpj: typeof item?.cpfCnpj === 'string' ? item.cpfCnpj.trim() : '',
    }))
    .filter((item) => item.nome || item.cpfCnpj)

const normalizeUcsBeneficiarias = (value) =>
  normalizeArray(value)
    .map((item) => ({
      numero: typeof item?.numero === 'string' ? item.numero.trim() : '',
      endereco: typeof item?.endereco === 'string' ? item.endereco.trim() : '',
      rateioPercentual:
        typeof item?.rateioPercentual === 'string' ? item.rateioPercentual.trim() : undefined,
    }))
    .filter((item) => item.numero || item.endereco)

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

const sanitizeDadosLeasing = (dados, tipoContrato) => {
  if (!dados || typeof dados !== 'object') {
    throw new LeasingContractsError(
      400,
      'Estrutura de dados do contrato inválida.',
      { code: 'INVALID_PAYLOAD', hint: 'Envie os dados do contrato em formato válido.' },
    )
  }

  // Convert personal data to uppercase for contract formatting
  const nomeCompletoValue = ensureField(dados, 'nomeCompleto', 'Nome completo / razão social').toUpperCase()
  const nacionalidadeValue = typeof dados.nacionalidade === 'string' ? dados.nacionalidade.trim().toUpperCase() : ''
  const profissaoValue = typeof dados.profissao === 'string' ? dados.profissao.trim().toUpperCase() : ''
  const estadoCivilValue = typeof dados.estadoCivil === 'string' ? dados.estadoCivil.trim().toUpperCase() : ''
  
  const normalized = {
    // Core client info - in uppercase for contracts
    nomeCompleto: nomeCompletoValue,
    cpfCnpj: ensureField(dados, 'cpfCnpj', 'CPF/CNPJ'),
    rg: typeof dados.rg === 'string' ? dados.rg.trim() : '',
    
    // Personal info - in uppercase for contracts
    estadoCivil: estadoCivilValue,
    nacionalidade: nacionalidadeValue,
    profissao: profissaoValue,
    
    // Address fields
    enderecoCompleto: ensureField(dados, 'enderecoCompleto', 'Endereço completo'),
    endereco: typeof dados.endereco === 'string' ? dados.endereco.trim() : '',
    cidade: typeof dados.cidade === 'string' ? dados.cidade.trim() : '',
    cep: typeof dados.cep === 'string' ? dados.cep.trim() : '',
    uf: typeof dados.uf === 'string' ? dados.uf.trim().toUpperCase() : '',
    
    // Contact info
    telefone: formatTelefoneForContract(resolveTelefone(dados)),
    email: resolveEmail(dados),
    
    // UC and installation
    unidadeConsumidora: ensureField(dados, 'unidadeConsumidora', 'Unidade consumidora'),
    localEntrega: ensureField(dados, 'localEntrega', 'Local de entrega'),
    
    // Dates
    dataInicio: optionalField(dados, 'dataInicio'),
    dataFim: optionalField(dados, 'dataFim'),
    dataHomologacao: optionalField(dados, 'dataHomologacao'),
    dataAtualExtenso: optionalField(dados, 'dataAtualExtenso'),
    dia: optionalField(dados, 'dia'),
    mes: optionalField(dados, 'mes'),
    diaVencimento: typeof dados.diaVencimento === 'string' ? dados.diaVencimento.trim() : '',
    prazoContratual: typeof dados.prazoContratual === 'string' ? dados.prazoContratual.trim() : '',
    
    // Technical specs
    potencia: ensureField(dados, 'potencia', 'Potência contratada (kWp)'),
    kWhContratado: ensureField(dados, 'kWhContratado', 'Energia contratada (kWh)'),
    kwhContratado: ensureField(dados, 'kWhContratado', 'Energia contratada (kWh)'),
    tarifaBase: ensureField(dados, 'tarifaBase', 'Tarifa base (R$/kWh)'),
    modulosFV: optionalField(dados, 'modulosFV'),
    inversoresFV: optionalField(dados, 'inversoresFV'),
    
    // Condominium fields
    proprietarios: normalizeProprietarios(dados.proprietarios),
    ucsBeneficiarias: normalizeUcsBeneficiarias(dados.ucsBeneficiarias),
    nomeCondominio:
      typeof dados.nomeCondominio === 'string' ? dados.nomeCondominio.trim() : '',
    cnpjCondominio:
      typeof dados.cnpjCondominio === 'string' ? dados.cnpjCondominio.trim() : '',
    nomeSindico: typeof dados.nomeSindico === 'string' ? dados.nomeSindico.trim() : '',
    cpfSindico: typeof dados.cpfSindico === 'string' ? dados.cpfSindico.trim() : '',
  }

  // Derived fields
  // enderecoCliente is an alias for enderecoCompleto
  normalized.enderecoCliente = normalized.enderecoCompleto
  
  // enderecoInstalacao is an alias for localEntrega
  normalized.enderecoInstalacao = normalized.localEntrega
  
  // Format addresses in ALL CAPS for contracts
  normalized.enderecoContratante = formatarEnderecoCompleto({
    endereco: normalized.endereco,
    cidade: normalized.cidade,
    uf: normalized.uf,
    cep: normalized.cep,
  })
  
  // enderecoUCGeradora - if enderecoUCGeradora is provided, use it; otherwise use localEntrega or enderecoContratante
  if (typeof dados.enderecoUCGeradora === 'string' && dados.enderecoUCGeradora.trim()) {
    normalized.enderecoUCGeradora = dados.enderecoUCGeradora.trim().toUpperCase()
  } else if (normalized.localEntrega) {
    normalized.enderecoUCGeradora = normalized.localEntrega.toUpperCase()
  } else {
    normalized.enderecoUCGeradora = normalized.enderecoContratante
  }
  
  // anoContrato from dataInicio if available
  if (normalized.dataInicio) {
    try {
      const year = new Date(normalized.dataInicio).getFullYear()
      if (!isNaN(year)) {
        normalized.anoContrato = String(year)
      } else {
        normalized.anoContrato = ''
      }
    } catch {
      normalized.anoContrato = ''
    }
  } else {
    normalized.anoContrato = new Date().getFullYear().toString()
  }

  const agora = new Date()
  if (!normalized.dataAtualExtenso) {
    normalized.dataAtualExtenso = format(agora, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  }
  if (!normalized.dia) {
    normalized.dia = format(agora, 'dd', { locale: ptBR })
  }
  if (!normalized.mes) {
    normalized.mes = format(agora, 'MMMM', { locale: ptBR })
  }

  if (tipoContrato === 'condominio') {
    normalized.nomeCondominio = ensureField(dados, 'nomeCondominio', 'Nome do condomínio')
    normalized.cnpjCondominio = ensureField(dados, 'cnpjCondominio', 'CNPJ do condomínio')
    normalized.nomeSindico = ensureField(dados, 'nomeSindico', 'Nome do síndico')
    normalized.cpfSindico = ensureField(dados, 'cpfSindico', 'CPF do síndico')
  }

  return normalized
}

const sanitizeAnexosSelecionados = (lista, tipoContrato) => {
  const selecionados = new Set()
  
  // Add explicitly selected anexos
  if (Array.isArray(lista)) {
    for (const item of lista) {
      if (typeof item !== 'string') {
        continue
      }
      const id = item.trim().toUpperCase()
      if (!ANEXO_BY_ID.has(id)) {
        continue
      }
      const definicao = ANEXO_BY_ID.get(id)
      if (definicao && definicao.appliesTo.has(tipoContrato)) {
        selecionados.add(id)
      }
    }
  }

  // Auto-include anexos for this contract type
  for (const definicao of ANEXO_DEFINITIONS) {
    if (definicao.autoInclude.has(tipoContrato)) {
      selecionados.add(definicao.id)
    }
  }

  return Array.from(selecionados)
}

/**
 * Verifica se um template está disponível no sistema de arquivos.
 * Supports auto-discovery of anexo files by prefix matching.
 * Tenta primeiro template específico do UF, depois o template padrão.
 * 
 * @param {string} fileName - Nome do arquivo template ou número do anexo
 * @param {string} [uf] - UF para buscar template específico
 * @returns {Promise<boolean>} true se o template existe, false caso contrário
 */
const checkTemplateAvailability = async (fileName, uf) => {
  const normalizedUf = typeof uf === 'string' ? uf.trim().toUpperCase() : ''

  // Check if fileName is an anexo reference (e.g., starts with "anexos/" or "anexo ")
  if (isAnexoReference(fileName)) {
    const anexoNum = extractAnexoNumber(fileName)
    if (anexoNum) {
      const foundFile = await findAnexoFile(anexoNum, normalizedUf)
      return foundFile !== null
    }
  }

  // Tenta verificar template específico do UF primeiro
  if (normalizedUf && isValidUf(normalizedUf)) {
    const ufTemplatePath = path.join(LEASING_TEMPLATES_DIR, normalizedUf, fileName)
    try {
      await fs.access(ufTemplatePath)
      return true
    } catch (error) {
      // Continua para tentar o template padrão
    }
  }

  // Verifica template padrão
  const templatePath = path.join(LEASING_TEMPLATES_DIR, fileName)
  try {
    await fs.access(templatePath)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Carrega um template DOCX, com suporte a templates específicos por UF e auto-discovery de anexos.
 * Ordem de busca:
 * 1. Template específico do UF (leasing/GO/template.dotx)
 * 2. Template padrão (leasing/template.dotx)
 * Para anexos, busca por prefixo no diretório anexos/
 * 
 * @param {string} fileName - Nome do arquivo template ou referência de anexo
 * @param {string} [uf] - UF para buscar template específico
 */
const loadDocxTemplate = async (fileName, uf) => {
  const normalizedUf = typeof uf === 'string' ? uf.trim().toUpperCase() : ''

  // Check if fileName is an anexo reference that needs auto-discovery
  if (isAnexoReference(fileName)) {
    const anexoNum = extractAnexoNumber(fileName)
    if (anexoNum) {
      const foundFile = await findAnexoFile(anexoNum, normalizedUf)
      if (foundFile) {
        // foundFile is relative path like "anexos/filename.docx"
        const anexoPath = path.join(LEASING_TEMPLATES_DIR, foundFile)
        try {
          const buffer = await fs.readFile(anexoPath)
          console.info({
            scope: 'leasing-contracts',
            step: 'anexo_discovered',
            anexoNum,
            fileName: path.basename(foundFile),
            uf: normalizedUf || undefined,
          })
          return buffer
        } catch (error) {
          console.error('[leasing-contracts] Error loading discovered anexo', {
            anexoNum,
            foundFile,
            errMessage: error?.message,
          })
          throw new LeasingContractsError(
            422,
            `Anexo ${anexoNum} não pôde ser carregado.`,
            {
              code: 'TEMPLATE_NOT_FOUND',
              hint: 'Verifique se o anexo está presente em public/templates/contratos/leasing/anexos.',
            },
          )
        }
      }
    }
  }

  // Tenta carregar template específico do UF primeiro
  if (normalizedUf && isValidUf(normalizedUf)) {
    const ufTemplatePath = path.join(LEASING_TEMPLATES_DIR, normalizedUf, fileName)
    try {
      const buffer = await fs.readFile(ufTemplatePath)
      console.info({
        scope: 'leasing-contracts',
        step: 'template_selected',
        uf: normalizedUf,
        template: fileName,
      })
      return buffer
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        console.warn('[leasing-contracts] Erro ao acessar template específico do UF', {
          uf: normalizedUf,
          template: fileName,
          errMessage: error?.message,
        })
      }
      // Continua para tentar o template padrão
    }
  } else if (normalizedUf) {
    console.warn('[leasing-contracts] UF inválido fornecido', { uf: normalizedUf })
  }

  // Fallback para template padrão
  const templatePath = path.join(LEASING_TEMPLATES_DIR, fileName)
  try {
    const buffer = await fs.readFile(templatePath)
    if (normalizedUf) {
      console.info({
        scope: 'leasing-contracts',
        step: 'template_fallback',
        uf: normalizedUf,
        template: fileName,
      })
    }
    return buffer
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.error('[leasing-contracts] Template não encontrado', {
        template: fileName,
        templatePath,
      })
      throw new LeasingContractsError(
        422,
        'Template do contrato não encontrado.',
        {
          code: 'TEMPLATE_NOT_FOUND',
          hint: 'Verifique se o template está presente em public/templates/contratos.',
        },
      )
    }
    console.error('[leasing-contracts] Erro ao ler template', {
      template: fileName,
      errMessage: error?.message,
    })
    throw error
  }
}

/**
 * Normalize Word XML to fix broken Mustache placeholders.
 * 
 * Word often splits {{placeholder}} text across multiple runs and text elements:
 * {{</w:t></w:r><w:proofErr/><w:r><w:t>variableName</w:t></w:r><w:proofErr/><w:r><w:t>}}
 * 
 * This function uses a two-pass approach:
 * 1. Remove spell-check markers that break up placeholders
 * 2. Merge consecutive text runs to reconstruct complete placeholders
 * 3. Consolidate multiple text elements within each run
 * 
 * @param {string} xml - The Word XML content
 * @returns {string} XML with fixed placeholders
 */
const normalizeWordXmlForMustache = (xml) => {
  // Strategy: Remove proofErr markers and merge adjacent text runs
  
  // Step 1: Remove spell-check markers that break up placeholders
  let result = xml.replace(/<w:proofErr[^>]*\/>/g, '')
  
  // Step 2: Merge consecutive <w:r> elements that only contain text
  // This handles the case where placeholder parts are in consecutive runs
  
  let changed = true
  let iterations = 0
  
  while (changed && iterations < MAX_PLACEHOLDER_MERGE_ITERATIONS) {
    iterations++
    const before = result.length
    
    // Regex pattern to match and merge two adjacent text runs:
    // Captures: (runContent1, text1, text2) and reconstructs as single merged run
    // 
    // Pattern breakdown:
    // - <w:r[^>]*>                    Opening run tag (may have attributes)
    // - ((?:(?!<w:r|<\/w:r).)*?)     Run content (not containing nested runs)
    // - <w:t[^>]*>                   Opening text tag
    // - ((?:(?!<\/w:t>).)*?)         Text content 1
    // - </w:t></w:r>                 Close first run
    // - <w:r[^>]*><w:t[^>]*>         Open second run and text
    // - ((?:(?!<\/w:t>).)*?)         Text content 2
    // - </w:t></w:r>                 Close second run
    const adjacentRunsPattern = /<w:r[^>]*>((?:(?!<w:r|<\/w:r).)*?)<w:t[^>]*>((?:(?!<\/w:t>).)*?)<\/w:t><\/w:r><w:r[^>]*>((?:(?!<w:r|<\/w:r).)*?)<w:t[^>]*>((?:(?!<\/w:t>).)*?)<\/w:t><\/w:r>/g
    
    result = result.replace(
      adjacentRunsPattern,
      (match, runContent, text1, nextRunContent, text2) => {
        const text1HasOpen = /{{/.test(text1)
        const text1HasClose = /}}/.test(text1)
        const text2HasOpen = /{{/.test(text2)
        const text2HasClose = /}}/.test(text2)
        const looksLikePlaceholderSplit =
          (text1HasOpen && !text1HasClose) || (!text2HasOpen && text2HasClose)
        if (!looksLikePlaceholderSplit) {
          return match
        }

        const runPropsRegex = /<w:rPr[\s\S]*?<\/w:rPr>/
        const runPropsMatch = runContent.match(runPropsRegex)
        const nextRunPropsMatch = nextRunContent.match(runPropsRegex)
        const runProps = runPropsMatch ? runPropsMatch[0] : nextRunPropsMatch ? nextRunPropsMatch[0] : ''
        const runContentWithoutProps = runContent.replace(runPropsRegex, '')
        const nextRunContentWithoutProps = nextRunContent.replace(runPropsRegex, '')
        const mergedRunContent = `${runContentWithoutProps}${nextRunContentWithoutProps}`

        // Check if we should preserve spaces
        const combinedText = text1 + text2
        const needsPreserve = /^\s|\s$|\s\s/.test(combinedText)
        const tTag = needsPreserve ? '<w:t xml:space="preserve">' : '<w:t>'
        return `<w:r>${runProps}${mergedRunContent}${tTag}${combinedText}</w:t></w:r>`
      }
    )
    
    changed = result.length !== before
  }
  
  // Step 3: Merge multiple <w:t> elements within the same <w:r>
  // Pattern explanation:
  // - <w:r([^>]*)> : Opening run tag with attributes captured
  // - ([\s\S]*?) : Run content (lazy match to first closing tag)
  // - </w:r> : Closing run tag
  result = result.replace(
    /<w:r([^>]*)>([\s\S]*?)<\/w:r>/g,
    (match, runAttrs, runContent) => {
      const hasLineBreaks = /<w:(br|cr|tab)\b/.test(runContent)
      if (hasLineBreaks) {
        return match
      }
      // Extract all text from <w:t> elements
      const texts = []
      const textPattern = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
      let textMatch
      
      while ((textMatch = textPattern.exec(runContent)) !== null) {
        texts.push(textMatch[1])
      }
      
      if (texts.length === 0) {
        return match
      }
      
      if (texts.length === 1) {
        // Already merged, return as-is
        return match
      }
      
      // Merge all text
      const mergedText = texts.join('')
      
      // Remove all <w:t> elements from run content
      let cleanedContent = runContent.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/g, '')
      
      // Add merged text at the end
      const needsPreserve = /^\s|\s$|\s\s/.test(mergedText)
      const tTag = needsPreserve ? '<w:t xml:space="preserve">' : '<w:t>'
      
      return `<w:r${runAttrs}>${cleanedContent}${tTag}${mergedText}</w:t></w:r>`
    }
  )
  
  return result
}

/**
 * Clean up extra punctuation from rendered Word XML.
 * Removes patterns like ", , " or ", ," that occur when optional fields are empty.
 * 
 * @param {string} xml - The rendered Word XML content
 * @returns {string} XML with cleaned punctuation
 */
const cleanupExtraPunctuation = (xml) => {
  // Replace patterns of comma-space-comma or multiple commas with single comma-space
  // This handles cases where optional fields (like profissao, estadoCivil) are empty
  // Pattern: ", , " or ",  ," or ", ," etc.
  let result = xml.replace(/,(\s*),(\s*)/g, ', ')
  
  // Clean up any remaining double commas
  result = result.replace(/,,+/g, ',')
  
  // Clean up comma followed by multiple spaces and another comma
  result = result.replace(/,\s{2,},/g, ', ')
  
  return result
}

const normalizeTemplateContentTypes = async (zip) => {
  const contentTypes = zip.file('[Content_Types].xml')
  if (!contentTypes) {
    return
  }
  const xml = await contentTypes.async('string')
  const updated = xml.replace(
    /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.template\.main\+xml/g,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  )
  zip.file('[Content_Types].xml', updated)
}

const renderDocxTemplate = async (fileName, data, uf) => {
  const templateBuffer = await loadDocxTemplate(fileName, uf)
  const zip = await JSZip.loadAsync(templateBuffer)
  const partNames = Object.keys(zip.files).filter((name) => DOCX_TEMPLATE_PARTS_REGEX.test(name))
  const isDotxTemplate = fileName.toLowerCase().endsWith('.dotx')

  for (const partName of partNames) {
    const file = zip.file(partName)
    if (!file) {
      continue
    }
    const xmlContent = await file.async('string')
    // Normalize XML to fix broken placeholders before rendering
    const normalizedXml = normalizeWordXmlForMustache(xmlContent)
    const rendered = Mustache.render(normalizedXml, data)
    // Clean up extra commas from empty optional fields
    const cleaned = cleanupExtraPunctuation(rendered)
    zip.file(partName, cleaned)
  }

  if (isDotxTemplate) {
    await normalizeTemplateContentTypes(zip)
  }

  return zip.generateAsync({ type: 'nodebuffer' })
}

const createZipFromFiles = async (files) => {
  const zip = new JSZip()
  files.forEach((file) => {
    zip.file(file.name, file.buffer)
  })
  return zip.generateAsync({ type: 'nodebuffer' })
}

const buildContractFileName = (tipoContrato, cpfCnpj, extension = 'docx') => {
  const id = sanitizeDocumentoId(cpfCnpj)
  return `contrato-leasing-${id}.${extension}`
}

const buildAnexoFileName = (anexoId, cpfCnpj, extension = 'docx') => {
  const id = sanitizeDocumentoId(cpfCnpj)
  // Remove "ANEXO_" prefix from anexoId to avoid duplication
  // anexoId format: "ANEXO_II" -> slug: "ii"
  const slug = anexoId.replace(/^ANEXO_/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `anexo-${slug}-${id}.${extension}`
}

const buildZipFileName = (tipoContrato, cpfCnpj) => {
  const id = sanitizeDocumentoId(cpfCnpj)
  return `leasing-${tipoContrato}-${id}.zip`
}

const resolveTemplatesForAnexos = (tipoContrato, anexosSelecionados) => {
  const resolved = []
  for (const anexoId of anexosSelecionados) {
    const definicao = ANEXO_BY_ID.get(anexoId)
    if (!definicao) {
      continue
    }
    if (!definicao.appliesTo.has(tipoContrato)) {
      continue
    }
    // Create a template reference for auto-discovery
    // Uses Roman numerals for 1-12 (e.g., "Anexo II"), Arabic for 13+ (e.g., "Anexo 13")
    // This ensures consistent naming with standard leasing contract conventions
    const template = `Anexo ${arabicToRoman(definicao.number) ?? definicao.number}`
    resolved.push({ id: anexoId, template, number: definicao.number })
  }
  return resolved
}

const createRequestTempDir = async (requestId) => {
  const tempDir = path.join(BASE_TMP_DIR, 'contracts', requestId)
  await fs.mkdir(tempDir, { recursive: true })
  return tempDir
}

const sanitizeHeaderValue = (value) => {
  if (!value) {
    return ''
  }
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const detectOomError = (error) => {
  const message = typeof error?.message === 'string' ? error.message : ''
  return /out of memory|heap out of memory|ENOMEM|allocation failed/i.test(message)
}

const buildUnknownErrorPayload = (error) => {
  if (detectOomError(error)) {
    return {
      code: 'SERVER_OOM_SUSPECTED',
      message: 'O servidor ficou sem memória ao gerar o contrato.',
      hint: 'Reduza o número de anexos ou o tamanho dos dados enviados.',
    }
  }
  return {
    code: 'UNKNOWN',
    message: 'Falha inesperada ao gerar os contratos de leasing.',
    hint: 'Verifique os logs do servidor para mais detalhes.',
  }
}

/**
 * Handler para verificar disponibilidade de anexos
 * GET /api/contracts/leasing/availability?tipoContrato=residencial&uf=GO
 */
export const handleLeasingContractsAvailabilityRequest = async (req, res) => {
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
    const url = new URL(req.url, `http://${req.headers.host}`)
    const tipoContratoParam = url.searchParams.get('tipoContrato') ?? ''
    const ufParam = url.searchParams.get('uf') ?? ''
    
    const tipoContrato = sanitizeContratoTipo(tipoContratoParam)
    if (!tipoContrato) {
      throw new LeasingContractsError(400, 'Tipo de contrato inválido.')
    }

    const clienteUf = typeof ufParam === 'string' ? ufParam.trim().toUpperCase() : ''
    
    // Verifica disponibilidade de cada anexo
    const availability = {}
    
    for (const definicao of ANEXO_DEFINITIONS) {
      if (!definicao.appliesTo.has(tipoContrato)) {
        continue
      }
      
      // Use auto-discovery to check availability
      const foundFile = await findAnexoFile(definicao.number, clienteUf)
      availability[definicao.id] = foundFile !== null
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ availability }))
  } catch (error) {
    const statusCode = error instanceof LeasingContractsError ? error.statusCode : 500
    const message =
      error instanceof LeasingContractsError
        ? error.message
        : 'Não foi possível verificar disponibilidade dos anexos.'

    if (!(error instanceof LeasingContractsError)) {
      console.error('[leasing-contracts] Erro ao verificar disponibilidade:', error)
    }

    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}

export const handleLeasingContractsSmokeRequest = async (req, res) => {
  setCorsHeaders(res)
  const requestId = createRequestId()
  const vercelId = typeof req.headers['x-vercel-id'] === 'string'
    ? req.headers['x-vercel-id']
    : undefined

  res.setHeader('X-Request-Id', requestId)
  if (vercelId) {
    res.setHeader('X-Vercel-Id', vercelId)
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (!req.method || req.method !== 'POST') {
    sendErrorResponse(
      res,
      405,
      {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Método não permitido. Utilize POST.',
      },
      requestId,
      vercelId,
    )
    return
  }

  const timings = {}
  const mark = (label, startedAt) => {
    timings[label] = Date.now() - startedAt
  }

  try {
    console.info({
      scope: 'leasing-contracts',
      step: 'smoke_start',
      requestId,
      vercelId,
      convertapiConfigured: isConvertApiConfigured(),
      gotenbergConfigured: isGotenbergConfigured(),
    })
    const start = Date.now()
    const tipoContrato = 'residencial'
    const dadosLeasing = sanitizeDadosLeasing({
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
    }, tipoContrato)

    const contratoTemplate = CONTRACT_TEMPLATES[tipoContrato]
    const templateAvailable = await checkTemplateAvailability(contratoTemplate, dadosLeasing.uf)
    if (!templateAvailable) {
      throw new LeasingContractsError(
        422,
        'Template do contrato não encontrado.',
        { code: 'TEMPLATE_NOT_FOUND', hint: `Verifique o template ${contratoTemplate}.` },
      )
    }

    const renderStart = Date.now()
    const contratoBuffer = await renderDocxTemplate(contratoTemplate, {
      ...dadosLeasing,
      tipoContrato,
    }, dadosLeasing.uf)
    mark('renderDocxMs', renderStart)

    const tempDir = await createRequestTempDir(requestId)
    const uniqueId = crypto.randomUUID()
    const docxPath = path.join(tempDir, `smoke-${uniqueId}.docx`)
    const pdfPath = path.join(tempDir, `smoke-${uniqueId}.pdf`)

    const convertStart = Date.now()
    await fs.writeFile(docxPath, contratoBuffer)
    await convertDocxToPdf(docxPath, pdfPath)
    const pdfStats = await fs.stat(pdfPath)
    mark('convertPdfMs', convertStart)

    await fs.unlink(docxPath).catch(() => {})
    await fs.unlink(pdfPath).catch(() => {})

    mark('totalMs', start)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      ok: true,
      requestId,
      vercelId,
      timings,
      docxBytes: contratoBuffer.length,
      pdfBytes: pdfStats.size,
      convertapiConfigured: isConvertApiConfigured(),
      gotenbergConfigured: isGotenbergConfigured(),
    }))
  } catch (error) {
    const statusCode = error instanceof LeasingContractsError ? error.statusCode ?? 500 : 500
    const payload = {
      code: error instanceof LeasingContractsError ? error.code ?? 'LEASING_CONTRACTS_ERROR' : 'LEASING_CONTRACTS_ERROR',
      message: error instanceof Error ? error.message : 'Falha no smoke test de contratos.',
      hint: error instanceof LeasingContractsError ? error.hint : 'Verifique a configuração dos provedores.',
      timings,
    }
    sendErrorResponse(res, statusCode, payload, requestId, vercelId)
  }
}

export const handleLeasingContractsRequest = async (req, res) => {
  setCorsHeaders(res)
  const requestId = createRequestId()
  const vercelId = typeof req.headers['x-vercel-id'] === 'string'
    ? req.headers['x-vercel-id']
    : undefined
  res.setHeader('X-Request-Id', requestId)
  if (vercelId) {
    res.setHeader('X-Vercel-Id', vercelId)
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (!req.method || req.method !== 'POST') {
    sendErrorResponse(
      res,
      405,
      {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Método não permitido. Utilize POST.',
      },
      requestId,
      vercelId,
    )
    return
  }

  try {
    const body = await readJsonBody(req)
    console.info({
      scope: 'leasing-contracts',
      step: 'request_received',
      requestId,
      vercelId,
      nodeVersion: process.version,
      convertapiConfigured: isConvertApiConfigured(),
      gotenbergConfigured: isGotenbergConfigured(),
    })
    
    const tipoContrato = sanitizeContratoTipo(body?.tipoContrato)
    if (!tipoContrato) {
      throw new LeasingContractsError(
        400,
        'Tipo de contrato inválido.',
        { code: 'INVALID_PAYLOAD', hint: 'Informe um tipo de contrato válido.' },
      )
    }
    
    console.info({
      scope: 'leasing-contracts',
      step: 'tipo_contrato',
      requestId,
      tipoContrato,
    })

    const dadosLeasing = sanitizeDadosLeasing(body?.dadosLeasing ?? {}, tipoContrato)
    const anexosSelecionados = sanitizeAnexosSelecionados(body?.anexosSelecionados, tipoContrato)
    const clienteUf = dadosLeasing.uf

    const anexosResolvidos = resolveTemplatesForAnexos(tipoContrato, anexosSelecionados)
    const anexosDisponiveis = []
    const anexosIndisponiveis = []

    for (const anexo of anexosResolvidos) {
      const isAvailable = await checkTemplateAvailability(anexo.template, clienteUf)
      if (isAvailable) {
        anexosDisponiveis.push(anexo)
      } else {
        anexosIndisponiveis.push(anexo.id)
      }
    }

    if (anexosIndisponiveis.length > 0) {
      console.warn('[leasing-contracts] Anexos indisponíveis serão ignorados', {
        requestId,
        anexos: anexosIndisponiveis,
      })
    }

    if (anexosDisponiveis.some((anexo) => anexo.id === 'ANEXO_I')) {
      if (!dadosLeasing.modulosFV) {
        throw new LeasingContractsError(
          400,
          'O Anexo I exige a descrição dos módulos fotovoltaicos.',
          { code: 'INVALID_PAYLOAD', hint: 'Preencha os módulos fotovoltaicos para gerar o Anexo I.' },
        )
      }
      if (!dadosLeasing.inversoresFV) {
        throw new LeasingContractsError(
          400,
          'O Anexo I exige a descrição dos inversores.',
          { code: 'INVALID_PAYLOAD', hint: 'Preencha os inversores para gerar o Anexo I.' },
        )
      }
    }

    const tempDir = await createRequestTempDir(requestId)

    const files = []
    const fallbackNotices = []
    const pdfProvidersConfigured = isConvertApiConfigured() || isGotenbergConfigured()
    const registerFallback = (message) => {
      if (!fallbackNotices.includes(message)) {
        fallbackNotices.push(message)
      }
    }

    const pushPdfOrDocx = async ({
      buffer,
      docxName,
      pdfName,
      label,
    }) => {
      const uniqueId = crypto.randomUUID()
      const docxPath = path.join(tempDir, `temp-${uniqueId}-${docxName}`)
      const pdfPath = path.join(tempDir, `temp-${uniqueId}-${pdfName}`)

      if (buffer.length > MAX_DOCX_BYTES) {
        throw new LeasingContractsError(
          413,
          `Documento ${label} excede o tamanho máximo permitido.`,
          {
            code: 'PAYLOAD_TOO_LARGE',
            hint: 'Reduza o tamanho dos dados ou remova anexos opcionais.',
          },
        )
      }

      if (!pdfProvidersConfigured) {
        console.info({
          scope: 'leasing-contracts',
          step: 'pdf_unavailable',
          requestId,
          label,
        })
        files.push({ name: docxName, buffer })
        registerFallback(`${label}: PDF indisponível, DOCX fornecido.`)
        return
      }

      try {
        await fs.writeFile(docxPath, buffer)
        await convertDocxToPdf(docxPath, pdfPath)
        const pdfBuffer = await fs.readFile(pdfPath)
        if (pdfBuffer.length > MAX_PDF_BYTES) {
          files.push({ name: docxName, buffer })
          registerFallback(`${label}: PDF muito grande, DOCX fornecido.`)
          return
        }
        files.push({ name: pdfName, buffer: pdfBuffer })
        console.info('[leasing-contracts] PDF convertido', {
          requestId,
          label,
          docxBytes: buffer.length,
          pdfBytes: pdfBuffer.length,
        })
      } catch (conversionError) {
        console.error('[leasing-contracts] Falha ao converter para PDF', {
          requestId,
          label,
          errMessage: conversionError?.message,
        })
        const errorMessage = conversionError instanceof Error
          ? conversionError.message
          : `Falha ao converter ${label} para PDF.`
        files.push({ name: docxName, buffer })
        registerFallback(`${label}: ${errorMessage}`)
      } finally {
        try {
          await fs.unlink(docxPath)
        } catch (err) {
          // Ignore cleanup errors
        }
        try {
          await fs.unlink(pdfPath)
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }

    const contratoTemplate = CONTRACT_TEMPLATES[tipoContrato]
    const contratoTemplateAvailable = await checkTemplateAvailability(contratoTemplate, clienteUf)
    if (!contratoTemplateAvailable) {
      throw new LeasingContractsError(
        422,
        'Template do contrato não encontrado.',
        {
          code: 'TEMPLATE_NOT_FOUND',
          hint: `Verifique se o template ${contratoTemplate} está disponível no deploy.`,
        },
      )
    }
    const renderStart = Date.now()
    const contratoBuffer = await renderDocxTemplate(contratoTemplate, {
      ...dadosLeasing,
      tipoContrato,
    }, clienteUf)
    console.info('[leasing-contracts] render_docx', {
      requestId,
      durationMs: Date.now() - renderStart,
      docxBytes: contratoBuffer.length,
    })

    const contratoDocxName = buildContractFileName(tipoContrato, dadosLeasing.cpfCnpj, 'docx')
    const contratoPdfName = buildContractFileName(tipoContrato, dadosLeasing.cpfCnpj, 'pdf')
    await pushPdfOrDocx({
      buffer: contratoBuffer,
      docxName: contratoDocxName,
      pdfName: contratoPdfName,
      label: 'Contrato principal',
    })

    const skippedAnexos = [...anexosIndisponiveis]

    for (const anexo of anexosDisponiveis) {
      try {
        const buffer = await renderDocxTemplate(anexo.template, {
          ...dadosLeasing,
          tipoContrato,
        }, clienteUf)
        
        const anexoDocxName = buildAnexoFileName(anexo.id, dadosLeasing.cpfCnpj, 'docx')
        const anexoPdfName = buildAnexoFileName(anexo.id, dadosLeasing.cpfCnpj, 'pdf')
        await pushPdfOrDocx({
          buffer,
          docxName: anexoDocxName,
          pdfName: anexoPdfName,
          label: `Anexo ${anexo.id}`,
        })
      } catch (anexoError) {
        // If anexo rendering fails, log and continue with other anexos
        console.error('[leasing-contracts] Erro ao processar anexo', {
          requestId,
          anexo: anexo.id,
          errMessage: anexoError?.message,
        })
        skippedAnexos.push(anexo.id)
      }
    }

    if (files.length === 0) {
      throw new LeasingContractsError(
        500,
        'Nenhum documento pôde ser gerado. Verifique a disponibilidade dos templates.',
        { code: 'UNKNOWN', hint: 'Verifique se os templates estão acessíveis no deploy.' },
      )
    }

    if (skippedAnexos.length > 0) {
      console.info('[leasing-contracts] Anexos pulados por indisponibilidade', {
        requestId,
        anexos: skippedAnexos,
      })
    }

    const responseNotice = fallbackNotices.length > 0 ? fallbackNotices.join(' | ') : undefined
    const responseNoticeHeader = responseNotice ? sanitizeHeaderValue(responseNotice) : ''
    const shouldSetNoticeHeader = Boolean(responseNoticeHeader)
    if (files.length === 1) {
      const [single] = files
      const extension = path.extname(single.name).toLowerCase()
      const contentType = extension === '.pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${single.name}"`)
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      if (shouldSetNoticeHeader) {
        res.setHeader('X-Contracts-Notice', responseNoticeHeader)
      }
      res.end(single.buffer)
      return
    }

    const zipBuffer = await createZipFromFiles(files)
    const downloadName = buildZipFileName(tipoContrato, dadosLeasing.cpfCnpj)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    if (shouldSetNoticeHeader) {
      res.setHeader('X-Contracts-Notice', responseNoticeHeader)
    }
    res.end(zipBuffer)
  } catch (error) {
    if (error instanceof LeasingContractsError) {
      const statusCode = error.statusCode ?? 500
      sendErrorResponse(
        res,
        statusCode,
        {
          code: error.code ?? 'LEASING_CONTRACTS_ERROR',
          message: error.message ?? 'Não foi possível gerar os contratos de leasing.',
          hint: error.hint,
        },
        requestId,
        vercelId,
      )
      return
    }

    console.error('[leasing-contracts] Erro inesperado ao gerar documentos', {
      requestId,
      vercelId,
      errName: error?.name,
      errMessage: error?.message,
      topStack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 3).join('\n') : undefined,
    })
    const payload = buildUnknownErrorPayload(error)
    sendErrorResponse(
      res,
      500,
      {
        ...payload,
      },
      requestId,
      vercelId,
    )
  }
}
