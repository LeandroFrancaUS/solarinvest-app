/**
 * src/lib/import/xlsxParser.ts
 *
 * Minimal XLSX → string[][] parser using jszip (already a project dep) and
 * fast-xml-parser (also an existing dep).  No vulnerable third-party xlsx
 * library is needed.
 *
 * Supports:
 *  - .xlsx  (Open XML / ZIP-based, Office 2007+)
 *  - .xls   attempted as OOXML (many modern .xls files are actually OOXML);
 *            legacy binary BIFF format will throw a parse error
 *
 * Note on .xls: The legacy Binary Interchange File Format (BIFF) is a closed,
 * undocumented binary format.  Parsing it requires a dedicated library (e.g.
 * xlrd / node-xlrd) which all carry security advisories against the current
 * npm ecosystem.  Users should re-save .xls files as .xlsx before importing.
 *
 * Architecture:
 *   1. JSZip unpacks the .xlsx archive.
 *   2. XMLParser reads `xl/sharedStrings.xml` → string lookup table.
 *   3. XMLParser reads `xl/workbook.xml`      → sheet names/relIds.
 *   4. XMLParser reads `xl/worksheets/sheet1.xml` (or _rels/workbook.xml.rels
 *      to resolve the correct path for the first sheet).
 *   5. Cell values are resolved and returned as string[][].
 */

import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

// ─── Public API ──────────────────────────────────────────────────────────────

export type XlsxSheet = {
  /** Name of the sheet tab */
  name: string
  /** rows[rowIndex][colIndex] — all values as strings, empty cell = '' */
  rows: string[][]
}

/**
 * Parse the first sheet of an .xlsx file into a row/column matrix.
 *
 * @throws if the file is not a valid .xlsx ZIP archive.
 */
export async function parseXlsxFirstSheet(file: File): Promise<XlsxSheet> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  const sharedStrings = await loadSharedStrings(zip)
  const { firstSheetName, firstSheetPath } = await resolveFirstSheet(zip)
  const rows = await loadSheetRows(zip, firstSheetPath, sharedStrings)

  return { name: firstSheetName, rows }
}

/**
 * Convert a `string[][]` (rows × cols) into a semicolon-delimited CSV string
 * that is compatible with the existing `parseClientesCsv` function.
 */
export function matrixToCsv(rows: string[][], delimiter = ';'): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '')
          if (
            value.includes('"') ||
            value.includes('\n') ||
            value.includes('\r') ||
            value.includes(delimiter)
          ) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(delimiter),
    )
    .join('\n')
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // 'r' is included so that rich-text runs inside <si> elements are ALWAYS
  // returned as an array, even when a cell has only one <r> run (e.g. bold
  // headers in Excel/Google Sheets).  Without it, a single <r> is parsed as
  // a plain object and the text value is lost, silently breaking xlsx import.
  isArray: (tagName) =>
    ['si', 'r', 'sheet', 'row', 'c', 'Override', 'Relationship'].includes(tagName),
})

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path)
  if (!file) return null
  return file.async('text')
}

// ── Shared strings ────────────────────────────────────────────────────────────

async function loadSharedStrings(zip: JSZip): Promise<string[]> {
  const xml = await readZipText(zip, 'xl/sharedStrings.xml')
  if (!xml) return []

  type RichTextRun = { t?: string | { '#text': string } | number }
  const doc = parser.parse(xml) as {
    sst?: {
      si?: Array<{
        t?: string | { '#text': string } | number
        // With 'r' in isArray, this is always an Array when present.
        // Defensive union kept for callers that bypass the module-level parser.
        r?: RichTextRun[] | RichTextRun
      }>
    }
  }
  const items = doc?.sst?.si ?? []
  return items.map((item) => {
    // Rich-text: concatenate all runs.
    // 'r' is in the parser's isArray list so this is normally always an Array,
    // but guard against the non-array case for defensive correctness.
    if (Array.isArray(item.r)) {
      return item.r.map((run) => extractText(run.t)).join('')
    }
    if (item.r && typeof item.r === 'object') {
      // Single run not wrapped in array (parser misconfiguration safety net)
      return extractText((item.r as RichTextRun).t)
    }
    return extractText(item.t)
  })
}

function extractText(t: string | { '#text': string } | number | undefined): string {
  if (t == null) return ''
  if (typeof t === 'number') return String(t)
  if (typeof t === 'string') return t
  return t['#text'] ?? ''
}

// ── Workbook / sheet resolution ───────────────────────────────────────────────

type SheetInfo = { firstSheetName: string; firstSheetPath: string }

