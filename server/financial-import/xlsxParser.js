// server/financial-import/xlsxParser.js
// Lightweight XLSX → JSON parser using jszip (no additional dependencies).
//
// XLSX files are ZIP archives containing XML files:
//   xl/workbook.xml          – sheet registry and names
//   xl/sharedStrings.xml     – shared string table (text cell values)
//   xl/worksheets/sheet*.xml – per-sheet row/cell data
//
// Returns: { sheets: Array<{ name: string, rows: string[][] }> }

import JSZip from 'jszip'

/**
 * Parse a raw XLSX Buffer into an array of sheets.
 * Each sheet has a name and a 2-D array of trimmed string values.
 *
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 * @returns {Promise<{ sheets: Array<{ name: string, rows: string[][] }> }>}
 */
export async function parseXlsx(buffer) {
  let zip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new Error('Arquivo XLSX inválido ou corrompido.')
  }

  // ── 1. Read workbook.xml ──────────────────────────────────────────────────
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string')
  if (!workbookXml) throw new Error('XLSX inválido: xl/workbook.xml não encontrado.')

  const sheetDefs = parseWorkbookSheets(workbookXml)
  if (sheetDefs.length === 0) return { sheets: [] }

  // ── 2. Read shared strings ────────────────────────────────────────────────
  const ssXml = await zip.file('xl/sharedStrings.xml')?.async('string')
  const sharedStrings = ssXml ? parseSharedStrings(ssXml) : []

  // ── 3. Try to resolve rId → sheet file path via workbook.xml.rels ─────────
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  const rIdToPath = relsXml ? parseWorkbookRels(relsXml) : {}

  // ── 4. Parse each worksheet ───────────────────────────────────────────────
  const sheets = []
  for (const sheetDef of sheetDefs) {
    // Resolve file path: first try relationships file, then fall back to index.
    let sheetPath = rIdToPath[sheetDef.rId]
      ? `xl/${rIdToPath[sheetDef.rId]}`
      : null

    // Normalise path (remove leading xl/ if already included)
    if (sheetPath && sheetPath.startsWith('xl/xl/')) {
      sheetPath = sheetPath.slice(3)
    }

    const sheetFile =
      (sheetPath && zip.file(sheetPath)) ??
      zip.file(`xl/worksheets/sheet${sheetDef.index}.xml`) ??
      zip.file(`xl/worksheets/Sheet${sheetDef.index}.xml`)

    if (!sheetFile) continue

    const sheetXml = await sheetFile.async('string')
    const rows = parseWorksheet(sheetXml, sharedStrings)
    sheets.push({ name: sheetDef.name, rows })
  }

  return { sheets }
}

// ── XML helpers ──────────────────────────────────────────────────────────────

/** Extract ordered sheet definitions from workbook.xml. */
function parseWorkbookSheets(xml) {
  const sheets = []
  // <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  const re = /<sheet\b[^>]+name="([^"]*)"[^>]+sheetId="(\d+)"[^>]+r:id="([^"]+)"[^>]*/gi
  let m
  let index = 1
  while ((m = re.exec(xml)) !== null) {
    sheets.push({ name: decodeXmlEntities(m[1]), sheetId: m[2], rId: m[3], index })
    index++
  }
  // Fallback: without r:id
  if (sheets.length === 0) {
    const re2 = /<sheet\b[^>]+name="([^"]*)"[^>]+sheetId="(\d+)"[^>]*/gi
    let m2
    while ((m2 = re2.exec(xml)) !== null) {
      sheets.push({ name: decodeXmlEntities(m2[1]), sheetId: m2[2], rId: null, index: parseInt(m2[2], 10) })
    }
  }
  return sheets
}

/** Map rId to relative path from xl/_rels/workbook.xml.rels */
function parseWorkbookRels(xml) {
  const map = {}
  const re = /<Relationship\b[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"[^>]*/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    map[m[1]] = m[2]
  }
  return map
}

