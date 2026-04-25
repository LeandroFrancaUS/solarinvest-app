export type CrmStageId =
  | 'novo-lead'
  | 'qualificacao'
  | 'proposta-enviada'
  | 'negociacao'
  | 'aguardando-contrato'
  | 'fechado'

export type CrmPipelineStage = {
  id: CrmStageId
  label: string
}

export type CrmTimelineEntryType = 'status' | 'anotacao'

export type CrmTimelineEntry = {
  id: string
  leadId: string
  mensagem: string
  tipo: CrmTimelineEntryType
  criadoEmIso: string
}

export type CrmLeadRecord = {
  id: string
  nome: string
  telefone: string
  email?: string | undefined
  cidade: string
  tipoImovel: string
  consumoKwhMes: number
  origemLead: string
  interesse: string
  tipoOperacao: 'LEASING' | 'VENDA_DIRETA'
  valorEstimado: number
  etapa: CrmStageId
  ultimoContatoIso: string
  criadoEmIso: string
  notas?: string | undefined
  instalacaoStatus: 'planejamento' | 'em-andamento' | 'concluida' | 'aguardando-homologacao'
}

export type CrmFinanceiroStatus = 'em-aberto' | 'ativo' | 'inadimplente' | 'quitado'

export type CrmContratoFinanceiro = {
  id: string
  leadId: string
  modelo: 'LEASING' | 'VENDA_DIRETA'
  valorTotal: number
  entrada: number
  parcelas: number
  valorParcela: number
  reajusteAnualPct: number
  vencimentoInicialIso: string
  status: CrmFinanceiroStatus
}

export type CrmCustoProjeto = {
  id: string
  leadId: string
  equipamentos: number
  maoDeObra: number
  deslocamento: number
  taxasSeguros: number
}

export type CrmManutencaoRegistro = {
  id: string
  leadId: string
  dataIso: string
  tipo: string
  status: 'pendente' | 'concluida'
  observacao?: string | undefined
}

export type CrmDataset = {
  leads: CrmLeadRecord[]
  timeline: CrmTimelineEntry[]
  contratos: CrmContratoFinanceiro[]
  custos: CrmCustoProjeto[]
  manutencoes: CrmManutencaoRegistro[]
}

export type CrmLeadFormState = {
  nome: string
  telefone: string
  email: string
  cidade: string
  tipoImovel: string
  consumoKwhMes: string
  origemLead: string
  interesse: string
  tipoOperacao: 'LEASING' | 'VENDA_DIRETA'
  valorEstimado: string
  notas: string
}

export type CrmIntegrationMode = 'local' | 'remote'
export type CrmBackendStatus = 'idle' | 'success' | 'error'
export type CrmFiltroOperacao = 'all' | 'LEASING' | 'VENDA_DIRETA'
