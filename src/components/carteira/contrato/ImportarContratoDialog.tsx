import React, { useMemo, useState } from 'react'
import type { PortfolioClientRow, ContractAttachment } from '../../../types/clientPortfolio'
import type { ContractImportPreview, ContractImportState } from '../../../lib/contracts/contractImport/types'
import { previewContractImport, applyContractImport } from '../../../services/contractImportService'
import { ContractImportPreviewCard } from './ContractImportPreview'
import { ContractImportDiffTable } from './ContractImportDiffTable'

export function ImportarContratoDialog({
  open,
  client,
  existingAttachments,
  onClose,
  onImported,
}: {
  open: boolean
  client: PortfolioClientRow
  existingAttachments: ContractAttachment[]
  onClose: () => void
  onImported: (data: {
    attachment: ContractAttachment
    contractSignedAt: string | null
    sourceProposalId: string | null
    contractualTermMonths: number | null
    kwhContratado: number | null
    contractorName: string | null
    contractorDocument: string | null
    contractorEmail: string | null
    contractorPhone: string | null
    contractorAddress: string | null
    contractorCity: string | null
    contractorState: string | null
  }) => void
}) {
  const [state, setState] = useState<ContractImportState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ContractImportPreview | null>(null)
  const [decisions, setDecisions] = useState<Record<string, 'import' | 'keep' | undefined>>({})
  const [selectedFileName, setSelectedFileName] = useState('Nenhum arquivo selecionado')
  const stateLabel: Record<ContractImportState, string> = {
    idle: 'aguardando arquivo',
    uploading: 'carregando',
    parsing: 'lendo PDF',
    validating: 'validando',
    ready: 'pronto',
    warning: 'atenção',
    error: 'erro',
    imported: 'importado',
  }

  const resolvedApprovalCodes = useMemo(() => {
    if (!preview) return new Set<string>()
    const resolved = new Set<string>()
    const decisionByField: Record<string, 'import' | 'keep' | undefined> = {}
    for (const item of preview.comparisons) {
      const decision = decisions[item.code]
      if (decision) {
        resolved.add(item.code)
        decisionByField[item.field] = decision
      }
    }
    for (const item of preview.discrepancies) {
      if (item.code && decisions[item.code]) resolved.add(item.code)
      if (item.code && decisionByField[item.field]) resolved.add(item.code)
    }
    return resolved
  }, [preview, decisions])

  const canConfirm = useMemo(() => {
    if (!preview) return false
    const pendingComparisonApprovals = preview.comparisons
      .filter((item) => item.requiresManualApproval)
      .some((item) => !decisions[item.code])
    const blocking = preview.discrepancies.filter((item) => item.severity === 'blocking')
    const hasPendingBlocking = blocking.some((item) => item.code && !resolvedApprovalCodes.has(item.code))
    return (preview.eligibility.canImport || !hasPendingBlocking) && !pendingComparisonApprovals
  }, [preview, decisions, resolvedApprovalCodes])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 1000, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(820px, calc(100vw - 48px))', maxHeight: '88vh', overflow: 'auto', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, color: '#0f172a' }}>Importar contrato</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>Selecione um PDF assinado para validar assinatura, comparar dados e preencher a aba Contrato.</p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #cbd5e1', borderRadius: 8, padding: 8 }}>
          <span className="pf-btn pf-btn-edit" style={{ cursor: 'pointer' }}>Escolher arquivo</span>
          <span style={{ fontSize: 12, color: '#475569' }}>{selectedFileName}</span>
          <input
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
            void (async () => {
              const file = e.target.files?.[0]
              if (!file) return
              setError(null)
              setPreview(null)
              setDecisions({})
              setSelectedFileName(file.name)
              try {
                setState('uploading')
                setState('parsing')
                const imported = await previewContractImport(file, client)
                setState('validating')
                setPreview(imported)
                setState(imported.eligibility.canImport ? 'ready' : 'warning')
              } catch (err) {
                setState('error')
                setError(err instanceof Error ? err.message : 'Falha ao importar contrato.')
              } finally {
                e.target.value = ''
              }
            })()
            }}
          />
        </label>

        <div style={{ fontSize: 12, color: '#334155' }}>Status: <strong>{stateLabel[state]}</strong></div>
        {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}

        {preview && (
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: 10, maxHeight: '42vh', overflow: 'auto' }}>
            <ContractImportPreviewCard preview={preview} />
            {!preview.eligibility.canImport && (
              <div style={{ fontSize: 12, color: '#c2410c', marginTop: 8 }}>
                {preview.eligibility.reasons.map((reason) => <div key={reason}>• {reason}</div>)}
              </div>
            )}
            <ContractImportDiffTable
              comparisons={preview.comparisons}
              decisions={decisions}
              onSetDecision={(code, decision) => setDecisions((prev) => ({ ...prev, [code]: decision }))}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="pf-btn pf-btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="pf-btn pf-btn-save"
            disabled={!preview || !canConfirm}
            onClick={() => {
              void (async () => {
                if (!preview) return
                try {
                  setState('validating')
                  const result = await applyContractImport({
                    client,
                    preview,
                    existingAttachments,
                    approvedCodes: Array.from(resolvedApprovalCodes),
                    decisions,
                  })
                  setState('imported')
                  onImported({
                    attachment: result.attachment,
                    contractSignedAt: result.payload.signedAt,
                    sourceProposalId: result.payload.proposalCode,
                    contractualTermMonths: result.payload.prazoContratualMeses,
                    kwhContratado: result.payload.kwhContratado,
                    contractorName: result.payload.contractorName,
                    contractorDocument: result.payload.contractorDocument,
                    contractorEmail: result.payload.contractorEmail,
                    contractorPhone: result.payload.contractorPhone,
                    contractorAddress: result.payload.contractorAddress,
                    contractorCity: result.payload.contractorCity,
                    contractorState: result.payload.contractorState,
                  })
                } catch (err) {
                  setState('error')
                  setError(err instanceof Error ? err.message : 'Falha ao concluir importação.')
                }
              })()
            }}
          >
            Confirmar importação
          </button>
        </div>
      </div>
    </div>
  )
}
