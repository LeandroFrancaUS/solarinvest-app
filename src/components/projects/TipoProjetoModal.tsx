// src/components/projects/TipoProjetoModal.tsx
// Modal that asks the user to pick Venda or Leasing before creating a
// standalone project. Used from the Leads page (CRM pipeline).

import React, { useState } from 'react'
import { Modal } from '../ui/Modal'
import type { ProjectType } from '../../domain/projects/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Called after the user selects a type and confirms. */
  onConfirm: (projectType: ProjectType) => void
  /** Optional label shown in the modal title (e.g., client name). */
  clientName?: string | undefined
  /** Whether the creation request is in flight. */
  loading?: boolean | undefined
}

export function TipoProjetoModal({ open, onClose, onConfirm, clientName, loading = false }: Props) {
  const [selected, setSelected] = useState<ProjectType | null>(null)

  const handleConfirm = () => {
    if (selected) {
      onConfirm(selected)
    }
  }

  const handleClose = () => {
    setSelected(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo projeto"
      description={
        clientName
          ? `Escolha o tipo de projeto para: ${clientName}`
          : 'Escolha o tipo de projeto antes de continuar.'
      }
      size="sm"
      footer={
        <>
          <button type="button" onClick={handleClose} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            disabled={!selected || loading}
            onClick={handleConfirm}
          >
            {loading ? 'Criando…' : 'Criar projeto'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
          Selecione obrigatoriamente o tipo de projeto:
        </p>
        {(['leasing', 'venda'] as ProjectType[]).map((tipo) => (
          <label
            key={tipo}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: `2px solid ${selected === tipo ? 'var(--color-primary, #2563eb)' : 'var(--color-border, #e5e7eb)'}`,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              background: selected === tipo ? 'var(--color-primary-light, #eff6ff)' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="tipo-projeto"
              value={tipo}
              checked={selected === tipo}
              onChange={() => { setSelected(tipo) }}
              style={{ accentColor: 'var(--color-primary, #2563eb)' }}
            />
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
              {tipo === 'leasing' ? 'Leasing' : 'Venda'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-secondary, #6b7280)' }}>
              {tipo === 'leasing' ? 'Receita recorrente mensal' : 'Receita pontual'}
            </span>
          </label>
        ))}
      </div>
    </Modal>
  )
}
