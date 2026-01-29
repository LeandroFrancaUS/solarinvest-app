/**
 * PDF Types - Adapter for existing data structures
 * Maps current proposal data to PDF-friendly types
 */

import type { PrintableProposalProps, ClienteDados, MensalidadeRow } from '../types/printableProposal'

// Re-export types that don't need adaptation
export type { ClienteDados, MensalidadeRow } from '../types/printableProposal'

/**
 * Leasing Proposal Data
 * Adapted from PrintableProposalProps for @react-pdf/renderer
 */
export type LeasingProposalData = {
  // Client Information
  cliente: ClienteDados
  budgetId?: string
  
  // System Specifications
  potenciaInstaladaKwp: number
  geracaoMensalKwh: number
  numeroModulos: number
  potenciaModulo: number
  modeloModulo?: string | null
  modeloInversor?: string | null
  areaInstalacao: number
  tipoInstalacao: string
  tipoEdificacao: string
  
  // Location & Utility
  distribuidora: string
  ucGeradora?: {
    numero: string
    endereco: string
    titular?: {
      nomeCompleto: string
      cpf: string
    } | undefined
  } | undefined
  ucsBeneficiarias?: Array<{
    numero: string
    endereco: string
    rateioPercentual?: number | undefined
  }> | undefined
  
  // Financial Terms
  prazoContratualMeses: number
  valorInstalacaoCliente: number
  descontoContratualPct: number
  energiaContratadaKwh: number
  tarifaCheiaBase: number
  inflacaoEnergiaAa: number
  
  // Pricing Timeline
  mensalidadesPorAno: Array<{
    ano: number
    tarifaCheiaAno: number
    tarifaComDesconto: number
    mensalidadeSolarInvest: number
    mensalidadeDistribuidora: number
    encargosDistribuidora: number
    despesaMensalEstimada: number
  }>
  
  // System Value
  valorMercadoEstimado?: number | null
  mostrarValorMercado?: boolean
  
  // Additional Info
  dataInicioOperacao?: string | null
  observacoes?: string | null
  multiUcResumo?: any | null
  
  // Validation
  validadeDias?: number
}

/**
 * Adapter function: Convert PrintableProposalProps to LeasingProposalData
 */
export function adaptPrintablePropsToLeasing(props: PrintableProposalProps): LeasingProposalData {
  const tipoInstalacao = props.tipoInstalacaoCompleto || 
    props.tipoInstalacaoLabel || 
    props.tipoInstalacao || 
    'Instalação fotovoltaica'
  
  const tipoEdificacao = props.tipoEdificacaoCompleto ||
    props.tipoEdificacaoLabel ||
    props.segmentoCliente ||
    'Edificação residencial'
  
  const modeloModulo = props.leasingModeloModulo || 
    props.vendaSnapshot?.configuracao?.modelo_modulo ||
    null
  
  const modeloInversor = props.leasingModeloInversor ||
    props.vendaSnapshot?.configuracao?.modelo_inversor ||
    null
  
  // Build mensalidadesPorAno from parcelasLeasing
  const prazoAnos = Math.ceil((props.leasingPrazoContratualMeses || 60) / 12)
  const mensalidadesPorAno: LeasingProposalData['mensalidadesPorAno'] = []
  
  for (let ano = 1; ano <= prazoAnos; ano++) {
    const fator = Math.pow(1 + (props.leasingInflacaoEnergiaAa || 0), ano - 1)
    const tarifaAno = props.tarifaCheia * fator
    const tarifaComDesconto = tarifaAno * (1 - (props.descontoContratualPct || 0))
    const mensalidadeSolarInvest = props.energiaContratadaKwh * tarifaComDesconto
    const mensalidadeDistribuidora = props.energiaContratadaKwh * tarifaAno
    
    mensalidadesPorAno.push({
      ano,
      tarifaCheiaAno: tarifaAno,
      tarifaComDesconto,
      mensalidadeSolarInvest,
      mensalidadeDistribuidora,
      encargosDistribuidora: 0, // Simplified for now
      despesaMensalEstimada: mensalidadeSolarInvest,
    })
  }
  
  return {
    cliente: props.cliente,
    budgetId: props.budgetId,
    
    potenciaInstaladaKwp: props.potenciaInstaladaKwp,
    geracaoMensalKwh: props.geracaoMensalKwh,
    numeroModulos: props.numeroModulos,
    potenciaModulo: props.potenciaModulo,
    modeloModulo,
    modeloInversor,
    areaInstalacao: props.areaInstalacao,
    tipoInstalacao,
    tipoEdificacao,
    
    distribuidora: props.distribuidoraTarifa || props.cliente.distribuidora,
    ucGeradora: props.ucGeradora ? {
      numero: props.ucGeradora.numero,
      endereco: props.ucGeradora.endereco,
      titular: props.ucGeradoraTitular ? {
        nomeCompleto: props.ucGeradoraTitular.nomeCompleto,
        cpf: props.ucGeradoraTitular.cpf,
      } : undefined,
    } : undefined,
    ucsBeneficiarias: props.ucsBeneficiarias?.map(uc => ({
      numero: uc.numero,
      endereco: uc.endereco,
      rateioPercentual: uc.rateioPercentual || undefined,
    })),
    
    prazoContratualMeses: props.leasingPrazoContratualMeses || 60,
    valorInstalacaoCliente: props.leasingValorInstalacaoCliente || 0,
    descontoContratualPct: props.descontoContratualPct,
    energiaContratadaKwh: props.energiaContratadaKwh,
    tarifaCheiaBase: props.tarifaCheia,
    inflacaoEnergiaAa: props.leasingInflacaoEnergiaAa || 0,
    
    mensalidadesPorAno,
    
    valorMercadoEstimado: props.leasingValorDeMercadoEstimado,
    mostrarValorMercado: props.mostrarValorMercadoLeasing || false,
    
    dataInicioOperacao: props.leasingDataInicioOperacao,
    observacoes: props.configuracaoUsinaObservacoes,
    multiUcResumo: props.multiUcResumo,
    
    validadeDias: props.vendasConfigSnapshot?.validade_proposta_dias,
  }
}
