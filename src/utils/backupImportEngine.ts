import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { sanitizeAndDeduplicateClients } from '../lib/imports/clientImportSanitizer'

type BackupPayload = {
  data: {
    clients: Record<string, unknown>[]
    proposals: Record<string, unknown>[]
  }
}

export type BackupPreview = {
  sourceFormat: 'json' | 'csv' | 'xlsx'
  totalRows: number
  clients: number
  proposals: number
  sample: Array<Record<string, unknown>>
  discardedRows?: number
  discardedReasons?: string[]
}

const xmlParser = new XMLParser({ ignoreAttributes: false })

async function normalizeFormat(file: File): Promise<'json' | 'csv' | 'xlsx'> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlxs') || lower.endsWith('.xlx') || lower.endsWith('.xls')) return 'xlsx'

  const mime = (file.type || '').toLowerCase()
  if (mime.includes('json')) return 'json'
  if (mime.includes('csv') || mime.includes('plain')) return 'csv'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'xlsx'

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const isZip = header[0] === 0x50 && header[1] === 0x4b // PK
  const isXlsOle = header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0
  if (isZip || isXlsOle) return 'xlsx'

  throw new Error('Formato não suportado. Use .xlsx, .xls, .csv ou .json.')
}

function splitCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  values.push(current.trim())
  return values
}

function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function pickFirst(row: Record<string, unknown>, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function parseCsvRows(csv: string): Record<string, unknown>[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0]).map((h) => normalizeHeader(h.trim()))
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    return headers.reduce<Record<string, unknown>>((acc, header, index) => {
      acc[header] = cols[index] ?? ''
      return acc
    }, {})
  })
}

function excelColumnToIndex(ref: string): number {
  const letters = ref.replace(/\d/g, '')
  let index = 0
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64)
  }
  return index - 1
}

async function xlsxToCsvContent(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  let zip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new Error('Não foi possível ler a planilha. Para arquivos .xls legados, exporte como .xlsx e tente novamente.')
  }
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string')
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string')
  if (!sheetXml) throw new Error('Planilha inválida: sheet1.xml não encontrada.')

  const sharedStrings: string[] = []
  if (sharedStringsXml) {
    const sharedDoc = xmlParser.parse(sharedStringsXml) as { sst?: { si?: Array<{ t?: string }> } }
    const si = sharedDoc?.sst?.si ?? []
    si.forEach((entry) => sharedStrings.push(entry?.t ?? ''))
  }

  const sheetDoc = xmlParser.parse(sheetXml) as {
    worksheet?: { sheetData?: { row?: Array<{ c?: Array<{ '@_r'?: string, '@_t'?: string, v?: string }> }> } }
  }
  const rows = sheetDoc?.worksheet?.sheetData?.row ?? []
  const grid: string[][] = []
  rows.forEach((row) => {
    const target: string[] = []
    const cells = row.c ?? []
    cells.forEach((cell) => {
      const colIndex = excelColumnToIndex(cell['@_r'] ?? 'A1')
      let value = cell.v ?? ''
      if (cell['@_t'] === 's') {
        value = sharedStrings[Number(value)] ?? ''
      }
      target[colIndex] = `${value}`
    })
    grid.push(target)
  })

  return grid.map((row) => row.map((value) => `"${(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

function mapRowsToBackupPayload(rows: Record<string, unknown>[]): {
  payload: BackupPayload
  discardedRows: number
  discardedReasons: string[]
} {
  const rawClients: Record<string, unknown>[] = []
  const proposals: Record<string, unknown>[] = []

  rows.forEach((row) => {
    const entityValue = typeof row.entity === 'string' ? row.entity : typeof row.tipo === 'string' ? row.tipo : ''
    const entity = entityValue.toLowerCase()
    const hasProposalSignals = Boolean(row.proposal_type || row.proposal_code || row.proposal_id)
    const target = entity === 'proposal' || entity === 'proposta' || hasProposalSignals ? proposals : rawClients
    if (target === rawClients) {
      const normalizedClient = {
        ...row,
        name: pickFirst(row, ['name', 'nome', 'cliente', 'nome_cliente', 'razao_social']),
        document: pickFirst(row, ['document', 'documento', 'cpf', 'cnpj', 'cpf_cnpj']),
        email: pickFirst(row, ['email', 'e_mail']),
        phone: pickFirst(row, ['phone', 'telefone', 'celular', 'whatsapp']),
        city: pickFirst(row, ['city', 'cidade']),
        state: pickFirst(row, ['state', 'uf', 'estado']),
        address: pickFirst(row, ['address', 'endereco', 'logradouro']),
        uc: pickFirst(row, ['uc', 'unidade_consumidora', 'unidade']),
        distribuidora: pickFirst(row, ['distribuidora', 'concessionaria']),
      }
      target.push(normalizedClient)
      return
    }
    target.push({ ...row })
  })

  const { clients, discarded } = sanitizeAndDeduplicateClients(rawClients)
  return {
    payload: { data: { clients: clients as unknown as Record<string, unknown>[], proposals } },
    discardedRows: discarded.length,
    discardedReasons: Array.from(new Set(discarded.map((item) => item.reason))).slice(0, 10),
  }
}

export async function parseBackupFileToPayload(file: File): Promise<{ payload: BackupPayload, preview: BackupPreview }> {
  const format = await normalizeFormat(file)

  if (format === 'json') {
    const parsed = JSON.parse(await file.text()) as BackupPayload | Record<string, unknown>[]
    const mapped = Array.isArray(parsed) ? mapRowsToBackupPayload(parsed) : null
    const payload = mapped ? mapped.payload : parsed
    const clients = Array.isArray(payload?.data?.clients) ? payload.data.clients : []
    const proposals = Array.isArray(payload?.data?.proposals) ? payload.data.proposals : []
    return {
      payload: { data: { clients, proposals } },
      preview: {
        sourceFormat: 'json',
        totalRows: clients.length + proposals.length,
        clients: clients.length,
        proposals: proposals.length,
        sample: [...clients.slice(0, 3), ...proposals.slice(0, 2)],
        discardedRows: mapped?.discardedRows ?? 0,
        discardedReasons: mapped?.discardedReasons ?? [],
      },
    }
  }

  const csv = format === 'csv' ? await file.text() : await xlsxToCsvContent(file)
  const rows = parseCsvRows(csv)
  const mapped = mapRowsToBackupPayload(rows)
  const payload = mapped.payload
  return {
    payload,
    preview: {
      sourceFormat: format === 'csv' ? 'csv' : 'xlsx',
      totalRows: rows.length,
      clients: payload.data.clients.length,
      proposals: payload.data.proposals.length,
      sample: rows.slice(0, 5),
      discardedRows: mapped.discardedRows,
      discardedReasons: mapped.discardedReasons,
    },
  }
}
