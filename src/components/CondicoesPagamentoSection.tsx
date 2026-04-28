// src/components/CondicoesPagamentoSection.tsx
// "Condições de Pagamento" card shown in the vendas tab.
// Pure presentational component; all state and handlers remain in App.tsx.

import * as React from 'react'
import { Field, FieldError } from './ui/Field'
import { labelWithTooltip } from './InfoTooltip'
import { formatMoneyBR } from '../lib/locale/br-number'
import { MONEY_INPUT_PLACEHOLDER } from '../lib/locale/useBRNumberField'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'
import { parseNumericInput } from '../utils/vendasHelpers'
import {
  getPagamentoCondicaoInfo,
  getPagamentoModoInfo,
  PAGAMENTO_CONDICAO_INFO,
  PAGAMENTO_MODO_INFO,
} from '../constants/pagamento'
import type { ModoPagamento, PagamentoCondicao, VendaForm } from '../lib/finance/roi'

// Structural type matching the return value of useBRNumberField.
type MoneyFieldHandle = {
  ref: React.RefObject<HTMLInputElement>
  text: string
  setText: React.Dispatch<React.SetStateAction<string>>
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleBlur: () => void
  handleFocus: (event: React.FocusEvent<HTMLInputElement>) => void
}

export type CondicoesPagamentoSectionProps = {
  vendaForm: VendaForm
  vendaFormErrors: Record<string, string>
  capexMoneyField: MoneyFieldHandle
  isVendaDiretaTab: boolean
  valorTotalPropostaNormalizado: number | null
  onCondicaoPagamentoChange: (condicao: PagamentoCondicao) => void
  onVendaUpdate: (updates: Partial<VendaForm>) => void
}

