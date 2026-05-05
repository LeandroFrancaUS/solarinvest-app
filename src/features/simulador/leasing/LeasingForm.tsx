// src/features/simulador/leasing/LeasingForm.tsx
// "SolarInvest Leasing" form card + mensalidades sections.
// Extracted from App.tsx (PR E — Extract Leasing UI composition).
// Receives all data via props — no internal state, no direct store access.

import React from 'react'
import type { EntradaModo } from '../../../shared/entradaModo'
import type { MensalidadeRow } from '../../../types/printableProposal'
import { LEASING_PRAZO_OPCOES, type LeasingPrazoAnos } from '../../../app/config'
import { InfoTooltip, labelWithTooltip } from '../../../components/InfoTooltip'
import { Field } from '../../../components/ui/Field'
import { CheckboxSmall } from '../../../components/CheckboxSmall'
import { formatNumberBRWithOptions } from '../../../lib/locale/br-number'
import { currency, tarifaCurrency } from '../../../utils/formatters'
import { selectNumberInputOnFocus } from '../../../utils/focusHandlers'

const formatLeasingPrazoAnos = (valor: number) => {
  const fractionDigits = Number.isInteger(valor) ? 0 : 1
  return formatNumberBRWithOptions(valor, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export interface ParcelasSolarInvestSummary {
  lista: MensalidadeRow[]
  tarifaDescontadaBase: number
  kcAjustado: number
  creditoMensal: number
}

export interface LeasingFormProps {
  // Save/refresh actions
  podeSalvarProposta: boolean
  salvandoPropostaLeasing: boolean
  onSalvarProposta: () => Promise<boolean>

  // Leasing parameters
  entradaRs: number
  onEntradaRsChange: (value: number) => void
  desconto: number
  onDescontoChange: (value: number) => void
  leasingPrazo: LeasingPrazoAnos
  onLeasingPrazoChange: (value: LeasingPrazoAnos) => void

  // Derived display values
  custoFinalProjetadoCanonico: number
  parcelasSolarInvest: ParcelasSolarInvestSummary
  shouldHideSimpleViewItems: boolean
  capexSolarInvest: number
  modoEntradaNormalizado: EntradaModo

  // Toggles
  mostrarValorMercadoLeasing: boolean
  onMostrarValorMercadoLeasingChange: (checked: boolean) => void
  mostrarTabelaParcelas: boolean
  onMostrarTabelaParcelasChange: React.Dispatch<React.SetStateAction<boolean>>

  // Mensalidades
  leasingMensalidades: readonly number[]
  financiamentoMensalidades: readonly number[]
  mostrarFinanciamento: boolean
}

export function LeasingForm({
  podeSalvarProposta,
  salvandoPropostaLeasing,
  onSalvarProposta,
  entradaRs,
  onEntradaRsChange,
  desconto,
  onDescontoChange,
  leasingPrazo,
  onLeasingPrazoChange,
  custoFinalProjetadoCanonico,
  parcelasSolarInvest,
  shouldHideSimpleViewItems,
  capexSolarInvest,
  modoEntradaNormalizado,
  mostrarValorMercadoLeasing,
  onMostrarValorMercadoLeasingChange,
  mostrarTabelaParcelas,
  onMostrarTabelaParcelasChange,
  leasingMensalidades,
  financiamentoMensalidades,
  mostrarFinanciamento,
}: LeasingFormProps) {
  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2>SolarInvest Leasing</h2>
          <div className="card-actions">
            <button
              type="button"
              className="primary"
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={onSalvarProposta}
              disabled={!podeSalvarProposta || salvandoPropostaLeasing}
            >
              {salvandoPropostaLeasing ? 'Salvando…' : 'Salvar proposta'}
            </button>
            <button
              type="button"
              className="ghost"
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={onSalvarProposta}
              disabled={salvandoPropostaLeasing}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Entrada (R$)',
              'Entrada inicial do leasing. Pode gerar crédito mensal: Entrada ÷ Prazo contratual (meses).',
            )}
          >
            <input
              type="number"
              value={entradaRs}
              onChange={(e) => {
                const parsed = Number(e.target.value)
                onEntradaRsChange(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
              }}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Desconto contratual (%)',
              'Percentual aplicado sobre a tarifa cheia. Tarifa com desconto = Tarifa cheia × (1 - desconto).',
            )}
          >
            <input
              type="number"
              step="0.1"
              value={desconto}
              onChange={(e) => onDescontoChange(Number(e.target.value) || 0)}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Prazo do leasing',
              'Duração do contrato de leasing em anos. Prazo em meses = anos × 12.',
            )}
          >
            <select
              value={leasingPrazo}
              onChange={(e) => onLeasingPrazoChange(Number(e.target.value) as LeasingPrazoAnos)}
            >
              {LEASING_PRAZO_OPCOES.map((valor) => (
                <option key={valor} value={valor}>
                  {`${formatLeasingPrazoAnos(valor)} anos`}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="info-inline">
          <span className="pill">
            <InfoTooltip text="Preço Mín. Saudável (Análise Financeira v1). Quando disponível, usa o preço mínimo saudável calculado pelo motor de análise. Caso contrário, usa o custo final projetado automático." />
            Valor atual de venda
            <strong>{currency(custoFinalProjetadoCanonico)}</strong>
          </span>
          <span className="pill">
            <InfoTooltip text="Tarifa com desconto = Tarifa cheia ajustada pelos reajustes anuais × (1 - desconto contratual)." />
            Tarifa c/ desconto
            <strong>{tarifaCurrency(parcelasSolarInvest.tarifaDescontadaBase)} / kWh</strong>
          </span>
          {shouldHideSimpleViewItems ? null : (
            <span className="pill">
              <InfoTooltip text="CAPEX (SolarInvest) = Valor atual de venda × 70%. Representa o capital investido pela SolarInvest para executar o projeto." />
              CAPEX (SolarInvest)
              <strong>{currency(capexSolarInvest)}</strong>
            </span>
          )}
          {modoEntradaNormalizado === 'REDUZ' ? (
            <span className="pill">
              Piso contratado ajustado
              <InfoTooltip text="Piso ajustado = Consumo contratado × (1 - min(1, Entrada ÷ (Consumo × Tarifa cheia × (1 - desconto) × Prazo)))." />
              :{' '}
              <strong>
                {`${formatNumberBRWithOptions(parcelasSolarInvest.kcAjustado, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })} kWh`}
              </strong>
            </span>
          ) : null}
          {modoEntradaNormalizado === 'CREDITO' ? (
            <span className="pill">
              Crédito mensal da entrada:
              <InfoTooltip text="Crédito mensal = Valor de entrada ÷ Prazo contratual (em meses)." />
              <strong>{currency(parcelasSolarInvest.creditoMensal)}</strong>
            </span>
          ) : null}
        </div>

        {!shouldHideSimpleViewItems ? (
          <div className="grid g3">
            <Field label=" ">
              <label className="inline-checkbox inline-checkbox--small flex items-center gap-2">
                <CheckboxSmall
                  aria-label="Apresentar valor de mercado na proposta"
                  checked={mostrarValorMercadoLeasing}
                  onChange={(event) => onMostrarValorMercadoLeasingChange(event.target.checked)}
                />
                <span>Apresentar valor de mercado na proposta</span>
              </label>
            </Field>
          </div>
        ) : null}

        <div className="table-controls">
          <button
            type="button"
            className="collapse-toggle"
            onClick={() => onMostrarTabelaParcelasChange((prev) => !prev)}
            aria-expanded={mostrarTabelaParcelas}
            aria-controls="parcelas-solarinvest-tabela"
          >
            {mostrarTabelaParcelas ? 'Ocultar tabela de parcelas' : 'Exibir tabela de parcelas'}
          </button>
        </div>
        {mostrarTabelaParcelas ? (
          <div className="table-wrapper">
            <table id="parcelas-solarinvest-tabela">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Tarifa por kWh</th>
                  <th>Tarifa c/ desconto (R$/kWh)</th>
                  <th>MENSALIDADE CHEIA</th>
                  <th>TUSD (R$)</th>
                  <th>MENSALIDADE COM LEASING</th>
                </tr>
              </thead>
              <tbody>
                {parcelasSolarInvest.lista.length > 0 ? (
                  parcelasSolarInvest.lista.map((row) => (
                    <tr key={row.mes}>
                      <td>{row.mes}</td>
                      <td>{tarifaCurrency(row.tarifaCheia)}</td>
                      <td>{tarifaCurrency(row.tarifaDescontada)}</td>
                      <td>{currency(row.mensalidadeCheia)}</td>
                      <td>{currency(row.tusd)}</td>
                      <td>{currency(row.mensalidade)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="muted">
                      Defina um prazo contratual para gerar a projeção das parcelas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {shouldHideSimpleViewItems ? null : (
        <div className="grid g2">
          <section className="card">
            <h2>Leasing — Mensalidades</h2>
            <div className="list-col">
              {leasingMensalidades.map((valor, index) => (
                <div className="list-row" key={`leasing-m${index}`}>
                  <span>Ano {index + 1}</span>
                  <strong>{currency(valor)}</strong>
                </div>
              ))}
            </div>
            <div className="notice">
              <div className="dot" />
              <div>
                <p className="notice-title">Fim do prazo</p>
                <p className="notice-sub">
                  Após {formatLeasingPrazoAnos(leasingPrazo)} anos a curva acelera: 100% do retorno
                  fica com o cliente.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Financiamento — Mensalidades</h2>
              <span className="toggle-label">
                Coluna ativa: {mostrarFinanciamento ? 'Sim' : 'Não'}
              </span>
            </div>
            {mostrarFinanciamento ? (
              <div className="list-col">
                {financiamentoMensalidades.map((valor, index) => (
                  <div className="list-row" key={`fin-m${index}`}>
                    <span>Ano {index + 1}</span>
                    <strong>{currency(valor)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                Habilite nas configurações para comparar a coluna de financiamento.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  )
}