/** Parse xl/sharedStrings.xml into an ordered array of strings. */
function parseSharedStrings(xml) {
  const strings = []
  const siRe = /<si>([\s\S]*?)<\/si>/gi
  const tRe = /<t(?:\s[^>]*)?>([^<]*)<\/t>/gi
  let m
  while ((m = siRe.exec(xml)) !== null) {
    const siContent = m[1]
    let text = ''
    let t
    tRe.lastIndex = 0
    while ((t = tRe.exec(siContent)) !== null) {
      text += decodeXmlEntities(t[1])
    }
    strings.push(text)
  }
  return strings
}

/**
 * Parse a worksheet XML into a dense 2D string array.
 * Empty trailing columns/rows are trimmed.
 */
function parseWorksheet(xml, sharedStrings) {
  // Collect all cell values keyed by (row, col) (both 1-based)
  const cells = new Map()

  // Match <c r="A1" t="s" ...><v>0</v></c> and variants
  // Using a simple approach: scan for <c ...>...</c> blocks
  const rowRe = /<row\b[^>]+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/gi
  let rowMatch
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowNum = parseInt(rowMatch[1], 10)
    const rowContent = rowMatch[2]
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi
    let cellMatch
    while ((cellMatch = cellRe.exec(rowContent)) !== null) {
      const attrs = cellMatch[1]
      const inner = cellMatch[2]

      // Extract r (cell reference e.g. "A1")
      const rMatch = /\br="([A-Z]+\d+)"/.exec(attrs)
      if (!rMatch) continue
      const cellRef = rMatch[1]
      const col = colLettersToIndex(cellRef.match(/^([A-Z]+)/)[1])

      // Extract type
      const tMatch = /\bt="([^"]*)"/.exec(attrs)
      const type = tMatch ? tMatch[1] : ''

      // Extract value
      const vMatch = /<v>([^<]*)<\/v>/.exec(inner)
      const raw = vMatch ? decodeXmlEntities(vMatch[1]) : ''

      // Also check for inline string <is><t>...</t></is>
      const isMatch = /<is>[\s\S]*?<t(?:\s[^>]*)?>([^<]*)<\/t>[\s\S]*?<\/is>/.exec(inner)

      let value = ''
      if (type === 's') {
        const idx = parseInt(raw, 10)
        value = Number.isNaN(idx) ? '' : (sharedStrings[idx] ?? '')
      } else if (type === 'b') {
        value = raw === '1' ? 'TRUE' : 'FALSE'
      } else if (type === 'e') {
        value = ''
      } else if (type === 'inlineStr' || isMatch) {
        value = isMatch ? decodeXmlEntities(isMatch[1]) : raw
      } else {
        value = raw
      }

      cells.set(`${rowNum}:${col}`, value.trim())
    }
  }

  if (cells.size === 0) return []

  // Find max row and col
  let maxRow = 0
  let maxCol = 0
  for (const key of cells.keys()) {
    const sep = key.indexOf(':')
    const r = parseInt(key.slice(0, sep), 10)
    const c = parseInt(key.slice(sep + 1), 10)
    if (r > maxRow) maxRow = r
    if (c > maxCol) maxCol = c
  }

  // Build 2-D array (sparse → dense)
  const rows = []
  for (let r = 1; r <= maxRow; r++) {
    const row = []
    for (let c = 0; c <= maxCol; c++) {
      row.push(cells.get(`${r}:${c}`) ?? '')
    }
    rows.push(row)
  }

  // Trim completely-empty trailing rows
  while (rows.length > 0 && rows[rows.length - 1].every((v) => v === '')) {
    rows.pop()
  }

  return rows
}

/** Convert column letters (A→0, B→1, …, Z→25, AA→26, …) to 0-based index. */
function colLettersToIndex(letters) {
  let result = 0
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64)
  }
  return result - 1
}

function decodeXmlEntities(str) {
  // Process all entities in a single pass to avoid double-unescaping.
  // e.g. &amp;lt; → &lt; → < would be wrong; single-pass prevents this.
  return str.replace(/&(?:amp|lt|gt|quot|apos|#(\d+));/g, (match, dec) => {
    if (dec !== undefined) return String.fromCharCode(parseInt(dec, 10))
    if (match === '&amp;') return '&'
    if (match === '&lt;')  return '<'
    if (match === '&gt;')  return '>'
    if (match === '&quot;') return '"'
    if (match === '&apos;') return "'"
    return match
  })
}
