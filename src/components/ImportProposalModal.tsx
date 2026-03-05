/**
 * ImportProposalModal.tsx
 *
 * Handles the UI flow for importing a SolarInvest PDF proposal back into the form.
 * All four conflict-resolution cases from the requirements are handled here.
 */

import React, { useId } from 'react'
import type { ClienteDados } from '../types/printableProposal'
import type { ParsedProposalPdfData } from '../lib/pdf/extractProposalPdf'

// ─── Types ────────────────────────────────────────────────────────────────────

/** The current "state" of the import flow */
export type ImportModalState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not-solarinvest' }
  | { kind: 'unsaved-changes'; parsed: ParsedProposalPdfData }
  | { kind: 'exact-match'; parsed: ParsedProposalPdfData; clienteNome: string }
  | { kind: 'diff'; parsed: ParsedProposalPdfData; existing: ClienteDados; diffs: FieldDiff[] }
  | { kind: 'new-client'; parsed: ParsedProposalPdfData }

export type FieldDiff = {
  field: string
  label: string
  current: string
  imported: string
}

export type ImportProposalModalProps = {
  state: ImportModalState
  onConfirm: (parsed: ParsedProposalPdfData) => void
  onCancel: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function val(v: string | null | undefined): string {
  return v?.trim() || '—'
}

function DiffTable({ diffs }: { diffs: FieldDiff[] }) {
  if (diffs.length === 0) {
    return null
  }
  return (
    <table className="import-diff-table">
      <thead>
        <tr>
          <th>Campo</th>
          <th>Valor atual</th>
          <th>Valor no PDF</th>
        </tr>
      </thead>
      <tbody>
        {diffs.map((d) => (
          <tr key={d.field}>
            <td>
              <strong>{d.label}</strong>
            </td>
            <td className="import-diff-current">{d.current}</td>
            <td className="import-diff-imported">{d.imported}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ImportProposalModal({ state, onConfirm, onCancel }: ImportProposalModalProps) {
  const titleId = useId()

  const renderContent = () => {
    switch (state.kind) {
      case 'loading':
        return (
          <>
            <div className="modal-header">
              <h3 id={titleId}>Importar Proposta PDF</h3>
            </div>
            <div className="modal-body">
              <p className="muted">⏳ Lendo arquivo PDF, aguarde…</p>
            </div>
          </>
        )

      case 'error':
        return (
          <>
            <div className="modal-header">
              <h3 id={titleId}>Erro ao importar</h3>
              <button type="button" className="icon" onClick={onCancel} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>⚠️ {state.message}</p>
              <div className="modal-actions">
                <button type="button" className="primary" onClick={onCancel}>
                  Fechar
                </button>
              </div>
            </div>
          </>
        )

      case 'not-solarinvest':
        return (
          <>
            <div className="modal-header">
              <h3 id={titleId}>PDF não reconhecido</h3>
              <button type="button" className="icon" onClick={onCancel} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                O arquivo enviado não parece ser uma proposta gerada pelo SolarInvest. Apenas
                propostas geradas por esta ferramenta podem ser reimportadas.
              </p>
              <div className="modal-actions">
                <button type="button" className="primary" onClick={onCancel}>
                  Fechar
                </button>
              </div>
            </div>
          </>
        )

      case 'unsaved-changes': {
        const { parsed } = state
        return (
          <>
            <div className="modal-header">
              <h3 id={titleId}>Dados não salvos serão perdidos</h3>
              <button type="button" className="icon" onClick={onCancel} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Existem dados inseridos manualmente nos campos do formulário que ainda não foram
                salvos. Se prosseguir com a importação,{' '}
                <strong>todos esses dados serão descartados</strong>.
              </p>
              {parsed.cliente.nome ? (
                <p className="muted">
                  Proposta a importar:{' '}
                  <strong>{parsed.cliente.nome}</strong>
                  {parsed.budgetId ? ` — Código: ${parsed.budgetId}` : ''}
                </p>
              ) : null}
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={onCancel}>
                  Cancelar
                </button>
                <button type="button" className="primary" onClick={() => onConfirm(parsed)}>
                  Prosseguir e importar
                </button>
              </div>
            </div>
          </>
        )
      }

      case 'exact-match': {
        const { parsed, clienteNome } = state
        return (
          <>
            <div className="modal-header">
              <h3 id={titleId}>Proposta já existe no sistema</h3>
              <button type="button" className="icon" onClick={onCancel} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                O cliente <strong>{clienteNome}</strong> já está cadastrado no sistema e os dados
                desta proposta são <strong>idênticos</strong> aos dados já cadastrados.
              </p>
              <p>Deseja recarregar esta proposta descartando os dados atuais do formulário?</p>
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={onCancel}>
                  Cancelar
                </button>
                <button type="button" className="primary" onClick={() => onConfirm(parsed)}>
                  Recarregar proposta
                </button>
              </div>
            </div>
          </>
        )
      }

      case 'diff': {
        const { parsed, diffs } = state
        return (
          <>
            <div className="modal-header">
              <h3 id={titleId}>Cliente já cadastrado — dados diferentes</h3>
              <button type="button" className="icon" onClick={onCancel} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Este cliente já está cadastrado no sistema, mas os dados do PDF são diferentes dos
                dados atuais. Veja abaixo o que seria alterado:
              </p>
              <DiffTable diffs={diffs} />
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                Se confirmar, os dados do formulário serão substituídos pelos dados importados do
                PDF.
              </p>
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={onCancel}>
                  Cancelar
                </button>
                <button type="button" className="primary" onClick={() => onConfirm(parsed)}>
                  Importar e aplicar alterações
                </button>
              </div>
            </div>
          </>
        )
      }

      case 'new-client': {
        const { parsed } = state
        return (
          <>
            <div className="modal-header">
              <h3 id={titleId}>Importar como novo cliente</h3>
              <button type="button" className="icon" onClick={onCancel} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Os dados da proposta serão importados como um novo cliente no formulário.
              </p>
              {parsed.cliente.nome ? (
                <ul className="import-summary-list">
                  {parsed.cliente.nome ? (
                    <li>
                      <strong>Cliente:</strong> {val(parsed.cliente.nome)}
                    </li>
                  ) : null}
                  {parsed.cliente.documento ? (
                    <li>
                      <strong>CPF/CNPJ:</strong> {val(parsed.cliente.documento)}
                    </li>
                  ) : null}
                  {parsed.cliente.cidade || parsed.cliente.uf ? (
                    <li>
                      <strong>Cidade/UF:</strong>{' '}
                      {[parsed.cliente.cidade, parsed.cliente.uf].filter(Boolean).join(' / ')}
                    </li>
                  ) : null}
                  {parsed.tecnico.potenciaInstaladaKwp ? (
                    <li>
                      <strong>Potência:</strong> {parsed.tecnico.potenciaInstaladaKwp} kWp
                    </li>
                  ) : null}
                  {parsed.budgetId ? (
                    <li>
                      <strong>Código:</strong> {parsed.budgetId}
                    </li>
                  ) : null}
                </ul>
              ) : null}
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={onCancel}>
                  Cancelar
                </button>
                <button type="button" className="primary" onClick={() => onConfirm(parsed)}>
                  Importar proposta
                </button>
              </div>
            </div>
          </>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="modal import-proposal-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className="modal-backdrop"
        onClick={state.kind !== 'loading' ? onCancel : undefined}
      />
      <div className="modal-content import-proposal-modal__content">{renderContent()}</div>
    </div>
  )
}

export default ImportProposalModal
