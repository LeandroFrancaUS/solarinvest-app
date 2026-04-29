// src/features/simulacoes/AfCustosDiretosPanel.tsx
// Subfase 2B.12.4C — Extracted "Custos diretos" tile from AnaliseFinanceiraSection.tsx.

import type React from 'react'
import { Field } from '../../components/ui/Field'
import { labelWithTooltip } from '../../components/InfoTooltip'
import { formatMoneyBR } from '../../lib/locale/br-number'
import { MONEY_INPUT_PLACEHOLDER } from '../../lib/locale/useBRNumberField'
import { BASE_CITY_NAME } from '../../shared/geocoding'
import type { CidadeDB } from '../../data/cidades'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'
import type { VendasConfig } from '../../types/vendasConfig'
import type { MoneyFieldHandle } from './simulacoesTypes'

export interface AfCustosDiretosPanelProps {
  afModo: 'venda' | 'leasing'
  afCustoKitField: MoneyFieldHandle
  afFreteField: MoneyFieldHandle
  afDescarregamentoField: MoneyFieldHandle
  afMaterialCAField: MoneyFieldHandle
  afPlacaField: MoneyFieldHandle
  afProjetoField: MoneyFieldHandle
  afCreaField: MoneyFieldHandle
  afHotelPousadaField: MoneyFieldHandle
  afTransporteCombustivelField: MoneyFieldHandle
  afOutrosField: MoneyFieldHandle
  afMensalidadeBaseField: MoneyFieldHandle
  afImpostosVenda: number
  setAfImpostosVenda: (v: number) => void
  afImpostosLeasing: number
  setAfImpostosLeasing: (v: number) => void
  afMargemLiquidaVenda: number
  setAfMargemLiquidaVenda: (v: number) => void
  afMargemLiquidaMinima: number
  setAfMargemLiquidaMinima: (v: number) => void
  afTaxaDesconto: number
  setAfTaxaDesconto: (v: number) => void
  afInadimplencia: number
  setAfInadimplencia: (v: number) => void
  afCustoOperacional: number
  setAfCustoOperacional: (v: number) => void
  afMesesProjecao: number
  setAfMesesProjecao: (v: number) => void
  afMensalidadeBaseAuto: number
  afCidadeDestino: string
  setAfCidadeDestino: (v: string) => void
  afCidadeSuggestions: CidadeDB[]
  afCidadeShowSuggestions: boolean
  setAfCidadeShowSuggestions: (v: boolean) => void
  afDeslocamentoStatus: 'idle' | 'loading' | 'ok' | 'isenta' | 'error'
  setAfDeslocamentoStatus: (v: 'idle' | 'loading' | 'ok' | 'isenta' | 'error') => void
  afDeslocamentoCidadeLabel: string
  setAfDeslocamentoCidadeLabel: (v: string) => void
  afDeslocamentoKm: number
  setAfDeslocamentoKm: (v: number) => void
  afDeslocamentoRs: number
  setAfDeslocamentoRs: (v: number) => void
  afDeslocamentoErro: string
  setAfDeslocamentoErro: (v: string) => void
  setAfTransporteCombustivel: (v: number) => void
  afCidadeBlurTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  handleSelectCidade: (city: CidadeDB) => void
  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  vendasConfig: VendasConfig
  selectNumberInputOnFocus: (e: React.FocusEvent<HTMLInputElement>) => void
}

