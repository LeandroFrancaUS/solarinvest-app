import React, { useId } from 'react'
import { CheckboxSmall } from '../CheckboxSmall'

export type ContractTemplateCategory = 'leasing' | 'vendas'

type ContractTemplatesModalProps = {
  title: string
  templates: string[]
  selectedTemplates: string[]
  isLoading: boolean
  errorMessage: string | null
  onToggleTemplate: (template: string) => void
  onSelectAll: (selectAll: boolean) => void
  onConfirm: () => void
  onClose: () => void
}

export function ContractTemplatesModal({
  title,
  templates,
  selectedTemplates,
  isLoading,
  errorMessage,
  onToggleTemplate,
  onSelectAll,
  onConfirm,
  onClose,
}: ContractTemplatesModalProps) {
  const modalTitleId = useId()
  const checkboxBaseId = useId()
  const allSelected = templates.length > 0 && selectedTemplates.length === templates.length
  const hasSelection = selectedTemplates.length > 0

  return (
    <div
      className="modal contract-templates-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content contract-templates-modal__content">
        <div className="modal-header">
          <h3 id={modalTitleId}>{title}</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar seleção de contratos">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>Selecione os modelos de contrato que deseja gerar.</p>
          {isLoading ? (
            <p className="muted">Carregando modelos disponíveis…</p>
          ) : errorMessage ? (
            <p className="muted">{errorMessage}</p>
          ) : templates.length === 0 ? (
            <p className="muted">Nenhum modelo de contrato disponível no momento.</p>
          ) : (
            <>
              <div className="contract-template-actions">
                <button
                  type="button"
                  className="link"
                  onClick={() => onSelectAll(!allSelected)}
                >
                  {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <ul className="contract-template-list">
                {templates.map((template, index) => {
                  const checkboxId = `${checkboxBaseId}-${index}`
                  const fileName = template.split(/[\\/]/).pop() ?? template
                  const label = fileName.replace(/\.docx$/i, '')
                  const checked = selectedTemplates.includes(template)
                  return (
                    <li key={template} className="contract-template-item">
                      <label htmlFor={checkboxId} className="flex items-center gap-2">
                        <CheckboxSmall
                          id={checkboxId}
                          checked={checked}
                          onChange={() => onToggleTemplate(template)}
                        />
                        <span>
                          <strong>{label}</strong>
                          <span className="filename">{fileName}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {!isLoading && !errorMessage && templates.length > 0 && !hasSelection ? (
            <p className="muted">Selecione ao menos um modelo para gerar.</p>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary"
              onClick={onConfirm}
              disabled={isLoading || templates.length === 0 || !hasSelection}
            >
              Gerar contratos selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
