import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import Mustache from 'mustache'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const JSON_BODY_LIMIT = 256 * 1024
const DOCX_TEMPLATE_PARTS_REGEX = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i
const LEASING_TEMPLATES_DIR = path.resolve(
  process.cwd(),
  'assets/templates/contratos/leasing',
)

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

export class LeasingContractsError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   */
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.name = 'LeasingContractsError'
  }
}

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')
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
        reject(new LeasingContractsError(413, 'Payload acima do limite permitido.'))
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
        reject(new LeasingContractsError(400, 'JSON inválido na requisição.'))
      }
    })

    req.on('error', (error) => {
      reject(error)
    })
  })
}

const CONTRACT_TEMPLATES = {
  residencial: 'CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx',
  condominio: 'CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - CONDOMINIO.docx',
}

const ANEXO_DEFINITIONS = [
  {
    id: 'ANEXO_I',
    label: 'Anexo I – Especificações Técnicas',
    templates: {
      residencial: 'ANEXO I - ESPECIFICAÇÕES TECNICAS E PROPOSTA COMERCIAL (Residencial).docx',
      condominio: 'ANEXO I - ESPECIFICAÇÕES TECNICAS E PROPOSTA COMERCIAL (Condominio).docx',
    },
    appliesTo: new Set(['residencial', 'condominio']),
  },
  {
    id: 'ANEXO_II',
    label: 'Anexo II – Opção de Compra',
    templates: {
      residencial: 'Anexo II – Opção de Compra da Usina (todos).docx',
      condominio: 'Anexo II – Opção de Compra da Usina (todos).docx',
    },
    appliesTo: new Set(['residencial', 'condominio']),
  },
  {
    id: 'ANEXO_III',
    label: 'Anexo III – Regras de Cálculo',
    templates: {
      residencial: 'ANEXO III - Regras de Cálculo da Mensalidade (todos).docx',
      condominio: 'ANEXO III - Regras de Cálculo da Mensalidade (todos).docx',
    },
    appliesTo: new Set(['residencial', 'condominio']),
  },
  {
    id: 'ANEXO_IV',
    label: 'Anexo IV – Autorização do Proprietário',
    templates: {
      residencial:
        'Anexo IV – Termo de Autorização e Procuração do Proprietário, Herdeiros ou Representantes Legais (Residencial).docx',
    },
    appliesTo: new Set(['residencial']),
  },
  {
    id: 'ANEXO_VII',
    label: 'Anexo VII – Termo de Entrega e Aceite',
    templates: {
      residencial: 'ANEXO VII – TERMO DE ENTREGA E ACEITE TÉCNICO DA USINA (Residencial).docx',
      condominio: 'ANEXO VII – TERMO DE ENTREGA E ACEITE TÉCNICO DA USINA (Condominio).docx',
    },
    appliesTo: new Set(['residencial', 'condominio']),
  },
  {
    id: 'ANEXO_VIII',
    label: 'Anexo VIII – Procuração do Condomínio',
    templates: {
      condominio: 'Anexo VIII – TERMO DE AUTORIZAÇÃO E PROCURAÇÃO DO CONDOMÍNIO (Condominio).docx',
    },
    appliesTo: new Set(['condominio']),
  },
]

const ANEXO_BY_ID = new Map(ANEXO_DEFINITIONS.map((anexo) => [anexo.id, anexo]))

const sanitizeContratoTipo = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'residencial' || normalized === 'condominio') {
    return normalized
  }
  return null
}

const ensureField = (payload, key, label) => {
  const value = typeof payload[key] === 'string' ? payload[key].trim() : ''
  if (!value) {
    throw new LeasingContractsError(400, `Campo obrigatório ausente: ${label}.`)
  }
  return value
}

const optionalField = (payload, key) =>
  typeof payload[key] === 'string' ? payload[key].trim() : ''

const sanitizeDocumentoId = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits || 'documento'
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

