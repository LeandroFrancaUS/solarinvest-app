import type React from 'react'

export type CrmAdicionarNotificacaoFn = (
  mensagem: string,
  tipo?: 'success' | 'info' | 'error',
) => void

export type UseCrmDeps = {
  adicionarNotificacao: CrmAdicionarNotificacaoFn
}

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

export type CrmCustosFormState = {
  equipamentos: string
  maoDeObra: string
  deslocamento: string
  taxasSeguros: string
}

export type CrmContratoFormState = {
  leadId: string
  modelo: 'LEASING' | 'VENDA_DIRETA'
  valorTotal: string
  entrada: string
  parcelas: string
  valorParcela: string
  reajusteAnualPct: string
  vencimentoInicialIso: string
  status: CrmFinanceiroStatus
}

export type CrmManutencaoFormState = {
  leadId: string
  dataIso: string
  tipo: string
  observacao: string
}

export type CrmMargemItem = {
  leadId: string
  leadNome: string
  margemBruta: number
  margemPct: number | null
  custoTotal: number
  receitaProjetada: number
  roi: number | null
  modelo: 'LEASING' | 'VENDA_DIRETA'
}

export type CrmKpisData = {
  totalLeads: number
  leadsFechados: number
  receitaRecorrente: number
  receitaPontual: number
  leadsEmRisco: number
}

export type CrmFinanceiroResumoData = {
  previsaoLeasing: number
  previsaoVendas: number
  inadimplentes: number
  contratosAtivos: number
  margens: CrmMargemItem[]
}

export type CrmGeracaoItem = {
  id: string
  nome: string
  geracaoPrevista: number
  geracaoAtual: number
  alertaBaixa: boolean
  cidade: string
}

export type CrmPosVendaResumoData = {
  totalManutencoes: number
  pendentes: number
  concluidas: number
  proximas: CrmManutencaoRegistro[]
  geracao: CrmGeracaoItem[]
  alertasCriticos: string[]
  chamadosRecentes: Array<CrmTimelineEntry & { dataFormatada: string }>
}

export type CrmIndicadoresGerenciaisData = {
  taxaConversao: number
  tempoMedioFechamento: number
  leadsPorOrigem: Record<string, number>
  gargalos: string[]
  roiMedio: number
  receitaRecorrenteProjetada: number
  receitaPontualProjetada: number
  mapaGeracao: Record<string, number>
}

export type UseCrmState = {
  crmIntegrationMode: CrmIntegrationMode
  setCrmIntegrationMode: React.Dispatch<React.SetStateAction<CrmIntegrationMode>>
  crmIsSaving: boolean
  setCrmIsSaving: React.Dispatch<React.SetStateAction<boolean>>
  crmBackendStatus: CrmBackendStatus
  setCrmBackendStatus: React.Dispatch<React.SetStateAction<CrmBackendStatus>>
  crmBackendError: string | null
  setCrmBackendError: React.Dispatch<React.SetStateAction<string | null>>
  crmLastSync: Date | null
  setCrmLastSync: React.Dispatch<React.SetStateAction<Date | null>>
  crmBusca: string
  setCrmBusca: React.Dispatch<React.SetStateAction<string>>
  crmFiltroOperacao: CrmFiltroOperacao
  setCrmFiltroOperacao: React.Dispatch<React.SetStateAction<CrmFiltroOperacao>>
  crmLeadSelecionadoId: string | null
  setCrmLeadSelecionadoId: React.Dispatch<React.SetStateAction<string | null>>
  crmLeadForm: CrmLeadFormState
  setCrmLeadForm: React.Dispatch<React.SetStateAction<CrmLeadFormState>>
  crmNotaTexto: string
  setCrmNotaTexto: React.Dispatch<React.SetStateAction<string>>
  crmDataset: CrmDataset
  setCrmDataset: React.Dispatch<React.SetStateAction<CrmDataset>>
  crmCustosForm: CrmCustosFormState
  setCrmCustosForm: React.Dispatch<React.SetStateAction<CrmCustosFormState>>
  crmContratoForm: CrmContratoFormState
  setCrmContratoForm: React.Dispatch<React.SetStateAction<CrmContratoFormState>>
  crmManutencaoForm: CrmManutencaoFormState
  setCrmManutencaoForm: React.Dispatch<React.SetStateAction<CrmManutencaoFormState>>
  crmIntegrationModeRef: React.MutableRefObject<CrmIntegrationMode>
  crmLeadSelecionado: CrmLeadRecord | null
  crmLeadsFiltrados: CrmLeadRecord[]
  crmLeadsPorEtapa: Record<CrmStageId, CrmLeadRecord[]>
  crmKpis: CrmKpisData
  crmFinanceiroResumo: CrmFinanceiroResumoData
  crmPosVendaResumo: CrmPosVendaResumoData
  crmIndicadoresGerenciais: CrmIndicadoresGerenciaisData
  crmManutencoesPendentes: CrmManutencaoRegistro[]
  crmContratosPorLead: Map<string, CrmContratoFinanceiro>
  crmTimelineFiltrada: CrmTimelineEntry[]
  persistCrmDataset: (dataset: CrmDataset, origem?: 'auto' | 'manual') => Promise<void>
  handleCrmLeadFormChange: <K extends keyof CrmLeadFormState>(campo: K, valor: CrmLeadFormState[K]) => void
  handleCrmLeadFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleMoverLead: (leadId: string, direcao: 1 | -1) => void
  handleSelecionarLead: (leadId: string) => void
  handleAdicionarNotaCrm: () => void
  handleAtualizarStatusInstalacao: (leadId: string, status: CrmLeadRecord['instalacaoStatus']) => void
  handleRemoverLead: (leadId: string) => void
  handleSalvarCustosCrm: (event: React.FormEvent<HTMLFormElement>) => void
  handleSalvarContratoCrm: (event: React.FormEvent<HTMLFormElement>) => void
  handleAdicionarManutencaoCrm: (event: React.FormEvent<HTMLFormElement>) => void
  handleConcluirManutencaoCrm: (manutencaoId: string) => void
  handleSyncCrmManualmente: () => void
}
