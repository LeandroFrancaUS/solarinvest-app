/**
 * PDF Render Utilities
 * Functions to render React PDF documents to Buffer or Stream
 */

import { renderToBuffer, renderToStream } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

/**
 * Render a PDF document to Buffer (for server-side generation)
 * @param document - React PDF Document element
 * @returns Promise<Buffer> - PDF as Buffer
 */
export async function renderPdfToBuffer(document: ReactElement): Promise<Buffer> {
  try {
    const buffer = await renderToBuffer(document)
    return buffer
  } catch (error) {
    console.error('Error rendering PDF to buffer:', error)
    throw new Error(`Failed to render PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Render a PDF document to Stream (for client-side download)
 * @param document - React PDF Document element
 * @returns Promise<NodeJS.ReadableStream> - PDF as stream
 */
export async function renderPdfToStream(document: ReactElement) {
  try {
    const stream = await renderToStream(document)
    return stream
  } catch (error) {
    console.error('Error rendering PDF to stream:', error)
    throw new Error(`Failed to render PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Render a PDF document to Blob (for browser download)
 * @param document - React PDF Document element
 * @returns Promise<Blob> - PDF as Blob
 */
export async function renderPdfToBlob(document: ReactElement): Promise<Blob> {
  try {
    const buffer = await renderToBuffer(document)
    // Convert Buffer to Uint8Array for Blob constructor
    const uint8Array = new Uint8Array(buffer)
    return new Blob([uint8Array], { type: 'application/pdf' })
  } catch (error) {
    console.error('Error rendering PDF to blob:', error)
    throw new Error(`Failed to render PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Trigger browser download of PDF
 * @param blob - PDF Blob
 * @param filename - Desired filename
 */
export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
