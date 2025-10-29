import { formatNumberBRWithOptions, toNumberFlexible } from '../lib/locale/br-number'
import { importBudgetFromLines } from '../lib/import'

const HEADER_PATTERNS = {
  numeroOrcamento: /N[úu]mero do Or[cç]amento:\s*([A-Za-z0-9\-/.]+)/i,
  validade: /Or[cç]amento V[áa]lido at[ée]:\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i,
  de: /De:\s*(.+)$/i,
  para: /Para:\s*(.+)$/i,
}

const FOOTER_TOTAL_REGEX = /Valor\s+total:\s*R?\$?\s*([\d.,]+)/i

const CSV_HEADER =
  'numeroOrcamento;validade;de;para;produto;codigo;modelo;descricao;quantidade;unidade;precoUnitario;precoTotal;valorTotal'

type HeaderData = {
  numeroOrcamento: string | null
  validade: string | null
  de: string | null
  para: string | null
}

type ItemData = {
  produto: string | null
  codigo: string | null
  modelo: string | null
  fabricante: string | null
  descricao: string
  quantidade: number | null
  unidade: string | null
  precoUnitario: number | null
  precoTotal: number | null
}

type ResumoData = {
  valorTotal: number | null
  moeda: string
}

export type StructuredBudget = {
  header: HeaderData
  itens: ItemData[]
  resumo: ResumoData
  warnings: string[]
  meta: {
    ignoredByNoise: number
    ignoredByValidation: number
  }
}

export function parseStructuredBudget(lines: string[]): StructuredBudget {
  const header = parseHeader(lines)
  const { itens, warnings, ignoredByNoise, ignoredByValidation } = parseItems(lines)
  const resumo = parseResumo(lines)
  return {
    header,
    itens,
    resumo,
    warnings,
    meta: {
      ignoredByNoise,
      ignoredByValidation,
    },
  }
}

export function structuredBudgetToCsv(structured: StructuredBudget): string {
  const rows: string[] = [CSV_HEADER]
  const header = structured.header
  const resumo = structured.resumo

  if (structured.itens.length === 0) {
    rows.push(
      [
        header.numeroOrcamento ?? '',
        header.validade ?? '',
        header.de ?? '',
        header.para ?? '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        resumo.valorTotal !== null ? formatCurrencyForCsv(resumo.valorTotal) : '',
      ].join(';'),
    )
    return rows.join('\n')
  }

  structured.itens.forEach((item) => {
    rows.push(
      [
        header.numeroOrcamento ?? '',
        header.validade ?? '',
        header.de ?? '',
        header.para ?? '',
        item.produto ?? '',
        item.codigo ?? '',
        item.modelo ?? '',
        item.descricao ?? '',
        item.quantidade !== null ? formatQuantityForCsv(item.quantidade) : '',
        item.unidade ?? '',
        item.precoUnitario !== null ? formatCurrencyForCsv(item.precoUnitario) : '',
        item.precoTotal !== null ? formatCurrencyForCsv(item.precoTotal) : '',
        resumo.valorTotal !== null ? formatCurrencyForCsv(resumo.valorTotal) : '',
      ].join(';'),
    )
  })

  return rows.join('\n')
}

function parseHeader(lines: string[]): HeaderData {
  const header: HeaderData = {
    numeroOrcamento: null,
    validade: null,
    de: null,
    para: null,
  }

  const limit = Math.min(lines.length, 150)
  for (let i = 0; i < limit; i += 1) {
    const line = lines[i]
    if (!header.numeroOrcamento) {
      const match = line.match(HEADER_PATTERNS.numeroOrcamento)
      if (match) {
        header.numeroOrcamento = match[1].trim()
      }
    }
    if (!header.validade) {
      const match = line.match(HEADER_PATTERNS.validade)
      if (match) {
        header.validade = toISODate(match[1])
      }
    }
    if (!header.de) {
      const match = line.match(HEADER_PATTERNS.de)
      if (match) {
        header.de = match[1].trim()
      }
    }
    if (!header.para) {
      const match = line.match(HEADER_PATTERNS.para)
      if (match) {
        header.para = match[1].trim()
      }
    }
  }

  return header
}

function parseItems(
  lines: string[],
): { itens: ItemData[]; warnings: string[]; ignoredByNoise: number; ignoredByValidation: number } {
  const result = importBudgetFromLines(lines)

  const itens: ItemData[] = result.items.map((item) => ({
    produto: item.produto,
    codigo: null,
    modelo: null,
    fabricante: null,
    descricao: item.descricao ?? '—',
    quantidade: Number.isFinite(item.quantidade) ? Math.round(item.quantidade) : null,
    unidade: item.unidade,
    precoUnitario: null,
    precoTotal: null,
  }))

  const warnings: string[] = []
  if (!itens.length) {
    warnings.push('Não foi possível identificar a lista de itens.')
  }
  if (result.ignoredByValidation > 0) {
    const countLabel = result.ignoredByValidation === 1 ? 'item' : 'itens'
    warnings.push(`Foram ignorados ${result.ignoredByValidation} ${countLabel} por não atenderem aos critérios.`)
  }

  return {
    itens,
    warnings,
    ignoredByNoise: result.ignoredByNoise,
    ignoredByValidation: result.ignoredByValidation,
  }
}

function parseResumo(lines: string[]): ResumoData {
  const resumo: ResumoData = { valorTotal: null, moeda: 'BRL' }
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!line) {
      continue
    }
    const match = line.match(FOOTER_TOTAL_REGEX)
    if (match) {
      const value = parseBRL(match[1])
      if (!Number.isNaN(value)) {
        resumo.valorTotal = value
        break
      }
    }
  }
  return resumo
}

function formatQuantityForCsv(value: number): string {
  return `${Math.round(value)}`
}

function parseBRL(value: string): number {
  const parsed = toNumberFlexible(value)
  return parsed != null && Number.isFinite(parsed) ? parsed : Number.NaN
}

function toISODate(raw: string): string {
  const [day, month, year] = raw.split('-')
  if (day && month && year) {
    return `${year}-${month}-${day}`
  }
  return raw
}


function formatCurrencyForCsv(value: number): string {
  return formatNumberBRWithOptions(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}


export type StructuredItem = ItemData
export type StructuredHeader = HeaderData
export type StructuredResumo = ResumoData
