/**
 * extractProposalPdf.ts
 *
 * Extracts proposal data from a SolarInvest PDF proposal (leasing or venda).
 * Uses the same pdf.js CDN approach as budgetUploadPipeline.ts.
 */

import { toNumberFlexible } from '../locale/br-number'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProposalPdfTipo = 'LEASING' | 'VENDA_DIRETA'

export type ParsedProposalCliente = {
  nome: string | null
  documento: string | null
  email: string | null
  telefone: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  distribuidora: string | null
}

export type ParsedProposalTecnico = {
  potenciaInstaladaKwp: number | null
  numeroModulos: number | null
  potenciaModuloWp: number | null
  modeloModulo: string | null
  modeloInversor: string | null
  geracaoMensalKwh: number | null
  energiaContratadaKwhMes: number | null
  tipoInstalacao: string | null
}

export type ParsedProposalFinanceiro = {
  tarifaCheia: number | null
  descontoContratualPct: number | null
  capex: number | null
}

export type ParsedProposalPdfData = {
  isPropostaSolarInvest: boolean
  tipoProposta: ProposalPdfTipo | null
  budgetId: string | null
  cliente: ParsedProposalCliente
  tecnico: ParsedProposalTecnico
  financeiro: ParsedProposalFinanceiro
}

// ─── pdf.js loader (reuses pattern from budgetUploadPipeline.ts) ──────────────

const PDFJS_CDN_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/'

type PdfJsModule = {
  getDocument: (src: unknown) => { promise: Promise<PdfDocument> }
  GlobalWorkerOptions?: { workerSrc?: string }
}

type PdfDocument = {
  numPages: number
  getPage: (index: number) => Promise<PdfPage>
}

type PdfPage = {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
  cleanup?: () => void
}

