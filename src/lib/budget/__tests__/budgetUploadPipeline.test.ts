import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

import {
  handleUpload,
  __setPdfJsModuleLoader,
  BudgetUploadError,
  MAX_FILE_SIZE_BYTES,
} from '../budgetUploadPipeline'

const recognizeImageDataMock = vi.fn()

vi.mock('../../ocr/workerPool', () => ({
  recognizeImageData: (...args: unknown[]) => recognizeImageDataMock(...args),
}))

class TestFile extends Blob {
  public readonly name: string
  public readonly type: string
  public readonly lastModified: number

  constructor(chunks: BlobPart[], name: string, options?: FilePropertyBag) {
    super(chunks, options)
    this.name = name
    this.type = options?.type ?? ''
    this.lastModified = options?.lastModified ?? Date.now()
  }
}

class TestImageData {
  public readonly data: Uint8ClampedArray
  public readonly width: number
  public readonly height: number

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data
    this.width = width
    this.height = height
  }
}

beforeAll(() => {
  if (typeof (globalThis as { File?: unknown }).File === 'undefined') {
    ;(globalThis as { File: typeof TestFile }).File = TestFile
  }
  if (typeof (globalThis as { ImageData?: unknown }).ImageData === 'undefined') {
    ;(globalThis as { ImageData: typeof TestImageData }).ImageData = TestImageData as unknown as typeof ImageData
  }
})

beforeEach(() => {
  recognizeImageDataMock.mockReset()
  __setPdfJsModuleLoader(null)
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: 10,
    height: 10,
    close: vi.fn(),
  })))

  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => new ImageData(new Uint8ClampedArray(400), 10, 10)),
  }

  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      width: 10,
      height: 10,
      getContext: vi.fn(() => context),
    })),
  })

  const url = globalThis.URL || ({} as URL)
  if (!('createObjectURL' in url)) {
    ;(url as unknown as { createObjectURL: (input: unknown) => string }).createObjectURL = () => 'mock-url'
  }
  if (!('revokeObjectURL' in url)) {
    ;(url as unknown as { revokeObjectURL: (input: string) => void }).revokeObjectURL = () => {}
  }
  vi.stubGlobal('URL', url)
})

afterEach(() => {
  __setPdfJsModuleLoader(null)
  vi.unstubAllGlobals()
})

describe('budgetUploadPipeline.handleUpload', () => {
  it('processes PNG images via OCR and returns normalized items', async () => {
    recognizeImageDataMock.mockResolvedValue({
      data: {
        text: 'Painel Solar 550W\nCódigo: ABC123\nQuantidade: 2\nValor total: R$ 2.000,00',
      },
    })

    const file = new File([new Uint8Array([1, 2, 3])], 'orcamento.png', { type: 'image/png' })
    const result = await handleUpload(file, { dpi: 300 })

    expect(recognizeImageDataMock).toHaveBeenCalledTimes(1)
    expect(result.usedOcr).toBe(true)
    expect(result.json.itens).toHaveLength(1)
    expect(result.json.itens[0].produto).toBe('Painel Solar 550W')
    expect(result.json.itens[0].quantidade).toBe(2)
    expect(result.json.resumo.valorTotal).toBe(2000)
  })

  it('uses the quick PDF path when text density is high', async () => {
    __setPdfJsModuleLoader(async () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({
              items: [
                { str: 'Painel Solar 550W' },
                { str: 'Quantidade: 3' },
                { str: 'Valor total: R$ 3.000,00' },
              ],
            }),
            getViewport: () => ({ width: 400, height: 400 }),
            render: vi.fn(),
            cleanup: vi.fn(),
          }),
        }),
      }),
      GlobalWorkerOptions: {},
    }))

    recognizeImageDataMock.mockResolvedValue({ data: { text: '' } })

    const file = new File([new Uint8Array([4, 5, 6])], 'orcamento.pdf', { type: 'application/pdf' })
    const progressSpy = vi.fn()
    const result = await handleUpload(file, { dpi: 300, onProgress: progressSpy })

    expect(recognizeImageDataMock).not.toHaveBeenCalled()
    expect(result.usedOcr).toBe(false)
    expect(result.json.itens[0].quantidade).toBe(3)
    expect(progressSpy).toHaveBeenCalled()
  })

  it('falls back to OCR when PDF text density is low', async () => {
    __setPdfJsModuleLoader(async () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({ items: [] }),
            getViewport: () => ({ width: 400, height: 400 }),
            render: () => ({ promise: Promise.resolve() }),
            cleanup: vi.fn(),
          }),
        }),
      }),
      GlobalWorkerOptions: {},
    }))

    recognizeImageDataMock.mockResolvedValue({
      data: { text: 'Inversor Solar Premium\nQuantidade: 1\nValor total: R$ 5.000,00' },
    })

    const file = new File([new Uint8Array([7, 8, 9])], 'orcamento.pdf', { type: 'application/pdf' })
    const result = await handleUpload(file, { dpi: 300 })

    expect(recognizeImageDataMock).toHaveBeenCalledTimes(1)
    expect(result.usedOcr).toBe(true)
    expect(result.json.itens[0].produto).toBe('Inversor Solar Premium')
    expect(result.json.resumo.valorTotal).toBe(5000)
  })

  it('throws a controlled error for unsupported formats', async () => {
    const file = new File([new Uint8Array([0])], 'orcamento.txt', { type: 'text/plain' })
    const promise = handleUpload(file)
    await expect(promise).rejects.toBeInstanceOf(BudgetUploadError)
    await expect(promise).rejects.toMatchObject({ code: 'unsupported-format' })
  })

  it('throws when the file exceeds the size limit', async () => {
    const file = new File([new Uint8Array([1])], 'orcamento.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE_BYTES + 1 })
    const promise = handleUpload(file)
    await expect(promise).rejects.toMatchObject({ code: 'file-too-large' })
  })
})
