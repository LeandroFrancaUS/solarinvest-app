export type {
  CrmStageId,
  CrmPipelineStage,
  CrmTimelineEntryType,
  CrmTimelineEntry,
  CrmLeadRecord,
  CrmFinanceiroStatus,
  CrmContratoFinanceiro,
  CrmCustoProjeto,
  CrmManutencaoRegistro,
  CrmDataset,
  CrmLeadFormState,
  CrmIntegrationMode,
  CrmBackendStatus,
  CrmFiltroOperacao,
} from './crmTypes'

export {
  CRM_LOCAL_STORAGE_KEY,
  CRM_BACKEND_BASE_URL,
  CRM_PIPELINE_STAGES,
  CRM_INSTALACAO_STATUS,
  CRM_STAGE_INDEX,
  CRM_EMPTY_LEAD_FORM,
  CRM_DATASET_VAZIO,
} from './crmConstants'

export {
  gerarIdCrm,
  sanitizarLeadCrm,
  sanitizarContratoCrm,
  sanitizarCustoCrm,
  sanitizarManutencaoCrm,
  sanitizarEventoCrm,
  sanitizarDatasetCrm,
  carregarDatasetCrm,
} from './crmUtils'
