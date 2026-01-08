/**
 * PDF Generation Client
 * 
 * Client-side utility to generate PDFs using the @react-pdf/renderer API.
 * This replaces the old DOCX->PDF conversion flow.
 */

import type { ContratoData } from '../pdf/schemas/contrato.schema';

export interface PdfGenerationOptions {
  /**
   * Custom API base URL (defaults to current origin)
   */
  apiBaseUrl?: string;

  /**
   * Whether to download the PDF automatically
   */
  autoDownload?: boolean;

  /**
   * Custom filename for download (without .pdf extension)
   */
  filename?: string;
}

export interface PdfGenerationResult {
  /**
   * The PDF as a Blob
   */
  blob: Blob;

  /**
   * Suggested filename from server
   */
  filename: string;

  /**
   * Size in bytes
   */
  size: number;
}

/**
 * Generates a PDF contract by calling the backend API
 */
export async function generateContractPdf(
  data: ContratoData,
  options: PdfGenerationOptions = {}
): Promise<PdfGenerationResult> {
  const { apiBaseUrl = '', autoDownload = false, filename } = options;

  // Build API URL
  const apiUrl = `${apiBaseUrl}/api/pdf/contrato`;

  // Make request
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = 'Erro ao gerar PDF do contrato';
    
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
        
        // Include validation details if present
        if (errorData.details && Array.isArray(errorData.details)) {
          const fieldErrors = errorData.details
            .map((d: { field: string; message: string }) => `${d.field}: ${d.message}`)
            .join('; ');
          errorMessage += ` (${fieldErrors})`;
        }
      }
    } catch {
      // Failed to parse error JSON, use default message
    }

    throw new Error(errorMessage);
  }

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition');
  let suggestedFilename = filename || 'Contrato_SolarInvest';
  
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) {
      suggestedFilename = match[1].replace(/\.pdf$/i, '');
    }
  }

  // Get PDF blob
  const blob = await response.blob();

  // Auto-download if requested
  if (autoDownload) {
    downloadBlob(blob, `${suggestedFilename}.pdf`);
  }

  return {
    blob,
    filename: suggestedFilename,
    size: blob.size,
  };
}

/**
 * Downloads a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a PDF blob in a new window/tab
 */
export function openPdfInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  
  // Clean up after a delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Example usage in a React component:
 * 
 * ```tsx
 * import { generateContractPdf } from '@/services/pdfClient';
 * 
 * const handleGeneratePdf = async () => {
 *   try {
 *     const contractData = {
 *       cliente: {
 *         nomeCompleto: 'João Silva',
 *         cpfCnpj: '12345678901',
 *         endereco: 'Rua Teste, 123',
 *         cidade: 'São Paulo',
 *         uf: 'SP',
 *         cep: '01234-567',
 *       },
 *       tipoContrato: 'leasing',
 *       incluirAnexos: true,
 *     };
 * 
 *     const result = await generateContractPdf(contractData, {
 *       autoDownload: true,
 *     });
 * 
 *     console.log(`PDF gerado com sucesso: ${result.filename} (${result.size} bytes)`);
 *   } catch (error) {
 *     console.error('Erro ao gerar PDF:', error);
 *     alert(error.message);
 *   }
 * };
 * ```
 */