export function AfCustosDiretosPanel({
  afModo,
  afCustoKitField,
  afFreteField,
  afDescarregamentoField,
  afMaterialCAField,
  afPlacaField,
  afProjetoField,
  afCreaField,
  afHotelPousadaField,
  afTransporteCombustivelField,
  afOutrosField,
  afMensalidadeBaseField,
  afImpostosVenda,
  setAfImpostosVenda,
  afImpostosLeasing,
  setAfImpostosLeasing,
  afMargemLiquidaVenda,
  setAfMargemLiquidaVenda,
  afMargemLiquidaMinima,
  setAfMargemLiquidaMinima,
  afTaxaDesconto,
  setAfTaxaDesconto,
  afInadimplencia,
  setAfInadimplencia,
  afCustoOperacional,
  setAfCustoOperacional,
  afMesesProjecao,
  setAfMesesProjecao,
  afMensalidadeBaseAuto,
  afCidadeDestino,
  setAfCidadeDestino,
  afCidadeSuggestions,
  afCidadeShowSuggestions,
  setAfCidadeShowSuggestions,
  afDeslocamentoStatus,
  setAfDeslocamentoStatus,
  afDeslocamentoCidadeLabel,
  setAfDeslocamentoCidadeLabel,
  afDeslocamentoKm,
  setAfDeslocamentoKm,
  afDeslocamentoRs,
  setAfDeslocamentoRs,
  afDeslocamentoErro,
  setAfDeslocamentoErro,
  setAfTransporteCombustivel,
  afCidadeBlurTimerRef,
  handleSelectCidade,
  analiseFinanceiraResult,
  vendasConfig,
  selectNumberInputOnFocus,
}: AfCustosDiretosPanelProps) {
  return (
    <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
      <h4>Custos diretos</h4>
      <div className="grid g3">
        <Field label="Custo do Kit (R$)">
          <input
            ref={afCustoKitField.ref}
            type="text"
            inputMode="decimal"
            value={afCustoKitField.text}
            style={{ outline: '2px solid var(--color-accent, #2563eb)', borderRadius: '4px' }}
            onChange={afCustoKitField.handleChange}
            onBlur={afCustoKitField.handleBlur}
            onFocus={afCustoKitField.handleFocus}
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label="Frete (R$)">
          <input
            ref={afFreteField.ref}
            type="text"
            inputMode="decimal"
            value={afFreteField.text}
            onChange={afFreteField.handleChange}
            onBlur={afFreteField.handleBlur}
            onFocus={afFreteField.handleFocus}
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label="Descarregamento (R$)">
          <input
            ref={afDescarregamentoField.ref}
            type="text"
            inputMode="decimal"
            value={afDescarregamentoField.text}
            onChange={afDescarregamentoField.handleChange}
            onBlur={afDescarregamentoField.handleBlur}
            onFocus={afDescarregamentoField.handleFocus}
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label="Material CA (R$)">
          <input
            ref={afMaterialCAField.ref}
            type="text"
            inputMode="decimal"
            value={afMaterialCAField.text}
            onChange={afMaterialCAField.handleChange}
            onBlur={afMaterialCAField.handleBlur}
            onFocus={afMaterialCAField.handleFocus}
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label="Placa (R$)">
          <input
            ref={afPlacaField.ref}
            type="text"
            inputMode="decimal"
            value={afPlacaField.text}
            onChange={afPlacaField.handleChange}
            onBlur={afPlacaField.handleBlur}
            onFocus={afPlacaField.handleFocus}
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label={labelWithTooltip('Projeto (R$)', 'Custo do projeto elétrico. Calculado automaticamente pela potência do sistema, mas pode ser editado manualmente.')}>
          <input
            ref={afProjetoField.ref}
            type="text"
            inputMode="decimal"
            value={afProjetoField.text}
            onChange={afProjetoField.handleChange}
            onBlur={afProjetoField.handleBlur}
            onFocus={afProjetoField.handleFocus}
            placeholder={analiseFinanceiraResult ? formatMoneyBR(analiseFinanceiraResult.custo_projeto_rs) : MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label={labelWithTooltip('CREA (R$)', 'Taxa do Conselho Regional de Engenharia. Calculada automaticamente pela UF, mas pode ser editada manualmente.')}>
          <input
            ref={afCreaField.ref}
            type="text"
            inputMode="decimal"
            value={afCreaField.text}
            onChange={afCreaField.handleChange}
            onBlur={afCreaField.handleBlur}
            onFocus={afCreaField.handleFocus}
            placeholder={analiseFinanceiraResult ? formatMoneyBR(analiseFinanceiraResult.crea_rs) : MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label="Instalação (R$)">
          <input
            type="number"
            value={
              analiseFinanceiraResult
                ? analiseFinanceiraResult.quantidade_modulos * 70
                : 0
            }
            readOnly
            disabled
          />
        </Field>
        <Field label="Hotel/Pousada (R$)">
          <input
            ref={afHotelPousadaField.ref}
            type="text"
            inputMode="decimal"
            value={afHotelPousadaField.text}
            onChange={afHotelPousadaField.handleChange}
            onBlur={afHotelPousadaField.handleBlur}
            onFocus={afHotelPousadaField.handleFocus}
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label="Transporte/Combustível (R$)">
          <input
            ref={afTransporteCombustivelField.ref}
            type="text"
            inputMode="decimal"
            value={afTransporteCombustivelField.text}
            readOnly
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
          {afDeslocamentoStatus === 'isenta' && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-success-fg, green)' }}>
              ✓ {afDeslocamentoCidadeLabel} — Região isenta (R$0)
            </span>
          )}
          {afDeslocamentoStatus === 'ok' && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-info-fg, #2563eb)' }}>
              ✓ {afDeslocamentoCidadeLabel} — {afDeslocamentoKm} km ida+volta → {formatMoneyBR(afDeslocamentoRs)}
            </span>
          )}
          {afDeslocamentoStatus === 'error' && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-error-fg, red)' }}>
              ⚠ {afDeslocamentoErro}
            </span>
          )}
        </Field>
        <Field label="Outros (R$)">
          <input
            ref={afOutrosField.ref}
            type="text"
            inputMode="decimal"
            value={afOutrosField.text}
            onChange={afOutrosField.handleChange}
            onBlur={afOutrosField.handleBlur}
            onFocus={afOutrosField.handleFocus}
            placeholder={MONEY_INPUT_PLACEHOLDER}
          />
        </Field>
        <Field label={`Impostos (%) — ${afModo === 'venda' ? 'Venda' : 'Leasing'}`}>
          <input
            type="number"
            value={afModo === 'venda' ? afImpostosVenda : afImpostosLeasing}
            min={0}
            max={100}
            onChange={(e) => {
              const val = Number(e.target.value) || 0
              if (afModo === 'venda') setAfImpostosVenda(val)
              else setAfImpostosLeasing(val)
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        {afModo === 'venda' ? (
          <>
            <Field label="Margem líquida alvo (%)">
              <input
                type="number"
                value={afMargemLiquidaVenda}
                min={0}
                max={99}
                onChange={(e) => setAfMargemLiquidaVenda(Number(e.target.value) || 0)}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
            <Field label="Margem líquida mínima (%)">
              <input
                type="number"
                value={afMargemLiquidaMinima}
                min={0}
                max={99}
                onChange={(e) => setAfMargemLiquidaMinima(Number(e.target.value) || 0)}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
          </>
        ) : null}
        <Field label={labelWithTooltip('Taxa de desconto VPL (% a.a.)', 'Taxa anual usada para calcular o VPL (Valor Presente Líquido). Deixe em 0 para não calcular o VPL.')}>
          <input
            type="number"
            value={afTaxaDesconto}
            min={0}
            max={100}
            step={0.5}
            onChange={(e) => setAfTaxaDesconto(Number(e.target.value) || 0)}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        {afModo === 'leasing' ? (
          <>
            <Field label="Inadimplência (%)">
              <input
                type="number"
                value={afInadimplencia}
                min={0}
                max={100}
                onChange={(e) => setAfInadimplencia(Number(e.target.value) || 0)}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
            <Field label="Custo operacional (%)">
              <input
                type="number"
                value={afCustoOperacional}
                min={0}
                max={100}
                onChange={(e) => setAfCustoOperacional(Number(e.target.value) || 0)}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
            <Field label="Horizonte de análise (meses)">
              <input
                type="number"
                value={afMesesProjecao}
                min={1}
                onChange={(e) => setAfMesesProjecao(Math.max(1, Number(e.target.value) || 1))}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
            <Field label="Mensalidade base (R$)">
              <input
                ref={afMensalidadeBaseField.ref}
                type="text"
                inputMode="decimal"
                value={afMensalidadeBaseField.text}
                onChange={afMensalidadeBaseField.handleChange}
                onBlur={afMensalidadeBaseField.handleBlur}
                onFocus={afMensalidadeBaseField.handleFocus}
                placeholder={afMensalidadeBaseAuto > 0 ? formatMoneyBR(afMensalidadeBaseAuto) : '—'}
              />
            </Field>
          </>
        ) : null}
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <Field label={labelWithTooltip('UF / Cidade', `Digite a cidade para definir a UF e calcular automaticamente o custo de deslocamento da equipe a partir de ${BASE_CITY_NAME}.`)}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={afCidadeDestino}
              onChange={(e) => {
                setAfCidadeDestino(e.target.value)
                setAfCidadeShowSuggestions(true)
                if (!e.target.value.trim()) {
                  setAfDeslocamentoStatus('idle')
                  setAfDeslocamentoKm(0)
                  setAfDeslocamentoRs(0)
                  setAfDeslocamentoCidadeLabel('')
                  setAfDeslocamentoErro('')
                  setAfTransporteCombustivel(0)
                }
              }}
              onFocus={() => {
                if (afCidadeBlurTimerRef.current) clearTimeout(afCidadeBlurTimerRef.current)
                setAfCidadeShowSuggestions(true)
              }}
              onBlur={() => {
                afCidadeBlurTimerRef.current = setTimeout(() => setAfCidadeShowSuggestions(false), 150)
              }}
              placeholder="Ex: Goiânia ou goiania ou Brasilia"
              autoComplete="off"
              spellCheck={false}
            />
            {afCidadeShowSuggestions && afCidadeSuggestions.length > 0 && (
              <ul style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                background: 'var(--color-surface, #fff)',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                listStyle: 'none',
                margin: 0,
                padding: '0.25rem 0',
                maxHeight: '220px',
                overflowY: 'auto',
              }}>
                {afCidadeSuggestions.map((city) => (
                  <li
                    key={`${city.cidade}-${city.uf}`}
                    onMouseDown={() => handleSelectCidade(city)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    {city.cidade} — {city.uf}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
      </div>
      <p className="simulacoes-description" style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
        Parâmetros fixos (custo fixo rateado {vendasConfig.af_custo_fixo_rateado_percent}%, lucro mínimo {vendasConfig.af_lucro_minimo_percent}%) configurados em Preferências → Parâmetros de Vendas.
      </p>
    </div>
  )
}
