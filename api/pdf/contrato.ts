/**
 * API Route: /api/pdf/contrato
 * 
 * Serverless endpoint to generate PDF contracts using @react-pdf/renderer.
 * 
 * IMPORTANT: This endpoint MUST run on Node.js runtime (not Edge).
 * Configure in vercel.json if needed.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import React from 'react';
import { renderPdfToBuffer } from '../../src/pdf/render';
import { contratoSchema } from '../../src/pdf/schemas/contrato.schema';
import { selectTemplate } from '../../src/pdf/templates';
import '../../src/pdf/styles/fonts'; // Ensure fonts are registered

// Vercel serverless function configuration
export const config = {
  runtime: 'nodejs',
  maxDuration: 30, // Allow up to 30 seconds for PDF generation
};

/**
 * Handles PDF contract generation requests
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    return;
  }

  try {
    // Parse and validate request body
    const body = req.body;
    
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Corpo da requisição inválido.' });
      return;
    }

    // Validate with Zod schema
    const validationResult = contratoSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      res.status(400).json({ 
        error: 'Dados inválidos no contrato.',
        details: errors,
      });
      return;
    }

    const data = validationResult.data;

    // Select appropriate template
    const template = selectTemplate(data);
    
    // Generate PDF document component
    const Component = template.component;
    const document = React.createElement(Component, { data });

    // Render to buffer
    const pdfBuffer = await renderPdfToBuffer(document);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const clientName = (data.cliente.nomeCompleto || 'Cliente')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30);
    const filename = `Contrato_${clientName}_${timestamp}.pdf`;

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(pdfBuffer);

  } catch (error) {
    console.error('[pdf-api] Erro ao gerar PDF:', error);
    
    // Don't expose internal error details to client
    const message = error instanceof Error 
      ? error.message 
      : 'Erro ao gerar PDF do contrato.';
    
    res.status(500).json({ 
      error: 'Falha ao gerar contrato PDF.',
      message,
    });
  }
}