let pdfJsLoader: Promise<PdfJsModule> | null = null

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsLoader) {
    pdfJsLoader = import(
      /* @vite-ignore */ `${PDFJS_CDN_BASE}build/pdf.mjs`,
    ).then((module: PdfJsModule) => {
      if (module?.GlobalWorkerOptions) {
        module.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}build/pdf.worker.mjs`
      }
      return module
    })
  }
  return pdfJsLoader
}

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await loadPdfJs()
  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)
  const loadingTask = pdfjs.getDocument({ data })
  const pdf = await loadingTask.promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => item.str ?? '').join(' ')
    pages.push(pageText)
    page.cleanup?.()
  }

  return pages.join('\n\n')
}

// ─── Text normalisation ───────────────────────────────────────────────────────

/**
 * Normalises Unicode (e.g. removes combining diacritics artefacts from pdfs)
 * and collapses runs of whitespace.
 */
function normalise(text: string): string {
  return text.normalize('NFKC').replace(/\s{2,}/g, ' ').trim()
}

// ─── Field extraction helpers ─────────────────────────────────────────────────

/**
 * Extracts the value that follows a given label pattern in the full text.
 * The value is everything up to the next newline (or line break).
 */
function extractAfterLabel(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text)
  if (!match) {
    return null
  }
  const raw = (match[1] ?? '').trim()
  return raw.length > 0 && raw !== '—' ? raw : null
}

/** Parse a BR-formatted number like "1.234,56" or "1234.56" */
function parseNumber(raw: string | null): number | null {
  if (!raw) {
    return null
  }
  return toNumberFlexible(raw)
}

/**
 * Parse a currency string like "R$ 1.234,56" → 1234.56
 */
function parseCurrency(raw: string | null): number | null {
  if (!raw) {
    return null
  }
  const cleaned = raw.replace(/R\$\s*/gi, '').trim()
  return toNumberFlexible(cleaned)
}

/**
 * Given an "endereço completo" string rendered by formatClienteEnderecoCompleto()
 * like "Rua Tal, 123 • São Paulo / SP", extract the parts.
 */
function parseEnderecoCompleto(raw: string | null): {
  endereco: string | null
  cidade: string | null
  uf: string | null
} {
  if (!raw) {
    return { endereco: null, cidade: null, uf: null }
  }

  // Separator used by formatClienteEnderecoCompleto is " • "
  const parts = raw.split(/\s*•\s*/)

  let endereco: string | null = null
  let cidade: string | null = null
  let uf: string | null = null

  if (parts.length === 1) {
    // Could be just endereco or just "cidade / UF"
    const cidadeUf = (parts[0] ?? '').match(/^(.+?)\s*\/\s*([A-Z]{2})$/)
    if (cidadeUf) {
      cidade = (cidadeUf[1] ?? '').trim() || null
      uf = (cidadeUf[2] ?? '').trim() || null
    } else {
      endereco = (parts[0] ?? '').trim() || null
    }
  } else {
    // First part is endereco, last part is "cidade / UF"
    endereco = (parts[0] ?? '').trim() || null
    const last = parts[parts.length - 1] ?? ''
    const cidadeUf = last.match(/^(.+?)\s*\/\s*([A-Z]{2})$/)
    if (cidadeUf) {
      cidade = (cidadeUf[1] ?? '').trim() || null
      uf = (cidadeUf[2] ?? '').trim() || null
    }
  }

  return { endereco, cidade, uf }
}

/**
 * Identifies whether the PDF is a SolarInvest leasing or venda proposal.
 */
function detectTipoProposta(text: string): ProposalPdfTipo | null {
  if (/SOLARINVEST.*LEASING|LEASING.*SOLARINVEST|Leasing SolarInvest/i.test(text)) {
    return 'LEASING'
  }
  if (
    /Proposta de Aquisi[çc][aã]o.*Solar|VENDA\s+DIRETA|Venda\s+Direta.*SolarInvest|SolarInvest.*Venda/i.test(
      text,
    )
  ) {
    return 'VENDA_DIRETA'
  }
  return null
}

/**
 * Detect if the text looks like a SolarInvest proposal at all.
 */
function isSolarInvestProposal(text: string): boolean {
  return /SOLARINVEST|SolarInvest/i.test(text)
}

// ─── Leasing extraction ───────────────────────────────────────────────────────

function extractLeasingFields(text: string): {
  cliente: ParsedProposalCliente
  tecnico: ParsedProposalTecnico
  financeiro: ParsedProposalFinanceiro
  budgetId: string | null
} {
  const t = normalise(text)

  const budgetId = extractAfterLabel(t, /Código do orçamento[:\s]+([^\n•|]+)/i)

  // Client
  const nomeRaw = extractAfterLabel(t, /Nome\/Razão social[:\s]+([^\n•|]+)/i)
  const documentoRaw = extractAfterLabel(t, /CPF\/CNPJ[:\s]+([^\n•|]+)/i)
  const emailRaw = extractAfterLabel(t, /E-mail[:\s]+([^\n•|]+)/i)
  const telefoneRaw = extractAfterLabel(t, /Telefone[:\s]+([^\n•|]+)/i)
  const enderecoRaw = extractAfterLabel(t, /Endereço[:\s]+([^\n|]+)/i)
  const cepRaw = extractAfterLabel(t, /CEP[:\s]+([^\n•|]+)/i)
  const distribuidoraRaw = extractAfterLabel(t, /^Distribuidora[:\s]+([^\n•|]+)/im)

  const { endereco, cidade, uf } = parseEnderecoCompleto(enderecoRaw)

  const cliente: ParsedProposalCliente = {
    nome: nomeRaw,
    documento: documentoRaw,
    email: emailRaw,
    telefone: telefoneRaw,
    endereco,
    cidade,
    uf,
    cep: cepRaw,
    distribuidora: distribuidoraRaw,
  }

  // Technical
  const potKwpRaw = extractAfterLabel(t, /Potência instalada \(kWp\)[:\s]+([\d.,]+)/i)
  const modeloInversorRaw = extractAfterLabel(t, /Inversores fotovoltaicos[:\s]+([^\n|•]+)/i)
  const modeloModuloRaw = extractAfterLabel(t, /Módulos fotovoltaicos[:\s]+([^\n|•]+)/i)
  const potModuloRaw = extractAfterLabel(t, /Potência d[oe]s?\s+Módulos?\s*\(Wp\)[:\s]+([\d.,]+)/i)
  const numModulosRaw = extractAfterLabel(t, /Número de módulos[:\s]+([\d.,]+)/i)
  const energiaContratadaRaw = extractAfterLabel(
    t,
    /Energia contratada\s*\(kWh\/mês\)[:\s]+([\d.,]+)/i,
  )
  const geracaoRaw = extractAfterLabel(t, /Geração estimada\s*\(kWh\/mês\)[:\s]+([\d.,]+)/i)
  const tipoInstalacaoRaw = extractAfterLabel(t, /Tipo de instalação[:\s]+([^\n|•]+)/i)

  const tecnico: ParsedProposalTecnico = {
    potenciaInstaladaKwp: parseNumber(potKwpRaw),
    numeroModulos: parseNumber(numModulosRaw),
    potenciaModuloWp: parseNumber(potModuloRaw),
    modeloModulo: modeloModuloRaw,
    modeloInversor: modeloInversorRaw,
    geracaoMensalKwh: parseNumber(geracaoRaw),
    energiaContratadaKwhMes: parseNumber(energiaContratadaRaw),
    tipoInstalacao: tipoInstalacaoRaw,
  }

  // Financial
  const tarifaRaw = extractAfterLabel(t, /Tarifa cheia da distribuidora[:\s]+([^\n|•]+)/i)
  const descontoRaw = extractAfterLabel(t, /Desconto contratado[:\s]+([\d.,]+)\s*%/i)

  const financeiro: ParsedProposalFinanceiro = {
    tarifaCheia: parseCurrency(tarifaRaw),
    descontoContratualPct: parseNumber(descontoRaw),
    capex: null, // Leasing proposals don't show capex to client
  }

  return { cliente, tecnico, financeiro, budgetId }
}

// ─── Venda extraction ─────────────────────────────────────────────────────────

function extractVendaFields(text: string): {
  cliente: ParsedProposalCliente
  tecnico: ParsedProposalTecnico
  financeiro: ParsedProposalFinanceiro
  budgetId: string | null
} {
  const t = normalise(text)

  const budgetId = extractAfterLabel(t, /Código do orçamento[:\s]+([^\n•|]+)/i)

  // Client (venda uses different label: "Cliente:" instead of "Nome/Razão social:")
  const nomeRaw =
    extractAfterLabel(t, /Nome\/Razão social[:\s]+([^\n•|]+)/i) ??
    extractAfterLabel(t, /^Cliente[:\s]+([^\n•|]+)/im)
  const documentoRaw =
    extractAfterLabel(t, /CPF\/CNPJ[:\s]+([^\n•|]+)/i) ??
    extractAfterLabel(t, /^Documento[:\s]+([^\n•|]+)/im)
  const emailRaw = extractAfterLabel(t, /E-mail[:\s]+([^\n•|]+)/i)
  const telefoneRaw = extractAfterLabel(t, /Telefone[:\s]+([^\n•|]+)/i)
  const enderecoRaw = extractAfterLabel(t, /Endereço[:\s]+([^\n|]+)/i)
  const cepRaw = extractAfterLabel(t, /CEP[:\s]+([^\n•|]+)/i)
  const distribuidoraRaw = extractAfterLabel(t, /Distribuidora[:\s]+([^\n•|]+)/i)

  const { endereco, cidade, uf } = parseEnderecoCompleto(enderecoRaw)

  const cliente: ParsedProposalCliente = {
    nome: nomeRaw,
    documento: documentoRaw,
    email: emailRaw,
    telefone: telefoneRaw,
    endereco,
    cidade,
    uf,
    cep: cepRaw,
    distribuidora: distribuidoraRaw,
  }

  // Technical
  const potKwpRaw = extractAfterLabel(t, /Potência do sistema[:\s]+([\d.,]+)\s*kWp/i)
  const modeloInversorRaw =
    extractAfterLabel(t, /Inversores fotovoltaicos[:\s]+([^\n|•]+)/i) ??
    extractAfterLabel(t, /^Inversores[:\s]+([^\n|•]+)/im)
  const modeloModuloRaw =
    extractAfterLabel(t, /Módulos fotovoltaicos[:\s]+([^\n|•]+)/i) ??
    extractAfterLabel(t, /^Módulos[:\s]+([^\n|•]+)/im)
  const potModuloRaw =
    extractAfterLabel(t, /Potência d[oe]s?\s+Módulos?\s*\(Wp\)[:\s]+([\d.,]+)/i) ??
    extractAfterLabel(t, /Potência dos módulos[:\s]+([\d.,]+)/i)
  const geracaoRaw = extractAfterLabel(t, /Geração estimada\s*\(kWh\/mês\)[:\s]+([\d.,]+)/i)
  const tipoInstalacaoRaw = extractAfterLabel(t, /Tipo de instalação[:\s]+([^\n|•]+)/i)
  // Venda usually shows consumption from the kit field
  const energiaRaw =
    extractAfterLabel(t, /Energia contratada\s*\(kWh\/mês\)[:\s]+([\d.,]+)/i) ??
    extractAfterLabel(t, /Geração estimada\s*\(kWh\/mês\)[:\s]+([\d.,]+)/i)

  const tecnico: ParsedProposalTecnico = {
    potenciaInstaladaKwp: parseNumber(potKwpRaw),
    numeroModulos: null,
    potenciaModuloWp: parseNumber(potModuloRaw),
    modeloModulo: modeloModuloRaw,
    modeloInversor: modeloInversorRaw,
    geracaoMensalKwh: parseNumber(geracaoRaw),
    energiaContratadaKwhMes: parseNumber(energiaRaw),
    tipoInstalacao: tipoInstalacaoRaw,
  }

  // Financial (venda has capex as "Investimento Total do Projeto" or "Investimento total (CAPEX)")
  const tarifaRaw =
    extractAfterLabel(t, /Tarifa atual\s*\(distribuidora\)[:\s]+([^\n|•]+)/i) ??
    extractAfterLabel(t, /Tarifa cheia da distribuidora[:\s]+([^\n|•]+)/i)
  const capexRaw =
    extractAfterLabel(t, /Investimento total \(CAPEX\)[:\s]+R?\$?\s*([\d.,]+)/i) ??
    extractAfterLabel(t, /Investimento Total do Projeto[:\s]+R?\$?\s*([\d.,]+)/i) ??
    extractAfterLabel(t, /Investimento total[:\s]+R?\$?\s*([\d.,]+)/i)

  const financeiro: ParsedProposalFinanceiro = {
    tarifaCheia: parseCurrency(tarifaRaw),
    descontoContratualPct: null,
    capex: parseCurrency(capexRaw),
  }

  return { cliente, tecnico, financeiro, budgetId }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts proposal data from a PDF file.
 *
 * @param file - PDF file to process
 * @returns Parsed proposal data, or throws on PDF load error
 */
export async function extractProposalFromPdf(file: File): Promise<ParsedProposalPdfData> {
  const text = await extractTextFromPdf(file)

  const isPropostaSolarInvest = isSolarInvestProposal(text)
  const tipoProposta = detectTipoProposta(text)

  if (!isPropostaSolarInvest || !tipoProposta) {
    return {
      isPropostaSolarInvest,
      tipoProposta,
      budgetId: null,
      cliente: {
        nome: null,
        documento: null,
        email: null,
        telefone: null,
        endereco: null,
        cidade: null,
        uf: null,
        cep: null,
        distribuidora: null,
      },
      tecnico: {
        potenciaInstaladaKwp: null,
        numeroModulos: null,
        potenciaModuloWp: null,
        modeloModulo: null,
        modeloInversor: null,
        geracaoMensalKwh: null,
        energiaContratadaKwhMes: null,
        tipoInstalacao: null,
      },
      financeiro: {
        tarifaCheia: null,
        descontoContratualPct: null,
        capex: null,
      },
    }
  }

  if (tipoProposta === 'LEASING') {
    const { cliente, tecnico, financeiro, budgetId } = extractLeasingFields(text)
    return { isPropostaSolarInvest: true, tipoProposta, budgetId, cliente, tecnico, financeiro }
  }

  const { cliente, tecnico, financeiro, budgetId } = extractVendaFields(text)
  return { isPropostaSolarInvest: true, tipoProposta, budgetId, cliente, tecnico, financeiro }
}
