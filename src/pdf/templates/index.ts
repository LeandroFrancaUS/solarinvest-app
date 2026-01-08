/**
 * PDF Templates Registry
 * 
 * Central registry for all PDF templates with selection logic.
 */

import type { ReactElement } from 'react';
import { ContratoLeasingPdf } from './contratoLeasing';
import { AnexoIPdf } from './anexoI';
import { AnexoIIPdf } from './anexoII';
import type { ContratoData } from '../schemas/contrato.schema';

export type PdfTemplateId = 
  | 'contrato_leasing'
  | 'contrato_venda'
  | 'anexo_I'
  | 'anexo_II'
  | 'contrato_bundle';

export interface TemplateConfig {
  id: PdfTemplateId;
  name: string;
  component: (props: { data: ContratoData }) => ReactElement;
}

/**
 * Available PDF templates
 */
export const TEMPLATES: Record<PdfTemplateId, TemplateConfig> = {
  contrato_leasing: {
    id: 'contrato_leasing',
    name: 'Contrato de Leasing',
    component: ContratoLeasingPdf,
  },
  contrato_venda: {
    id: 'contrato_venda',
    name: 'Contrato de Venda',
    component: ContratoLeasingPdf, // Reusing leasing template for now
  },
  anexo_I: {
    id: 'anexo_I',
    name: 'Anexo I - Especificações Técnicas',
    component: AnexoIPdf,
  },
  anexo_II: {
    id: 'anexo_II',
    name: 'Anexo II - Condições Comerciais',
    component: AnexoIIPdf,
  },
  contrato_bundle: {
    id: 'contrato_bundle',
    name: 'Contrato Completo (com Anexos)',
    component: ContratoLeasingPdf, // Will be implemented later for consolidated PDF
  },
};

/**
 * Gets a template by ID
 */
export function getTemplate(id: PdfTemplateId): TemplateConfig {
  const template = TEMPLATES[id];
  if (!template) {
    throw new Error(`Template não encontrado: ${id}`);
  }
  return template;
}

/**
 * Selects the appropriate template based on contract data
 */
export function selectTemplate(data: ContratoData): TemplateConfig {
  // If incluirAnexos is true, use bundle
  if (data.incluirAnexos) {
    return getTemplate('contrato_bundle');
  }

  // Select based on contract type
  const tipoContrato = data.tipoContrato || 'leasing';
  
  if (tipoContrato === 'venda') {
    return getTemplate('contrato_venda');
  }
  
  return getTemplate('contrato_leasing');
}

/**
 * Lists all available templates
 */
export function listTemplates(): TemplateConfig[] {
  return Object.values(TEMPLATES);
}
