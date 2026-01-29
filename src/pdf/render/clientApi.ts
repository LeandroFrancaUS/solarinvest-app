/**
 * PDF Generation API - Client-side example
 * Functions to generate and download PDF proposals in the browser
 */

import React from 'react'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { adaptPrintablePropsToLeasing } from '../types'
import { LeasingProposalSimple } from '../documents/LeasingProposalSimple'
import { renderPdfToBlob, downloadPdf } from './renderPdf'

/**
 * Generate and download Leasing Proposal (Simple version) in browser
 * @param props - Printable proposal data (existing format)
 * @param filename - Optional custom filename
 */
export async function generateLeasingProposalSimple(
  props: PrintableProposalProps,
  filename?: string
): Promise<void> {
  try {
    // Adapt existing data format to PDF format
    const data = adaptPrintablePropsToLeasing(props)
    
    // Create PDF document
    const document = React.createElement(LeasingProposalSimple, { data })
    
    // Render to blob
    const blob = await renderPdfToBlob(document)
    
    // Download
    const finalFilename = filename || `Proposta-Leasing-${data.budgetId || 'SolarInvest'}.pdf`
    downloadPdf(blob, finalFilename)
  } catch (error) {
    console.error('Error generating leasing proposal:', error)
    throw error
  }
}

/**
 * Generate leasing proposal blob without downloading (for preview or server upload)
 * @param props - Printable proposal data
 * @returns Promise<Blob> - PDF blob
 */
export async function generateLeasingProposalBlob(
  props: PrintableProposalProps
): Promise<Blob> {
  const data = adaptPrintablePropsToLeasing(props)
  const document = React.createElement(LeasingProposalSimple, { data })
  return await renderPdfToBlob(document)
}
