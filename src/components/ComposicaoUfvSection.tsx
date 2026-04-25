// src/components/ComposicaoUfvSection.tsx
// "Composição da UFV" card shown in the vendas tab when modoOrcamento === 'manual'.
// Displays consolidated proposal values and allows overriding CAPEX base and margin.
// Pure presentational component; all state lives in App.tsx.

import * as React from 'react'
import { Field } from './ui/Field'
import { labelWithTooltip } from './InfoTooltip'
import { formatMoneyBR } from '../lib/locale/br-number'
import { MONEY_INPUT_PLACEHOLDER } from '../lib/locale/useBRNumberField'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'

// Structural type matching the return value of useBRNumberField.
type MoneyFieldHandle = {
  ref: React.RefObject<HTMLInputElement>
  text: string
  setText: React.Dispatch<React.SetStateAction<string>>
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleBlur: () => void
  handleFocus: (event: React.FocusEvent<HTMLInputElement>) => void
}

export type ComposicaoUfvSectionProps = {
  descontosMoneyField: MoneyFieldHandle
  capexBaseResumoField: MoneyFieldHandle
  capexBaseResumoValor: number
  capexBaseManualValor: number | null | undefined
  margemOperacionalResumoField: MoneyFieldHandle
  margemManualAtiva: boolean
  onOpenVendasConfig: () => void
}

export function ComposicaoUfvSection({
  descontosMoneyField,
  capexBaseResumoField,
  capexBaseResumoValor,
  capexBaseManualValor,
  margemOperacionalResumoField,
  margemManualAtiva,
  onOpenVendasConfig,
}: ComposicaoUfvSectionProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Composição da UFV</h2>
        <button type="button" className="ghost with-icon" onClick={onOpenVendasConfig}>
          <span aria-hidden="true">⚙︎</span>
          Ajustar parâmetros internos
        </button>
      </div>
      <p className="muted">
        Consulte abaixo os valores consolidados da proposta. Custos e ajustes comerciais podem ser
        atualizados em Configurações → Parâmetros de Vendas.
      </p>
      <div className="composicao-ufv-controls">
        <h3>Ajustes desta proposta</h3>
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Descontos comerciais (R$)',
              'Valor de descontos concedidos ao cliente. Utilizado para calcular a venda líquida.',
            )}
          >
            <input
              ref={descontosMoneyField.ref}
              type="text"
              inputMode="decimal"
              value={descontosMoneyField.text}
              onChange={descontosMoneyField.handleChange}
              onBlur={descontosMoneyField.handleBlur}
              onFocus={(event) => {
                descontosMoneyField.handleFocus(event)
                selectNumberInputOnFocus(event)
              }}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
        </div>
      </div>
      <div className="composicao-ufv-summary">
        <h3>Referências internas</h3>
        <p className="muted">Valores herdados de Configurações → Parâmetros de Vendas.</p>
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'CAPEX base (R$)',
              'CAPEX base considerado após os custos internos e impostos configurados.',
            )}
          >
            <input
              ref={capexBaseResumoField.ref}
              type="text"
              inputMode="decimal"
              value={capexBaseResumoField.text}
              onChange={capexBaseResumoField.handleChange}
              onBlur={() => {
                capexBaseResumoField.handleBlur()
                capexBaseResumoField.setText(formatMoneyBR(capexBaseResumoValor))
              }}
              onFocus={(event) => {
                capexBaseResumoField.handleFocus(event)
                selectNumberInputOnFocus(event)
              }}
              placeholder={
                typeof capexBaseManualValor === 'number'
                  ? MONEY_INPUT_PLACEHOLDER
                  : 'Automático (calculado)'
              }
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Margem operacional (R$)',
              'Margem operacional calculada a partir do CAPEX base e dos ajustes comerciais desta proposta.',
            )}
          >
            <input
              ref={margemOperacionalResumoField.ref}
              type="text"
              inputMode="decimal"
              value={margemOperacionalResumoField.text}
              onChange={margemOperacionalResumoField.handleChange}
              onBlur={() => margemOperacionalResumoField.handleBlur()}
              onFocus={(event) => {
                margemOperacionalResumoField.handleFocus(event)
                selectNumberInputOnFocus(event)
              }}
              placeholder={
                margemManualAtiva ? MONEY_INPUT_PLACEHOLDER : 'Automático (padrão)'
              }
            />
          </Field>
        </div>
      </div>
    </section>
  )
}
