/**
 * Contract Data Schema
 * 
 * Zod schemas for validating contract payload data before PDF generation.
 */

import { z } from 'zod';

/**
 * Schema for contract client/customer data
 */
export const clienteSchema = z.object({
  // Required fields
  nomeCompleto: z.string().min(1, 'Nome completo é obrigatório'),
  cpfCnpj: z.string().min(1, 'CPF/CNPJ é obrigatório'),
  endereco: z.string().min(1, 'Endereço é obrigatório'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  uf: z.string().length(2, 'UF deve ter 2 caracteres'),
  cep: z.string().min(1, 'CEP é obrigatório'),

  // Optional personal info
  razaoSocial: z.string().optional(),
  representanteLegal: z.string().optional(),
  cnpj: z.string().optional(),
  rg: z.string().optional(),
  estadoCivil: z.string().optional(),
  nacionalidade: z.string().optional(),
  profissao: z.string().optional(),

  // Optional contact
  telefone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),

  // Optional additional addresses
  enderecoCompleto: z.string().optional(),
  enderecoUCGeradora: z.string().optional(),
  localEntrega: z.string().optional(),
});

/**
 * Schema for contract technical data
 */
export const dadosTecnicosSchema = z.object({
  // Installation/UC data
  unidadeConsumidora: z.string().optional(),
  potencia: z.string().optional(),
  kWhContratado: z.string().optional(),
  tarifaBase: z.string().optional(),
  modulosFV: z.string().optional(),
  inversoresFV: z.string().optional(),
});

/**
 * Schema for contract dates and terms
 */
export const dadosContratuaisSchema = z.object({
  prazoContratual: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  dataHomologacao: z.string().optional(),
  anoContrato: z.string().optional(),
  diaVencimento: z.string().optional(),
});

/**
 * Schema for contractor (SolarInvest) data
 */
export const contratadaSchema = z.object({
  cnpjContratada: z.string().optional(),
  enderecoContratada: z.string().optional(),
});

/**
 * Main contract schema combining all sections
 */
export const contratoSchema = z.object({
  cliente: clienteSchema,
  dadosTecnicos: dadosTecnicosSchema.optional(),
  dadosContratuais: dadosContratuaisSchema.optional(),
  contratada: contratadaSchema.optional(),
  template: z.string().optional(),
  tipoContrato: z.enum(['leasing', 'venda']).optional(),
  incluirAnexos: z.boolean().optional(),
});

export type ClienteData = z.infer<typeof clienteSchema>;
export type DadosTecnicosData = z.infer<typeof dadosTecnicosSchema>;
export type DadosContratuaisData = z.infer<typeof dadosContratuaisSchema>;
export type ContratadaData = z.infer<typeof contratadaSchema>;
export type ContratoData = z.infer<typeof contratoSchema>;
