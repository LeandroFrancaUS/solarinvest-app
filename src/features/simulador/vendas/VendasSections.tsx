// src/features/simulador/vendas/VendasSections.tsx
// Vendas tab top sections: "Tipo de instalação e sistema" + "Modo de orçamento".
// Extracted from App.tsx (PR F — Extract Vendas UI composition).
// Receives all data via props — no internal state, no direct store access.

import React from 'react'
import { Field } from '../../../components/ui/Field'
import type { TipoInstalacao } from '../../../shared/ufvComposicao'
import type { TipoSistema } from '../../../lib/finance/roi'
import { TIPOS_INSTALACAO } from '../../../constants/instalacao'

const TIPO_SISTEMA_VALUES: readonly TipoSistema[] = ['ON_GRID', 'HIBRIDO', 'OFF_GRID'] as const

export interface VendasSectionsProps {
  // Tipo de instalação e sistema
  tipoInstalacao: TipoInstalacao
  tipoInstalacaoOutro: string | null
  tipoSistema: TipoSistema
  isManualBudgetForced: boolean
  manualBudgetForceReason: string
  onTipoInstalacaoChange: (value: TipoInstalacao) => void
  onTipoInstalacaoOutroChange: (value: string) => void
  onTipoSistemaChange: (value: TipoSistema) => void

  // Modo de orçamento
  modoOrcamento: 'auto' | 'manual'
  autoBudgetFallbackMessage: string | null
  onModoOrcamentoChange: (value: 'auto' | 'manual') => void
}

export function VendasSections({
  tipoInstalacao,
  tipoInstalacaoOutro,
  tipoSistema,
  isManualBudgetForced,
  manualBudgetForceReason,
  modoOrcamento,
  autoBudgetFallbackMessage,
  onTipoInstalacaoChange,
  onTipoInstalacaoOutroChange,
  onTipoSistemaChange,
  onModoOrcamentoChange,
}: VendasSectionsProps) {
  return (
    <>
      <section className="card">
        <h2>Tipo de instalação e sistema</h2>
        <div className="grid g2">
          <Field label="Tipo de instalação">
            <select
              value={tipoInstalacao}
              onChange={(event) =>
                onTipoInstalacaoChange(event.target.value as TipoInstalacao)
              }
              aria-label="Selecionar tipo de instalação"
            >
              {TIPOS_INSTALACAO.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {tipoInstalacao === 'outros' ? (
              <input
                type="text"
                placeholder="Descreva o tipo de instalação"
                value={tipoInstalacaoOutro || ''}
                onChange={(event) => onTipoInstalacaoOutroChange(event.target.value)}
                style={{ marginTop: '6px' }}
              />
            ) : null}
          </Field>
          <Field label="Tipo de sistema">
            <div
              className="toggle-group"
              role="radiogroup"
              aria-label="Selecionar tipo de sistema"
            >
              {TIPO_SISTEMA_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={tipoSistema === value}
                  className={`toggle-option${tipoSistema === value ? ' active' : ''}`}
                  onClick={() => onTipoSistemaChange(value)}
                >
                  {value === 'ON_GRID'
                    ? 'On-grid'
                    : value === 'HIBRIDO'
                    ? 'Híbrido'
                    : 'Off-grid'}
                </button>
              ))}
            </div>
          </Field>
        </div>
        {isManualBudgetForced ? (
          <p className="warning" role="alert">
            {manualBudgetForceReason}
          </p>
        ) : null}
      </section>
      <section className="card">
        <h2>Modo de orçamento</h2>
        <div
          className="toggle-group"
          role="radiogroup"
          aria-label="Selecionar modo de orçamento"
        >
          <button
            type="button"
            role="radio"
            aria-checked={modoOrcamento === 'auto'}
            aria-disabled={isManualBudgetForced}
            disabled={isManualBudgetForced}
            className={`toggle-option${modoOrcamento === 'auto' ? ' active' : ''}${
              isManualBudgetForced ? ' disabled' : ''
            }`}
            onClick={() => onModoOrcamentoChange('auto')}
          >
            Orçamento automático
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={modoOrcamento === 'manual'}
            className={`toggle-option${modoOrcamento === 'manual' ? ' active' : ''}`}
            onClick={() => onModoOrcamentoChange('manual')}
          >
            Orçamento manual
          </button>
        </div>
        <p className="muted" role="status">
          {isManualBudgetForced
            ? manualBudgetForceReason
            : modoOrcamento === 'auto'
            ? 'Preencha poucos campos e o sistema calcula o orçamento.'
            : 'Use o modo manual para valores personalizados.'}
        </p>
        {modoOrcamento === 'manual' && autoBudgetFallbackMessage ? (
          <p className="warning" role="alert" style={{ marginTop: '8px' }}>
            {autoBudgetFallbackMessage}
          </p>
        ) : null}
      </section>
    </>
  )
}
