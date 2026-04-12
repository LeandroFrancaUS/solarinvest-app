import { describe, it, expect, vi, afterEach } from 'vitest'
import JSZip from 'jszip'
import { parseBackupFileToPayload } from './backupImportEngine'

afterEach(() => {
  vi.restoreAllMocks()
})

async function createMinimalXlsxFile(name = 'clientes.xlsx'): Promise<File> {
  const zip = new JSZip()
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8"?>
<sst><si><t>nome</t></si><si><t>documento</t></si><si><t>Maria Silva</t></si><si><t>12345678901</t></si></sst>`)
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
  <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
</sheetData></worksheet>`)
  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  return {
    name,
    type: blob.type,
    arrayBuffer: async () => buffer,
    slice: (start?: number, end?: number) => blob.slice(start, end),
  } as unknown as File
}

describe('parseBackupFileToPayload', () => {
  it('does not attempt JSON.parse for xlsx files', async () => {
    const file = await createMinimalXlsxFile()
    const parseSpy = vi.spyOn(JSON, 'parse')

    const result = await parseBackupFileToPayload(file)

    expect(parseSpy).not.toHaveBeenCalled()
    expect(result.preview.sourceFormat).toBe('xlsx')
    expect(result.payload.data.clients.length).toBeGreaterThan(0)
  })
})
