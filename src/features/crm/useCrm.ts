import { useEffect, useRef, useState } from 'react'
import { CRM_EMPTY_LEAD_FORM } from './crmConstants'
import { carregarDatasetCrm } from './crmUtils'
import type {
  CrmBackendStatus,
  CrmContratoFormState,
  CrmCustosFormState,
  CrmDataset,
  CrmFiltroOperacao,
  CrmFinanceiroStatus,
  CrmIntegrationMode,
  CrmLeadFormState,
  CrmManutencaoFormState,
  UseCrmState,
} from './crmTypes'

export function useCrm(): UseCrmState {
  const [crmIntegrationMode, setCrmIntegrationMode] = useState<CrmIntegrationMode>('local')
  const crmIntegrationModeRef = useRef<CrmIntegrationMode>(crmIntegrationMode)
  const [crmIsSaving, setCrmIsSaving] = useState(false)
  const [crmBackendStatus, setCrmBackendStatus] = useState<CrmBackendStatus>('idle')
  const [crmBackendError, setCrmBackendError] = useState<string | null>(null)
  const [crmLastSync, setCrmLastSync] = useState<Date | null>(null)
  const [crmBusca, setCrmBusca] = useState('')
  const [crmFiltroOperacao, setCrmFiltroOperacao] = useState<CrmFiltroOperacao>('all')
  const [crmLeadSelecionadoId, setCrmLeadSelecionadoId] = useState<string | null>(null)
  const [crmLeadForm, setCrmLeadForm] = useState<CrmLeadFormState>({ ...CRM_EMPTY_LEAD_FORM })
  const [crmNotaTexto, setCrmNotaTexto] = useState('')
  const [crmDataset, setCrmDataset] = useState<CrmDataset>(() => carregarDatasetCrm())
  const [crmCustosForm, setCrmCustosForm] = useState<CrmCustosFormState>({
    equipamentos: '',
    maoDeObra: '',
    deslocamento: '',
    taxasSeguros: '',
  })
  const [crmContratoForm, setCrmContratoForm] = useState<CrmContratoFormState>({
    leadId: '',
    modelo: 'LEASING',
    valorTotal: '',
    entrada: '',
    parcelas: '36',
    valorParcela: '',
    reajusteAnualPct: '3',
    vencimentoInicialIso: new Date().toISOString().slice(0, 10),
    status: 'em-aberto' as CrmFinanceiroStatus,
  })
  const [crmManutencaoForm, setCrmManutencaoForm] = useState<CrmManutencaoFormState>({
    leadId: '',
    dataIso: new Date().toISOString().slice(0, 10),
    tipo: 'Revisão preventiva',
    observacao: '',
  })

  useEffect(() => {
    crmIntegrationModeRef.current = crmIntegrationMode
  }, [crmIntegrationMode])

  return {
    crmIntegrationMode,
    setCrmIntegrationMode,
    crmIsSaving,
    setCrmIsSaving,
    crmBackendStatus,
    setCrmBackendStatus,
    crmBackendError,
    setCrmBackendError,
    crmLastSync,
    setCrmLastSync,
    crmBusca,
    setCrmBusca,
    crmFiltroOperacao,
    setCrmFiltroOperacao,
    crmLeadSelecionadoId,
    setCrmLeadSelecionadoId,
    crmLeadForm,
    setCrmLeadForm,
    crmNotaTexto,
    setCrmNotaTexto,
    crmDataset,
    setCrmDataset,
    crmCustosForm,
    setCrmCustosForm,
    crmContratoForm,
    setCrmContratoForm,
    crmManutencaoForm,
    setCrmManutencaoForm,
    crmIntegrationModeRef,
  }
}