async function resolveFirstSheet(zip: JSZip): Promise<SheetInfo> {
  // Step 1: get sheet names from workbook.xml
  const wbXml = await readZipText(zip, 'xl/workbook.xml')
  let firstSheetName = 'Sheet1'
  let firstSheetRId = 'rId1'

  if (wbXml) {
    const doc = parser.parse(wbXml) as {
      workbook?: {
        sheets?: {
          sheet?: Array<{ '@_name'?: string; '@_r:id'?: string; '@_sheetId'?: string }>
        }
      }
    }
    const sheets = doc?.workbook?.sheets?.sheet ?? []
    const firstSheet = sheets[0]
    if (firstSheet) {
      firstSheetName = firstSheet['@_name'] ?? 'Sheet1'
      firstSheetRId = firstSheet['@_r:id'] ?? 'rId1'
    }
  }

  // Step 2: resolve rId → actual file path via workbook.xml.rels
  const relsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels')
  let firstSheetPath = 'xl/worksheets/sheet1.xml'

  if (relsXml) {
    const doc = parser.parse(relsXml) as {
      Relationships?: {
        Relationship?: Array<{ '@_Id'?: string; '@_Target'?: string }>
      }
    }
    const rels = doc?.Relationships?.Relationship ?? []
    const rel = rels.find((r) => r['@_Id'] === firstSheetRId)
    if (rel?.['@_Target']) {
      const target = rel['@_Target']
      // Target may be relative: "worksheets/sheet1.xml" or absolute
      firstSheetPath = target.startsWith('/')
        ? target.slice(1)
        : `xl/${target}`
    }
  }

  return { firstSheetName, firstSheetPath }
}

// ── Worksheet data ────────────────────────────────────────────────────────────

/**
 * Parse a worksheet XML into a row/column matrix.
 * Handles sparse rows/cells by using the Excel column reference (A, B, C…) to
 * place values in the correct column index.
 */
async function loadSheetRows(
  zip: JSZip,
  sheetPath: string,
  sharedStrings: string[],
): Promise<string[][]> {
  const xml = await readZipText(zip, sheetPath)
  if (!xml) return []

  const doc = parser.parse(xml) as {
    worksheet?: {
      sheetData?: {
        row?: Array<{
          '@_r'?: string | number
          c?: Array<{
            '@_r'?: string
            '@_t'?: string
            '@_s'?: string
            v?: string | number
            f?: string | number
            is?: { t?: string }
          }>
        }>
      }
    }
  }

  const sheetRows = doc?.worksheet?.sheetData?.row ?? []
  if (sheetRows.length === 0) return []

  // Find max column index across all rows so we can pad correctly
  let maxCol = 0
  for (const row of sheetRows) {
    for (const cell of row.c ?? []) {
      if (cell['@_r']) {
        const col = colLetterToIndex(cell['@_r'])
        if (col > maxCol) maxCol = col
      }
    }
  }

  // Sort rows by row number
  const sortedRows = [...sheetRows].sort((a, b) => {
    const rA = Number(a['@_r'] ?? 0)
    const rB = Number(b['@_r'] ?? 0)
    return rA - rB
  })

  // Build the matrix — only include rows that have at least one non-empty cell
  const result: string[][] = []
  for (const row of sortedRows) {
    const cells = row.c ?? []
    const rowArr = new Array<string>(maxCol + 1).fill('')
    let hasValue = false

    for (const cell of cells) {
      const ref = cell['@_r'] ?? ''
      const colIdx = colLetterToIndex(String(ref))
      const value = resolveCellValue(cell, sharedStrings)
      rowArr[colIdx] = value
      if (value !== '') hasValue = true
    }

    if (hasValue) {
      result.push(rowArr.slice(0, maxCol + 1))
    }
  }

  // Trim trailing empty columns from all rows
  const actualMaxCol = result.reduce((max, row) => {
    for (let i = row.length - 1; i >= 0; i--) {
      if (row[i] !== '') return Math.max(max, i)
    }
    return max
  }, 0)

  return result.map((row) => row.slice(0, actualMaxCol + 1))
}

/** Resolve a single cell's display value. */
function resolveCellValue(
  cell: {
    '@_t'?: string
    v?: string | number
    is?: { t?: string }
  },
  sharedStrings: string[],
): string {
  const type = cell['@_t']

  // Inline string
  if (type === 'inlineStr') {
    return String(cell.is?.t ?? '')
  }

  // Shared string index
  if (type === 's') {
    const idx = Number(cell.v)
    return Number.isFinite(idx) ? (sharedStrings[idx] ?? '') : ''
  }

  // Boolean
  if (type === 'b') {
    return cell.v === 1 || cell.v === '1' ? 'true' : 'false'
  }

  // Error or formula error
  if (type === 'e') {
    return ''
  }

  // Number / date / formula result
  if (cell.v != null) {
    return String(cell.v)
  }

  return ''
}

/**
 * Convert an Excel column reference like "A1", "BC42" → zero-based column index.
 * Strips the row number; handles multi-letter columns (A=0, Z=25, AA=26 …).
 *
 * Algorithm: treat letters as bijective base-26 (A=1 … Z=26), then subtract 1
 * at the end for zero-based indexing.  `charCode - 64` maps 'A'→1 … 'Z'→26,
 * which is correct for the bijective encoding (NOT `charCode - 65` which would
 * map 'A'→0 and break the final -1 adjustment).
 */
function colLetterToIndex(ref: string): number {
  const letters = ref.replace(/[^A-Za-z]/g, '').toUpperCase()
  let index = 0
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64)
  }
  return index - 1 // zero-based
}
