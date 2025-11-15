import React from 'react'
import { labelWithTooltip } from '../../../components/InfoTooltip'
import type { PerfilConsumo, Simulacao } from '../../../lib/finance/simulation'
import type { TipoSistema } from '../../../lib/finance/roi'
import {
  MONEY_INPUT_PLACEHOLDER,
  type UseBRNumberFieldResult,
} from '../../../lib/locale/useBRNumberField'
import { selectNumberInputOnFocus } from '../../../utils/focusHandlers'

const TIPO_SISTEMA_OPTIONS: readonly TipoSistema[] = ['ON_GRID', 'HIBRIDO', 'OFF_GRID']
const TIPO_SISTEMA_LABELS: Record<TipoSistema, string> = {
  ON_GRID: 'On-grid',
  HIBRIDO: 'Híbrido',
  OFF_GRID: 'Off-grid',
}

type FormSimulacaoProps = {
  simulation: Simulacao
  tipoSistemaAtual: TipoSistema
  valorMercadoField: UseBRNumberFieldResult
  onNumberChange: (field: keyof Simulacao) => (event: React.ChangeEvent<HTMLInputElement>) => void
  onTextChange: (
    field: 'nome' | 'obs',
  ) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onPerfilChange: (perfil: PerfilConsumo) => void
  onTipoSistemaChange: (tipo: TipoSistema) => void
  onToggle: (
    field: 'subtrair_tusd_contrato' | 'subtrair_tusd_pos_contrato',
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function FormSimulacao({
  simulation,
  tipoSistemaAtual,
  valorMercadoField,
  onNumberChange,
  onTextChange,
  onPerfilChange,
  onTipoSistemaChange,
  onToggle,
}: FormSimulacaoProps) {
  return (
    <section className="result-section simulacoes-form-card" id="simulacoes-config">
      <header>
        <h4>Configurações da simulação</h4>
      </header>
      <div className="simulacao-form">
        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-nome">
            {labelWithTooltip(
              'Nome do cenário',
              'Identificação do cenário exibida na lista lateral e no comparativo de resultados.',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-nome"
              type="text"
              maxLength={80}
              value={simulation.nome ?? ''}
              onChange={onTextChange('nome')}
              placeholder="Ex.: Residencial | 60 meses"
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-desconto">
            {labelWithTooltip(
              'Desconto SolarInvest (%)',
              'Percentual de abatimento aplicado sobre a tarifa cheia. Tarifa com desconto = Tarifa cheia × (1 - desconto ÷ 100).',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-desconto"
              type="number"
              value={simulation.desconto_pct}
              onChange={onNumberChange('desconto_pct')}
              onFocus={selectNumberInputOnFocus}
              min={0}
              max={100}
              step="0.1"
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-valor-mercado">
            {labelWithTooltip(
              'Valor de Mercado (R$)',
              'Estimativa de recompra da usina. CAPEX considerado nos cálculos = Valor de mercado ÷ 1,29.',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              ref={valorMercadoField.ref}
              className="cfg-input"
              id="sim-valor-mercado"
              type="text"
              inputMode="decimal"
              value={valorMercadoField.text}
              onChange={valorMercadoField.handleChange}
              onBlur={valorMercadoField.handleBlur}
              onFocus={(event) => {
                valorMercadoField.handleFocus(event)
                selectNumberInputOnFocus(event)
              }}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-anos">
            {labelWithTooltip('Anos de contrato', 'Prazo do contrato em anos. Meses simulados = Anos de contrato × 12.')}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-anos"
              type="number"
              value={simulation.anos_contrato}
              onChange={onNumberChange('anos_contrato')}
              onFocus={selectNumberInputOnFocus}
              min={1}
              step="0.5"
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-inflacao-energetica">
            {labelWithTooltip(
              'Inflação energética anual (% a.a.)',
              'Reajuste esperado para a tarifa cheia. Tarifa projetada no mês m = Tarifa cheia mês 1 × (1 + inflação)^{(m-1)/12}.',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-inflacao-energetica"
              type="number"
              value={simulation.inflacao_energetica_pct}
              onChange={onNumberChange('inflacao_energetica_pct')}
              onFocus={selectNumberInputOnFocus}
              min={0}
              step="0.1"
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-inflacao-ipca">
            {labelWithTooltip(
              'Inflação IPCA anual (% a.a.)',
              'Premissa macroeconômica registrada junto ao cenário para análises externas e exportações. Valor informativo, sem impacto direto nos cálculos automáticos.',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-inflacao-ipca"
              type="number"
              value={simulation.inflacao_ipca_pct}
              onChange={onNumberChange('inflacao_ipca_pct')}
              onFocus={selectNumberInputOnFocus}
              min={0}
              step="0.1"
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-tarifa-cheia">
            {labelWithTooltip(
              'Tarifa cheia (R$/kWh) - Mês 1',
              'Tarifa sem desconto considerada no primeiro mês da simulação; ponto de partida para reajustes e cálculos de economia.',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-tarifa-cheia"
              type="number"
              value={simulation.tarifa_cheia_r_kwh_m1}
              onChange={onNumberChange('tarifa_cheia_r_kwh_m1')}
              onFocus={selectNumberInputOnFocus}
              min={0}
              step="0.01"
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-consumo">
            {labelWithTooltip(
              'Consumo (kWh/mês)',
              'Consumo médio mensal compensado pelo leasing. Receita mensal = Consumo × Tarifa com desconto; economia bruta = Consumo × (Tarifa cheia - Tarifa com desconto).',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-consumo"
              type="number"
              value={simulation.kc_kwh_mes}
              onChange={onNumberChange('kc_kwh_mes')}
              onFocus={selectNumberInputOnFocus}
              min={0}
              step="10"
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-tipo-sistema">
            {labelWithTooltip(
              'Tipo de sistema',
              'Classificação técnica do projeto (on-grid, híbrido ou off-grid). Ajuda a definir parâmetros de TUSD e regras de compensação.',
            )}
          </label>
          <div className="field-control cfg-control">
            <select
              className="cfg-input"
              id="sim-tipo-sistema"
              value={tipoSistemaAtual}
              onChange={(event) => onTipoSistemaChange(event.target.value as TipoSistema)}
            >
              {TIPO_SISTEMA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {TIPO_SISTEMA_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label">
            {labelWithTooltip(
              'Perfil de consumo',
              'Categoria da unidade consumidora. Define o TUSD padrão sugerido e influencia simultaneidade e fator ano na TUSD.',
            )}
          </label>
          <div className="field-control cfg-control">
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="perfil-consumo"
                  value="residencial"
                  checked={simulation.perfil_consumo === 'residencial'}
                  onChange={() => onPerfilChange('residencial')}
                />
                Residencial
              </label>
              <label>
                <input
                  type="radio"
                  name="perfil-consumo"
                  value="comercial"
                  checked={simulation.perfil_consumo === 'comercial'}
                  onChange={() => onPerfilChange('comercial')}
                />
                Comercial
              </label>
            </div>
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-tusd">
            {labelWithTooltip(
              'TUSD (%)',
              'Percentual do fio B aplicado sobre a energia compensada. Encargo TUSD ≈ Consumo × Tarifa cheia × (TUSD ÷ 100).',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-tusd"
              type="number"
              value={simulation.tusd_pct ?? 0}
              onChange={onNumberChange('tusd_pct')}
              onFocus={selectNumberInputOnFocus}
              min={0}
              step="0.1"
            />
          </div>
        </div>

        <div className="field cfg-field">
          <label className="field-label cfg-label" htmlFor="sim-seguro">
            {labelWithTooltip(
              'Seguro anual (% valor de mercado)',
              'Percentual aplicado sobre o valor de mercado estimado. Seguro anual = Valor de mercado × (% ÷ 100); seguro mensal é rateado em 12 meses com reajuste de 1,2% a.a.',
            )}
          </label>
          <div className="field-control cfg-control">
            <input
              className="cfg-input"
              id="sim-seguro"
              type="number"
              value={simulation.seguro_pct}
              onChange={onNumberChange('seguro_pct')}
              onFocus={selectNumberInputOnFocus}
              min={0}
              step="0.1"
            />
          </div>
        </div>

        <div className="field cfg-field field-textarea">
          <label className="field-label cfg-label" htmlFor="sim-obs">
            {labelWithTooltip('Observações', 'Notas internas exibidas na tabela comparativa para contextualizar o cenário.')}
          </label>
          <div className="field-control cfg-control">
            <textarea
              className="cfg-input"
              id="sim-obs"
              value={simulation.obs ?? ''}
              onChange={onTextChange('obs')}
              rows={3}
              placeholder="Informações adicionais sobre o cenário"
            />
          </div>
        </div>
      </div>

      <div className="simulations-toggles">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={simulation.subtrair_tusd_contrato !== false}
            onChange={onToggle('subtrair_tusd_contrato')}
          />
          <span>
            {labelWithTooltip(
              'Subtrair TUSD da economia durante o contrato',
              'Quando ativo, a economia líquida mensal considera Encargo TUSD = Economia bruta - Encargo TUSD calculado para cada mês do contrato.',
            )}
          </span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={simulation.subtrair_tusd_pos_contrato !== false}
            onChange={onToggle('subtrair_tusd_pos_contrato')}
          />
          <span>
            {labelWithTooltip(
              'Subtrair TUSD no pós-contrato',
              'Define se o comparativo após o término do leasing deduz a TUSD projetada (Economia pós-contrato = Consumo × Tarifa cheia - TUSD quando marcado).',
            )}
          </span>
        </label>
      </div>
    </section>
  )
}
