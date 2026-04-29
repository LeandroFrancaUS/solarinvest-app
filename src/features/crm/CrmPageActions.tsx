import React from 'react'
import type { CrmIntegrationMode, UseCrmState } from './crmTypes'

export type CrmPageActionsProps = Pick<
  UseCrmState,
  | 'crmIntegrationMode'
  | 'setCrmIntegrationMode'
  | 'crmIsSaving'
  | 'crmBackendStatus'
  | 'crmBackendError'
  | 'crmLastSync'
  | 'handleSyncCrmManualmente'
> & { onVoltar: () => void }

export function CrmPageActions({
  crmIntegrationMode,
  setCrmIntegrationMode,
  crmIsSaving,
  crmBackendStatus,
  crmBackendError,
  crmLastSync,
  handleSyncCrmManualmente,
  onVoltar,
}: CrmPageActionsProps): React.JSX.Element {
  return (
    <div className="crm-header-actions">
      <div className="crm-sync-controls">
        <label htmlFor="crm-sync-mode">Modo de sincronização</label>
        <select
          id="crm-sync-mode"
          value={crmIntegrationMode}
          onChange={(event) => setCrmIntegrationMode(event.target.value as CrmIntegrationMode)}
        >
          <option value="local">Somente local</option>
          <option value="remote">Sincronizar com backend</option>
        </select>
        <button type="button" className="ghost" onClick={handleSyncCrmManualmente}>
          Sincronizar agora
        </button>
        <small className={`crm-sync-status ${crmBackendStatus}`}>
          {crmIntegrationMode === 'remote'
            ? crmBackendStatus === 'success'
              ? `Sincronizado${crmLastSync ? ` em ${crmLastSync.toLocaleString('pt-BR')}` : ''}`
              : crmBackendStatus === 'error'
                ? crmBackendError ?? 'Erro de sincronização'
                : crmIsSaving
                  ? 'Enviando dados para o backend...'
                  : 'Aguardando alterações para sincronizar'
            : 'Operando somente com dados locais'}
        </small>
      </div>
      <button className="ghost" onClick={onVoltar}>
        Voltar para proposta financeira
      </button>
    </div>
  )
}