const sanitizeDadosLeasing = (dados, tipoContrato) => {
  if (!dados || typeof dados !== 'object') {
    throw new LeasingContractsError(400, 'Estrutura de dados do contrato inválida.')
  }

  const normalized = {
    // Core client info
    nomeCompleto: ensureField(dados, 'nomeCompleto', 'Nome completo / razão social'),
    cpfCnpj: ensureField(dados, 'cpfCnpj', 'CPF/CNPJ'),
    cnpj: typeof dados.cnpj === 'string' ? dados.cnpj.trim() : '',
    rg: typeof dados.rg === 'string' ? dados.rg.trim() : '',
    razaoSocial: typeof dados.razaoSocial === 'string' ? dados.razaoSocial.trim() : '',
    representanteLegal: typeof dados.representanteLegal === 'string' ? dados.representanteLegal.trim() : '',
    
    // Personal info
    estadoCivil: typeof dados.estadoCivil === 'string' ? dados.estadoCivil.trim() : '',
    nacionalidade: typeof dados.nacionalidade === 'string' ? dados.nacionalidade.trim() : '',
    profissao: typeof dados.profissao === 'string' ? dados.profissao.trim() : '',
    
    // Address fields
    enderecoCompleto: ensureField(dados, 'enderecoCompleto', 'Endereço completo'),
    endereco: typeof dados.endereco === 'string' ? dados.endereco.trim() : '',
    cidade: typeof dados.cidade === 'string' ? dados.cidade.trim() : '',
    cep: typeof dados.cep === 'string' ? dados.cep.trim() : '',
    uf: typeof dados.uf === 'string' ? dados.uf.trim().toUpperCase() : '',
    
    // Contact info
    telefone: typeof dados.telefone === 'string' ? dados.telefone.trim() : '',
    email: typeof dados.email === 'string' ? dados.email.trim() : '',
    
    // UC and installation
    unidadeConsumidora: ensureField(dados, 'unidadeConsumidora', 'Unidade consumidora'),
    localEntrega: ensureField(dados, 'localEntrega', 'Local de entrega'),
    
    // Contractor company info
    cnpjContratada: typeof dados.cnpjContratada === 'string' ? dados.cnpjContratada.trim() : '',
    enderecoContratada: typeof dados.enderecoContratada === 'string' ? dados.enderecoContratada.trim() : '',
    
    // Dates
    dataInicio: optionalField(dados, 'dataInicio'),
    dataFim: optionalField(dados, 'dataFim'),
    dataHomologacao: optionalField(dados, 'dataHomologacao'),
    dataAtualExtenso: optionalField(dados, 'dataAtualExtenso'),
    diaVencimento: typeof dados.diaVencimento === 'string' ? dados.diaVencimento.trim() : '',
    prazoContratual: typeof dados.prazoContratual === 'string' ? dados.prazoContratual.trim() : '',
    
    // Technical specs
    potencia: ensureField(dados, 'potencia', 'Potência contratada (kWp)'),
    kWhContratado: ensureField(dados, 'kWhContratado', 'Energia contratada (kWh)'),
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

  if (!normalized.dataAtualExtenso) {
    normalized.dataAtualExtenso = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
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

  if (tipoContrato === 'condominio') {
    selecionados.add('ANEXO_VIII')
  }

  return Array.from(selecionados)
}

/**
 * Carrega um template DOCX, com suporte a templates específicos por UF.
 * Ordem de busca:
 * 1. Template específico do UF (leasing/GO/template.docx)
 * 2. Template padrão (leasing/template.docx)
 * 
 * @param {string} fileName - Nome do arquivo template
 * @param {string} [uf] - UF para buscar template específico
 */
const loadDocxTemplate = async (fileName, uf) => {
  const normalizedUf = typeof uf === 'string' ? uf.trim().toUpperCase() : ''

  // Tenta carregar template específico do UF primeiro
  if (normalizedUf && isValidUf(normalizedUf)) {
    const ufTemplatePath = path.join(LEASING_TEMPLATES_DIR, normalizedUf, fileName)
    try {
      const buffer = await fs.readFile(ufTemplatePath)
      console.log(`[leasing-contracts] Usando template específico para UF ${normalizedUf}: ${fileName}`)
      return buffer
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        console.warn(`[leasing-contracts] Erro ao acessar template específico do UF ${normalizedUf}:`, error)
      }
      // Continua para tentar o template padrão
    }
  } else if (normalizedUf) {
    console.warn(`[leasing-contracts] UF inválido fornecido: ${normalizedUf}`)
  }

  // Fallback para template padrão
  const templatePath = path.join(LEASING_TEMPLATES_DIR, fileName)
  try {
    const buffer = await fs.readFile(templatePath)
    if (normalizedUf) {
      console.log(`[leasing-contracts] Template específico para UF ${normalizedUf} não encontrado, usando template padrão: ${fileName}`)
    }
    return buffer
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new LeasingContractsError(500, `Template não encontrado: ${fileName}`)
    }
    throw error
  }
}

