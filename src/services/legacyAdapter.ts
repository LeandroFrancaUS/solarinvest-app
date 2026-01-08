/**
 * Legacy Data Adapter
 * 
 * Helpers to transform data from the old contract payload format
 * to the new @react-pdf/renderer schema format.
 */

import type { ContratoData } from '../pdf/schemas/contrato.schema';

/**
 * Legacy contract payload format (from old DOCX system)
 */
export interface LegacyContractPayload {
  // Client info
  nomeCompleto?: string;
  razaoSocial?: string;
  cpfCnpj?: string;
  cnpj?: string;
  rg?: string;
  estadoCivil?: string;
  nacionalidade?: string;
  profissao?: string;
  
  // Address - could be in various formats
  endereco?: string;
  enderecoCompleto?: string;
  enderecoCliente?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  
  // UC address (if different)
  enderecoUCGeradora?: string;
  localEntrega?: string;
  
  // Contact
  telefone?: string;
  email?: string;
  
  // UC and installation
  unidadeConsumidora?: string;
  
  // Technical specs
  potencia?: string | number;
  kWhContratado?: string | number;
  tarifaBase?: string | number;
  modulosFV?: string;
  inversoresFV?: string;
  
  // Contract terms
  prazoContratual?: string | number;
  dataInicio?: string;
  dataFim?: string;
  dataHomologacao?: string;
  anoContrato?: string | number;
  diaVencimento?: string | number;
  
  // Contractor info
  cnpjContratada?: string;
  enderecoContratada?: string;
  
  // Dates
  dataAtualExtenso?: string;
}

/**
 * Options for data transformation
 */
export interface TransformOptions {
  /**
   * Contract type (defaults to 'leasing')
   */
  tipoContrato?: 'leasing' | 'venda';
  
  /**
   * Whether to include annexes (defaults to false)
   */
  incluirAnexos?: boolean;
  
  /**
   * Fallback values for required fields
   */
  fallbacks?: {
    cidade?: string;
    uf?: string;
    endereco?: string;
  };
}

/**
 * Extracts address components from various formats
 */
function parseAddress(payload: LegacyContractPayload): {
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
} {
  // If components are already separate, use them
  if (payload.endereco && payload.cidade && payload.uf) {
    return {
      endereco: payload.endereco,
      cidade: payload.cidade,
      uf: payload.uf,
      cep: payload.cep || '',
    };
  }
  
  // Try to parse from enderecoCompleto or enderecoCliente
  const fullAddress = payload.enderecoCompleto || payload.enderecoCliente || '';
  
  // Pattern: "Rua X, Cidade/UF, CEP" or "Rua X, Cidade - UF, CEP"
  const pattern1 = /^(.+?),\s*([^/\-,]+)\s*[/\-]\s*([A-Z]{2}),?\s*(.*)$/;
  const match1 = fullAddress.match(pattern1);
  
  if (match1) {
    return {
      endereco: match1[1]?.trim() || '',
      cidade: match1[2]?.trim() || '',
      uf: match1[3]?.trim() || '',
      cep: match1[4]?.trim() || '',
    };
  }
  
  // Pattern: "Rua X, Cidade - UF" (without CEP)
  const pattern2 = /^(.+?),\s*([^/\-,]+)\s*[/\-]\s*([A-Z]{2})$/;
  const match2 = fullAddress.match(pattern2);
  
  if (match2) {
    return {
      endereco: match2[1]?.trim() || '',
      cidade: match2[2]?.trim() || '',
      uf: match2[3]?.trim() || '',
      cep: payload.cep || '',
    };
  }
  
  // Fallback: use whatever is available
  return {
    endereco: payload.endereco || fullAddress || '',
    cidade: payload.cidade || '',
    uf: payload.uf || '',
    cep: payload.cep || '',
  };
}

/**
 * Normalizes a value to string or undefined
 */
function normalizeString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

/**
 * Transforms legacy contract payload to new schema format
 */
export function transformLegacyPayload(
  legacy: LegacyContractPayload,
  options: TransformOptions = {}
): ContratoData {
  const { tipoContrato = 'leasing', incluirAnexos = false, fallbacks = {} } = options;
  
  // Parse address
  const address = parseAddress(legacy);
  
  // Apply fallbacks for required fields
  const endereco = address.endereco || fallbacks.endereco || 'Endereço não informado';
  const cidade = address.cidade || fallbacks.cidade || 'Cidade não informada';
  const uf = (address.uf || fallbacks.uf || 'XX').substring(0, 2).toUpperCase();
  const cep = address.cep || '';
  
  // Build contract data
  const contractData: ContratoData = {
    cliente: {
      nomeCompleto: normalizeString(legacy.nomeCompleto) || '',
      cpfCnpj: normalizeString(legacy.cpfCnpj) || '',
      endereco,
      cidade,
      uf,
      cep,
      
      // Optional fields
      razaoSocial: normalizeString(legacy.razaoSocial),
      representanteLegal: undefined, // Not in legacy
      cnpj: normalizeString(legacy.cnpj),
      rg: normalizeString(legacy.rg),
      estadoCivil: normalizeString(legacy.estadoCivil),
      nacionalidade: normalizeString(legacy.nacionalidade),
      profissao: normalizeString(legacy.profissao),
      telefone: normalizeString(legacy.telefone),
      email: normalizeString(legacy.email),
      enderecoUCGeradora: normalizeString(legacy.enderecoUCGeradora),
      localEntrega: normalizeString(legacy.localEntrega),
    },
    
    dadosTecnicos: {
      unidadeConsumidora: normalizeString(legacy.unidadeConsumidora),
      potencia: normalizeString(legacy.potencia),
      kWhContratado: normalizeString(legacy.kWhContratado),
      tarifaBase: normalizeString(legacy.tarifaBase),
      modulosFV: normalizeString(legacy.modulosFV),
      inversoresFV: normalizeString(legacy.inversoresFV),
    },
    
    dadosContratuais: {
      prazoContratual: normalizeString(legacy.prazoContratual),
      dataInicio: normalizeString(legacy.dataInicio),
      dataFim: normalizeString(legacy.dataFim),
      dataHomologacao: normalizeString(legacy.dataHomologacao),
      anoContrato: normalizeString(legacy.anoContrato),
      diaVencimento: normalizeString(legacy.diaVencimento),
    },
    
    contratada: {
      cnpjContratada: normalizeString(legacy.cnpjContratada),
      enderecoContratada: normalizeString(legacy.enderecoContratada),
    },
    
    tipoContrato,
    incluirAnexos,
  };
  
  return contractData;
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { transformLegacyPayload } from '@/services/legacyAdapter';
 * import { generateContractPdf } from '@/services/pdfClient';
 * 
 * // Old payload from existing code
 * const legacyPayload = {
 *   nomeCompleto: 'João Silva',
 *   cpfCnpj: '12345678901',
 *   enderecoCompleto: 'Rua Teste 123, São Paulo/SP, 01234-567',
 *   unidadeConsumidora: '123456789',
 * };
 * 
 * // Transform to new format
 * const contractData = transformLegacyPayload(legacyPayload, {
 *   tipoContrato: 'leasing',
 *   incluirAnexos: true,
 * });
 * 
 * // Generate PDF
 * const result = await generateContractPdf(contractData, {
 *   autoDownload: true,
 * });
 * ```
 */
