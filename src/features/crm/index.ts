export {
  CRM_BACKEND_BASE_URL,
  CRM_DATASET_VAZIO,
  CRM_EMPTY_LEAD_FORM,
  CRM_INSTALACAO_STATUS,
  CRM_LOCAL_STORAGE_KEY,
  CRM_PIPELINE_STAGES,
  CRM_STAGE_INDEX,
} from './crmConstants'

export type {
  CrmAdicionarNotificacaoFn,
  CrmBackendStatus,
  CrmContratoFinanceiro,
  CrmContratoFormState,
  CrmCustoProjeto,
  CrmCustosFormState,
  CrmDataset,
  CrmFiltroOperacao,
  CrmFinanceiroStatus,
  CrmIntegrationMode,
  CrmLeadFormState,
  CrmLeadRecord,
  CrmManutencaoFormState,
  CrmManutencaoRegistro,
  CrmPipelineStage,
  CrmStageId,
  CrmTimelineEntry,
  CrmTimelineEntryType,
  UseCrmDeps,
  UseCrmState,
} from './crmTypes'

export {
  carregarDatasetCrm,
  diasDesdeDataIso,
  formatarDataCurta,
  gerarIdCrm,
  sanitizarContratoCrm,
  sanitizarCustoCrm,
  sanitizarDatasetCrm,
  sanitizarEventoCrm,
  sanitizarLeadCrm,
  sanitizarManutencaoCrm,
} from './crmUtils'

export { useCrm } from './useCrm'