const renderDocxTemplate = async (fileName, data, uf) => {
  const templateBuffer = await loadDocxTemplate(fileName, uf)
  const zip = await JSZip.loadAsync(templateBuffer)
  const partNames = Object.keys(zip.files).filter((name) => DOCX_TEMPLATE_PARTS_REGEX.test(name))

  for (const partName of partNames) {
    const file = zip.file(partName)
    if (!file) {
      continue
    }
    const xmlContent = await file.async('string')
    const rendered = Mustache.render(xmlContent, data)
    zip.file(partName, rendered)
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

const buildContractFileName = (tipoContrato, cpfCnpj) => {
  const id = sanitizeDocumentoId(cpfCnpj)
  return `leasing-${tipoContrato}-${id}.docx`
}

const buildAnexoFileName = (anexoId, cpfCnpj) => {
  const id = sanitizeDocumentoId(cpfCnpj)
  const slug = anexoId.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `anexo-${slug}-${id}.docx`
}

const buildZipFileName = (tipoContrato, cpfCnpj) => {
  const id = sanitizeDocumentoId(cpfCnpj)
  return `pacote-leasing-${tipoContrato}-${id}.zip`
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
    const template = definicao.templates[tipoContrato]
    if (!template) {
      continue
    }
    resolved.push({ id: anexoId, template })
  }
  return resolved
}

export const handleLeasingContractsRequest = async (req, res) => {
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
    const tipoContrato = sanitizeContratoTipo(body?.tipoContrato)
    if (!tipoContrato) {
      throw new LeasingContractsError(400, 'Tipo de contrato inválido.')
    }

    const dadosLeasing = sanitizeDadosLeasing(body?.dadosLeasing ?? {}, tipoContrato)
    const anexosSelecionados = sanitizeAnexosSelecionados(body?.anexosSelecionados, tipoContrato)
    const clienteUf = dadosLeasing.uf

    if (anexosSelecionados.includes('ANEXO_I')) {
      if (!dadosLeasing.modulosFV) {
        throw new LeasingContractsError(
          400,
          'O Anexo I exige a descrição dos módulos fotovoltaicos.',
        )
      }
      if (!dadosLeasing.inversoresFV) {
        throw new LeasingContractsError(
          400,
          'O Anexo I exige a descrição dos inversores.',
        )
      }
    }

    const files = []
    const contratoTemplate = CONTRACT_TEMPLATES[tipoContrato]
    const contratoBuffer = await renderDocxTemplate(contratoTemplate, {
      ...dadosLeasing,
      tipoContrato,
    }, clienteUf)
    files.push({
      name: buildContractFileName(tipoContrato, dadosLeasing.cpfCnpj),
      buffer: contratoBuffer,
    })

    const anexos = resolveTemplatesForAnexos(tipoContrato, anexosSelecionados)
    for (const anexo of anexos) {
      const buffer = await renderDocxTemplate(anexo.template, {
        ...dadosLeasing,
        tipoContrato,
      }, clienteUf)
      files.push({
        name: buildAnexoFileName(anexo.id, dadosLeasing.cpfCnpj),
        buffer,
      })
    }

    const zipBuffer = await createZipFromFiles(files)
    const downloadName = buildZipFileName(tipoContrato, dadosLeasing.cpfCnpj)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    res.end(zipBuffer)
  } catch (error) {
    const statusCode = error instanceof LeasingContractsError ? error.statusCode : 500
    const message =
      error instanceof LeasingContractsError
        ? error.message
        : 'Não foi possível gerar os contratos de leasing.'

    if (!(error instanceof LeasingContractsError)) {
      console.error('[leasing-contracts] Erro inesperado ao gerar documentos:', error)
    }

    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}
