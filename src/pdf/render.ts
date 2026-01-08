/**
 * PDF Rendering Utility
 * 
 * This module provides the core functionality to render React PDF documents
 * to Buffer format for serverless environments (Node.js runtime).
 * 
 * IMPORTANT: This code is designed to run ONLY in Node.js backend/serverless
 * functions, NOT in browser or Edge runtime.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

/**
 * Renders a React PDF Document to a Buffer.
 * 
 * @param doc - React element representing the PDF document
 * @returns Promise<Buffer> - PDF content as a Buffer
 * @throws Error if rendering fails
 */
export async function renderPdfToBuffer(doc: ReactElement): Promise<Buffer> {
  try {
    const buffer = await renderToBuffer(doc);
    return buffer;
  } catch (error) {
    console.error('[pdf-render] Failed to render PDF:', error);
    throw new Error('Falha ao gerar PDF. Verifique os logs do servidor.');
  }
}