export function CondicoesPagamentoSection({
  vendaForm,
  vendaFormErrors,
  capexMoneyField,
  isVendaDiretaTab,
  valorTotalPropostaNormalizado,
  onCondicaoPagamentoChange,
  onVendaUpdate,
}: CondicoesPagamentoSectionProps) {
  const condicao = vendaForm.condicao
  const condicaoInfo = getPagamentoCondicaoInfo(condicao)
  const modoInfo =
    condicao === 'AVISTA'
      ? getPagamentoModoInfo(vendaForm.modo_pagamento ?? 'PIX')
      : null
  const pagamentoCardTitle =
    condicao === 'AVISTA' && modoInfo
      ? modoInfo.label
      : condicaoInfo?.label ?? 'Modalidade de pagamento'
  const pagamentoCardSummary =
    condicao === 'AVISTA' && modoInfo ? modoInfo.summary : condicaoInfo?.summary ?? ''
  const pagamentoCardHighlights =
    condicao === 'AVISTA' && modoInfo
      ? modoInfo.highlights
      : condicaoInfo?.highlights ?? []
  return (
    <section className="card">
      <h2>Condições de Pagamento</h2>
      <div className="grid g3">
        <Field
          label={labelWithTooltip(
            'Condição',
            'Seleciona o formato de pagamento (à vista, parcelado ou financiamento), alterando os campos exibidos.',
          )}
        >
          <select
            value={condicao}
            onChange={(event) => onCondicaoPagamentoChange(event.target.value as PagamentoCondicao)}
          >
            <option value="AVISTA">{PAGAMENTO_CONDICAO_INFO.AVISTA.label}</option>
            <option value="PARCELADO">{PAGAMENTO_CONDICAO_INFO.PARCELADO.label}</option>
            <option value="BOLETO">{PAGAMENTO_CONDICAO_INFO.BOLETO.label}</option>
            <option value="DEBITO_AUTOMATICO">{PAGAMENTO_CONDICAO_INFO.DEBITO_AUTOMATICO.label}</option>
            <option value="FINANCIAMENTO">{PAGAMENTO_CONDICAO_INFO.FINANCIAMENTO.label}</option>
          </select>
          <FieldError message={vendaFormErrors.condicao} />
        </Field>
        <Field
          label={labelWithTooltip(
            isVendaDiretaTab ? 'VALOR TOTAL DA PROPOSTA (R$)' : 'Investimento (CAPEX total)',
            isVendaDiretaTab
              ? 'Preço final para aquisição da usina completa (equipamentos, instalação, homologação e suporte).'
              : 'Valor total do projeto fotovoltaico. Serve de base para entradas, parcelas e margens.',
          )}
        >
          <input
            ref={capexMoneyField.ref}
            type="text"
            inputMode="decimal"
            value={capexMoneyField.text}
            onChange={capexMoneyField.handleChange}
            onBlur={() => {
              capexMoneyField.handleBlur()
              capexMoneyField.setText(formatMoneyBR(valorTotalPropostaNormalizado))
            }}
            onFocus={(event) => {
              capexMoneyField.handleFocus(event)
              selectNumberInputOnFocus(event)
            }}
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
          <FieldError message={vendaFormErrors.capex_total} />
        </Field>
        <Field
          label={labelWithTooltip(
            'Moeda',
            'Moeda utilizada na proposta. Atualmente fixa em reais (BRL).',
          )}
        >
          <input readOnly value="BRL" />
        </Field>
      </div>
      {pagamentoCardSummary || pagamentoCardHighlights.length > 0 ? (
        <div className="payment-highlight-card">
          {condicaoInfo ? (
            <span className="payment-highlight-card__badge">{condicaoInfo.label}</span>
          ) : null}
          <strong className="payment-highlight-card__title">{pagamentoCardTitle}</strong>
          {pagamentoCardSummary ? (
            <p className="payment-highlight-card__summary">{pagamentoCardSummary}</p>
          ) : null}
          {pagamentoCardHighlights.length > 0 ? (
            <ul className="payment-highlight-card__list">
              {pagamentoCardHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {condicao === 'AVISTA' ? (
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Modo de pagamento',
              'Define o meio de pagamento à vista e ajusta as taxas de MDR quando aplicável.',
            )}
          >
            <select
              value={vendaForm.modo_pagamento ?? 'PIX'}
              onChange={(event) => onVendaUpdate({ modo_pagamento: event.target.value as ModoPagamento })}
            >
              <option value="PIX">{PAGAMENTO_MODO_INFO.PIX.label}</option>
              <option value="DEBITO">{PAGAMENTO_MODO_INFO.DEBITO.label}</option>
              <option value="CREDITO">{PAGAMENTO_MODO_INFO.CREDITO.label}</option>
            </select>
            <FieldError message={vendaFormErrors.modo_pagamento} />
          </Field>
          <Field
            label={labelWithTooltip(
              'MDR Pix',
              'Taxa de desconto do adquirente para Pix. Custo MDR = Valor transacionado × MDR.',
            )}
          >
            <input
              type="number"
              min={0}
              max={1}
              step="0.001"
              value={
                Number.isFinite(vendaForm.taxa_mdr_pix_pct)
                  ? vendaForm.taxa_mdr_pix_pct
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (value === '') {
                  onVendaUpdate({ taxa_mdr_pix_pct: 0 })
                  return
                }
                const parsed = Number(value)
                onVendaUpdate({ taxa_mdr_pix_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.taxa_mdr_pix_pct} />
          </Field>
          <Field
            label={labelWithTooltip(
              'MDR Débito',
              'Percentual retido pela adquirente em pagamentos no débito. Custo = Valor × MDR.',
            )}
          >
            <input
              type="number"
              min={0}
              max={1}
              step="0.001"
              value={
                Number.isFinite(vendaForm.taxa_mdr_debito_pct)
                  ? vendaForm.taxa_mdr_debito_pct
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (value === '') {
                  onVendaUpdate({ taxa_mdr_debito_pct: 0 })
                  return
                }
                const parsed = Number(value)
                onVendaUpdate({ taxa_mdr_debito_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.taxa_mdr_debito_pct} />
          </Field>
          <Field
            label={labelWithTooltip(
              'MDR Crédito à vista',
              'Taxa aplicada sobre vendas no crédito em parcela única. Custo = Valor × MDR.',
            )}
          >
            <input
              type="number"
              min={0}
              max={1}
              step="0.001"
              value={
                Number.isFinite(vendaForm.taxa_mdr_credito_vista_pct)
                  ? vendaForm.taxa_mdr_credito_vista_pct
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (value === '') {
                  onVendaUpdate({ taxa_mdr_credito_vista_pct: 0 })
                  return
                }
                const parsed = Number(value)
                onVendaUpdate({
                  taxa_mdr_credito_vista_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.taxa_mdr_credito_vista_pct} />
          </Field>
        </div>
      ) : null}
      {condicao === 'PARCELADO' ? (
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Nº de parcelas',
              'Quantidade de parcelas do cartão. Parcela estimada via fórmula PMT = Valor × [i × (1 + i)^n] / [(1 + i)^n - 1].',
            )}
          >
            <input
              type="number"
              min={1}
              step={1}
              value={Number.isFinite(vendaForm.n_parcelas) ? vendaForm.n_parcelas : ''}
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ n_parcelas: undefined })
                  return
                }
                const parsed = Number(value)
                const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                onVendaUpdate({ n_parcelas: normalized })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.n_parcelas} />
          </Field>
          <Field
            label={labelWithTooltip(
              'Juros cartão (% a.m.)',
              'Taxa de juros mensal aplicada pela operadora. Equivalência anual: (1 + i)^12 - 1.',
            )}
          >
            <input
              type="number"
              step="0.01"
              value={
                Number.isFinite(vendaForm.juros_cartao_am_pct)
                  ? vendaForm.juros_cartao_am_pct
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ juros_cartao_am_pct: undefined })
                  return
                }
                const parsed = Number(value)
                onVendaUpdate({ juros_cartao_am_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.juros_cartao_am_pct} />
          </Field>
          <Field
            label={labelWithTooltip(
              'Juros cartão (% a.a.)',
              'Taxa de juros anual utilizada para relatórios. Pode ser derivada de i_mensal: (1 + i_mensal)^12 - 1.',
            )}
          >
            <input
              type="number"
              step="0.1"
              value={
                Number.isFinite(vendaForm.juros_cartao_aa_pct)
                  ? vendaForm.juros_cartao_aa_pct
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ juros_cartao_aa_pct: undefined })
                  return
                }
                const parsed = Number(value)
                onVendaUpdate({ juros_cartao_aa_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.juros_cartao_aa_pct} />
          </Field>
          <Field
            label={labelWithTooltip(
              'MDR crédito parcelado',
              'Taxa retida pela adquirente em vendas parceladas no cartão. Custo = Valor × MDR.',
            )}
          >
            <input
              type="number"
              min={0}
              max={1}
              step="0.001"
              value={
                Number.isFinite(vendaForm.taxa_mdr_credito_parcelado_pct)
                  ? vendaForm.taxa_mdr_credito_parcelado_pct
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ taxa_mdr_credito_parcelado_pct: 0 })
                  return
                }
                const parsed = Number(value)
                onVendaUpdate({
                  taxa_mdr_credito_parcelado_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.taxa_mdr_credito_parcelado_pct} />
          </Field>
        </div>
      ) : null}
      {condicao === 'BOLETO' ? (
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Nº de boletos',
              'Quantidade de boletos emitidos. O valor total da proposta é dividido igualmente entre eles.',
            )}
          >
            <input
              type="number"
              min={1}
              step={1}
              value={Number.isFinite(vendaForm.n_boletos) ? vendaForm.n_boletos : ''}
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ n_boletos: undefined })
                  return
                }
                const parsed = Number(value)
                const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                onVendaUpdate({ n_boletos: normalized })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.n_boletos} />
          </Field>
        </div>
      ) : null}
      {condicao === 'DEBITO_AUTOMATICO' ? (
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Duração do débito automático (meses)',
              'Quantidade de meses com débito recorrente em conta. O valor total é dividido igualmente entre os débitos.',
            )}
          >
            <input
              type="number"
              min={1}
              step={1}
              value={Number.isFinite(vendaForm.n_debitos) ? vendaForm.n_debitos : ''}
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ n_debitos: undefined })
                  return
                }
                const parsed = Number(value)
                const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                onVendaUpdate({ n_debitos: normalized })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.n_debitos} />
          </Field>
        </div>
      ) : null}
      {condicao === 'FINANCIAMENTO' ? (
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Entrada (R$)',
              'Valor de entrada pago pelo cliente. Saldo financiado = CAPEX - Entrada.',
            )}
          >
            <input
              type="number"
              min={0}
              value={
                Number.isFinite(vendaForm.entrada_financiamento)
                  ? vendaForm.entrada_financiamento
                  : ''
              }
              onChange={(event) => {
                const parsed = parseNumericInput(event.target.value)
                const normalized = parsed && parsed > 0 ? parsed : 0
                onVendaUpdate({ entrada_financiamento: normalized })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.entrada_financiamento} />
          </Field>
          <Field
            label={labelWithTooltip(
              'Nº de parcelas',
              'Quantidade de parcelas do financiamento. Parcela calculada pela fórmula PMT com i_mensal e n.',
            )}
          >
            <input
              type="number"
              min={1}
              step={1}
              value={
                Number.isFinite(vendaForm.n_parcelas_fin)
                  ? vendaForm.n_parcelas_fin
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ n_parcelas_fin: undefined })
                  return
                }
                const parsed = Number(value)
                const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                onVendaUpdate({ n_parcelas_fin: normalized })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.n_parcelas_fin} />
          </Field>
          <Field
            label={labelWithTooltip(
              'Juros financiamento (% a.m.)',
              'Taxa de juros mensal contratada com a instituição financeira.',
            )}
          >
            <input
              type="number"
              step="0.01"
              value={
                Number.isFinite(vendaForm.juros_fin_am_pct)
                  ? vendaForm.juros_fin_am_pct
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ juros_fin_am_pct: undefined })
                  return
                }
                const parsed = Number(value)
                onVendaUpdate({ juros_fin_am_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.juros_fin_am_pct} />
          </Field>
          <Field
            label={labelWithTooltip(
              'Juros financiamento (% a.a.)',
              'Taxa de juros anual equivalente. Pode ser obtida por (1 + i_mensal)^12 - 1.',
            )}
          >
            <input
              type="number"
              step="0.1"
              value={
                Number.isFinite(vendaForm.juros_fin_aa_pct)
                  ? vendaForm.juros_fin_aa_pct
                  : ''
              }
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onVendaUpdate({ juros_fin_aa_pct: undefined })
                  return
                }
                const parsed = Number(value)
                onVendaUpdate({ juros_fin_aa_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.juros_fin_aa_pct} />
          </Field>
        </div>
      ) : null}
    </section>
  )
}
