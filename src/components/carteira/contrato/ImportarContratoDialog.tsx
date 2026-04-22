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
  }) => void
}) {
  const [state, setState] = useState<ContractImportState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ContractImportPreview | null>(null)
  const [approvedCodes, setApprovedCodes] = useState<Set<string>>(new Set())

  const canConfirm = useMemo(() => {
    if (!preview) return false
    const blocking = preview.discrepancies.filter((item) => item.severity === 'blocking')
    const hasPendingBlocking = blocking.some((item) => !item.code || !approvedCodes.has(item.code))
    return preview.eligibility.canImport || !hasPendingBlocking
  }, [preview, approvedCodes])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 1000, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(860px, 95vw)', maxHeight: '90vh', overflow: 'auto', background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Importar contrato</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Selecione um PDF assinado para validar assinatura, comparar dados e preencher a aba Contrato.</p>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            void (async () => {
              const file = e.target.files?.[0]
              if (!file) return
              setError(null)
              setPreview(null)
              setApprovedCodes(new Set())
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

        <div style={{ fontSize: 12 }}>Estado: <strong>{state}</strong></div>
        {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}

        {preview && (
          <>
            <ContractImportPreviewCard preview={preview} />
            {!preview.eligibility.canImport && (
              <div style={{ fontSize: 12, color: '#fb923c' }}>
                {preview.eligibility.reasons.map((reason) => <div key={reason}>• {reason}</div>)}
              </div>
            )}
            <ContractImportDiffTable
              discrepancies={preview.discrepancies}
              approvedCodes={approvedCodes}
              onToggleApprove={(code) => {
                setApprovedCodes((prev) => {
                  const next = new Set(prev)
                  if (next.has(code)) next.delete(code)
                  else next.add(code)
                  return next
                })
              }}
            />
          </>
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
                    approvedCodes: Array.from(approvedCodes),
                  })
                  setState('imported')
                  onImported({
                    attachment: result.attachment,
                    contractSignedAt: result.payload.signedAt,
                    sourceProposalId: result.payload.proposalCode,
                    contractualTermMonths: result.payload.prazoContratualMeses,
                    kwhContratado: result.payload.kwhContratado,
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
