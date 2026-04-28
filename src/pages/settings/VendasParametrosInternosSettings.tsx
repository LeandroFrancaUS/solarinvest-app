import { useId } from 'react'
import type React from 'react'
import { CheckboxSmall } from '../../components/CheckboxSmall'
import { labelWithTooltip } from '../../components/InfoTooltip'
import { formatMoneyBR, formatNumberBRWithOptions, formatPercentBRWithDigits } from '../../lib/locale/br-number'
import { MONEY_INPUT_PLACEHOLDER, useBRNumberField } from '../../lib/locale/useBRNumberField'
import type {
  ImpostosRegimeConfig,
  Outputs,
  RegimeTributario,
} from '../../lib/venda/calcComposicaoUFV'
import type {
  TipoInstalacao,
  UfvComposicaoSoloValores,
  UfvComposicaoTelhadoValores,
} from '../../types/printableProposal'
import type { VendasConfig } from '../../types/vendasConfig'
import { currency } from '../../utils/formatters'
import { selectNumberInputOnFocus } from '../../utils/focusHandlers'
import { cloneImpostosOverrides, parseNumericInput, toNumberSafe } from '../../utils/vendasHelpers'

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const REGIME_TRIBUTARIO_LABELS: Record<RegimeTributario, string> = {
  simples: 'Simples nacional',
  lucro_presumido: 'Lucro presumido',
  lucro_real: 'Lucro real',
}

const formatCurrencyInputValue = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) {
    return ''
  }
  return formatMoneyBR(value)
}

// ---------------------------------------------------------------------------
// Local Field component — mirrors the settings Field defined in App.tsx
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
  hint,
  htmlFor,
}: {
  label: React.ReactNode
  children: React.ReactNode
  hint?: React.ReactNode
  htmlFor?: string
}) {
  const generatedId = useId()
  let firstControlId: string | undefined

  const enhancedChildren = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) {
      return child
    }

    if (typeof child.type === 'string') {
      if (child.type === 'input') {
        const inputType = (child.props as { type?: string }).type
        if (inputType === 'checkbox' || inputType === 'radio') {
          return child
        }
      }

      if (child.type === 'input' || child.type === 'select' || child.type === 'textarea') {
        const existingProps = child.props as {
          className?: string
          id?: string
          name?: string
        }
        const existingClassName = existingProps.className ?? ''
        const classes = existingClassName.split(' ').filter(Boolean)
        if (!classes.includes('cfg-input')) {
          classes.push('cfg-input')
        }
        const resolvedId =
          existingProps.id ?? (index === 0 ? generatedId : `${generatedId}-${index}`)
        if (!firstControlId) {
          firstControlId = resolvedId
        }
        return React.cloneElement(child, {
          className: classes.join(' '),
          id: existingProps.id ?? resolvedId,
          name: existingProps.name ?? resolvedId,
        })
      }
    }

    return child
  })

  const labelHtmlFor = htmlFor ?? firstControlId

  return (
    <div className="field cfg-field">
      <label
        className="field-label cfg-label"
        {...(labelHtmlFor ? { htmlFor: labelHtmlFor } : undefined)}
      >
        {label}
      </label>
      <div className="field-control cfg-control">
        {enhancedChildren}
        {hint ? <small className="cfg-help">{hint}</small> : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BRNumberField = ReturnType<typeof useBRNumberField>

export interface VendasParametrosInternosSettingsProps {
  vendasConfig: VendasConfig
  tipoInstalacao: TipoInstalacao
  composicaoTelhadoCalculo: Outputs | null
  composicaoSoloCalculo: Outputs | null
  composicaoTelhado: UfvComposicaoTelhadoValores
  composicaoSolo: UfvComposicaoSoloValores
  descontosValor: number
  aprovadoresResumo: string
  capexBaseResumoSettingsField: BRNumberField
  capexBaseResumoValor: number
  capexBaseManualValor: number | undefined
  margemOperacionalResumoSettingsField: BRNumberField
  margemManualAtiva: boolean
  impostosOverridesDraft: Partial<ImpostosRegimeConfig>
  aprovadoresText: string
  custoImplantacaoReferencia: number | null
  updateVendasConfig: (patch: Partial<VendasConfig>) => void
  onUpdateResumoProposta: (data: { custo_implantacao_referencia: number | null }) => void
  onComposicaoTelhadoChange: (campo: keyof UfvComposicaoTelhadoValores, valor: string) => void
  onComposicaoSoloChange: (campo: keyof UfvComposicaoSoloValores, valor: string) => void
  setImpostosOverridesDraft: React.Dispatch<React.SetStateAction<Partial<ImpostosRegimeConfig>>>
  setAprovadoresText: React.Dispatch<React.SetStateAction<string>>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VendasParametrosInternosSettings({
  vendasConfig,
  tipoInstalacao,
  composicaoTelhadoCalculo,
  composicaoSoloCalculo,
  composicaoTelhado,
  composicaoSolo,
  descontosValor,
  aprovadoresResumo,
  capexBaseResumoSettingsField,
  capexBaseResumoValor,
  capexBaseManualValor,
  margemOperacionalResumoSettingsField,
  margemManualAtiva,
  impostosOverridesDraft,
  aprovadoresText,
  custoImplantacaoReferencia,
  updateVendasConfig,
  onUpdateResumoProposta,
  onComposicaoTelhadoChange,
  onComposicaoSoloChange,
  setImpostosOverridesDraft,
  setAprovadoresText,
}: VendasParametrosInternosSettingsProps) {
  const comissaoLabel =
    vendasConfig.comissao_default_tipo === 'percentual'
      ? 'Comissão líquida (%)'
      : 'Comissão líquida (R$)'
  const telhadoCampos: { key: keyof UfvComposicaoTelhadoValores; label: string; tooltip: string }[] = [
    { key: 'projeto', label: 'Projeto', tooltip: 'Custos de elaboração do projeto elétrico e estrutural da usina.' },
    { key: 'instalacao', label: 'Instalação', tooltip: 'Mão de obra, deslocamento e insumos da equipe de instalação.' },
    { key: 'materialCa', label: 'Material CA', tooltip: 'Materiais elétricos do lado CA (cabos, disjuntores, quadros).' },
    { key: 'crea', label: 'CREA', tooltip: 'Taxas do conselho de engenharia necessárias para o projeto.' },
    { key: 'art', label: 'ART', tooltip: 'Valor da Anotação de Responsabilidade Técnica do responsável.' },
    { key: 'placa', label: 'Placa', tooltip: 'Investimento nos módulos fotovoltaicos utilizados no sistema.' },
  ]
  const resumoCamposTelhado: { key: keyof UfvComposicaoTelhadoValores; label: string; tooltip: string }[] = [
    {
      key: 'comissaoLiquida',
      label: comissaoLabel,
      tooltip:
        'Comissão líquida destinada ao time comercial. Ajuste o formato (valor ou percentual) nos parâmetros abaixo.',
    },
  ]
  const soloCamposPrincipais: { key: keyof UfvComposicaoSoloValores; label: string; tooltip: string }[] = [
    { key: 'projeto', label: 'Projeto', tooltip: 'Custos de elaboração do projeto elétrico e estrutural da usina.' },
    { key: 'instalacao', label: 'Instalação', tooltip: 'Mão de obra, deslocamento e insumos da equipe de instalação.' },
    { key: 'materialCa', label: 'Material CA', tooltip: 'Materiais elétricos do lado CA (cabos, disjuntores, quadros).' },
    { key: 'crea', label: 'CREA', tooltip: 'Taxas do conselho de engenharia necessárias para o projeto.' },
    { key: 'art', label: 'ART', tooltip: 'Valor da Anotação de Responsabilidade Técnica do responsável.' },
    { key: 'placa', label: 'Placa', tooltip: 'Investimento nos módulos fotovoltaicos utilizados no sistema.' },
    { key: 'estruturaSolo', label: 'Estrutura solo', tooltip: 'Estruturas e fundações específicas para montagem em solo.' },
    { key: 'tela', label: 'Tela', tooltip: 'Material de cercamento (telas de proteção) para o parque solar.' },
    { key: 'portaoTela', label: 'Portão tela', tooltip: 'Portões e acessos associados ao cercamento em tela.' },
    { key: 'maoObraTela', label: 'Mão de obra tela', tooltip: 'Equipe dedicada à instalação da tela e portões.' },
    { key: 'casaInversor', label: 'Casa inversor', tooltip: 'Construção ou abrigo para inversores e painéis elétricos.' },
    { key: 'brita', label: 'Brita', tooltip: 'Lastro de brita utilizado para nivelamento e drenagem do solo.' },
    { key: 'terraplanagem', label: 'Terraplanagem', tooltip: 'Serviços de preparo e nivelamento do terreno.' },
    { key: 'trafo', label: 'Trafo', tooltip: 'Custo de transformadores ou adequações de tensão.' },
    { key: 'rede', label: 'Rede', tooltip: 'Adequações de rede, cabeamento e conexões externas.' },
  ]
  const resumoCamposSolo: { key: keyof UfvComposicaoSoloValores; label: string; tooltip: string }[] = [
    {
      key: 'comissaoLiquida',
      label: comissaoLabel,
      tooltip:
        'Comissão líquida destinada ao time comercial. Ajuste o formato (valor ou percentual) nos parâmetros abaixo.',
    },
  ]

  const isTelhado = tipoInstalacao !== 'solo'
  const regimes: RegimeTributario[] = ['simples', 'lucro_presumido', 'lucro_real']
  const comissaoDefaultLabel =
    vendasConfig.comissao_default_tipo === 'percentual'
      ? 'Comissão padrão (%)'
      : 'Comissão padrão (R$)'
  const aprovadoresHint = 'Separe múltiplos e-mails por linha ou vírgula.'
  const calculoAtual = isTelhado ? composicaoTelhadoCalculo : composicaoSoloCalculo
  const regimeBreakdown = calculoAtual?.regime_breakdown ?? []
  const currencyValue = (valor?: number) => (Number.isFinite(valor) ? currency(Number(valor)) : '')
  const percentValue = (valor?: number) =>
    Number.isFinite(valor) ? formatPercentBRWithDigits(Number(valor) / 100, 2) : ''
  const precoMinimoAplicadoLabel = calculoAtual
    ? calculoAtual.preco_minimo_aplicado
      ? 'Sim'
      : 'Não'
    : ''
  const workflowAtivo = Boolean(vendasConfig.workflow_aprovacao_ativo)
  const aprovacaoLabel = (() => {
    if (!workflowAtivo) {
      return 'Workflow desativado'
    }
    if (!calculoAtual) {
      return ''
    }
    if (!calculoAtual.desconto_requer_aprovacao) {
      return 'Não'
    }
    return aprovadoresResumo ? `Sim — ${aprovadoresResumo}` : 'Sim'
  })()
  const workflowStatusLabel = workflowAtivo ? 'Ativo' : 'Desativado'
  const descontoValor = toNumberSafe(descontosValor)

  const sanitizeOverridesDraft = (
    draft: Partial<ImpostosRegimeConfig>,
  ): Partial<ImpostosRegimeConfig> | undefined => {
    const sanitized: Partial<ImpostosRegimeConfig> = {}
    for (const regime of regimes) {
      const lista = draft[regime]
      if (!lista || lista.length === 0) {
        continue
      }
      const cleaned = lista
        .map((item) => ({
          nome: (item.nome ?? '').trim(),
          aliquota_percent: Number.isFinite(item.aliquota_percent)
            ? Number(item.aliquota_percent)
            : 0,
        }))
        .filter((item) => item.nome.length > 0)
      if (cleaned.length > 0) {
        sanitized[regime] = cleaned
      }
    }
    return Object.keys(sanitized).length > 0 ? sanitized : undefined
  }

  const handleCustoImplantacaoReferenciaInput = (value: string) => {
    if (value === '') {
      onUpdateResumoProposta({ custo_implantacao_referencia: null })
      return
    }
    const parsed = parseNumericInput(value)
    const normalizado = Number.isFinite(parsed ?? NaN) ? Math.max(0, Number(parsed)) : 0
    onUpdateResumoProposta({
      custo_implantacao_referencia: normalizado > 0 ? normalizado : null,
    })
  }

  const handleOverrideFieldChange = (
    regime: RegimeTributario,
    index: number,
    field: 'nome' | 'aliquota_percent',
    value: string,
  ) => {
    setImpostosOverridesDraft((prev) => {
      const next = cloneImpostosOverrides(prev)
      const lista = next[regime] ? [...next[regime]] : []
      const atual = lista[index] ?? { nome: '', aliquota_percent: 0 }
      if (field === 'nome') {
        lista[index] = { ...atual, nome: value }
      } else {
        const parsed = parseNumericInput(value)
        const aliquota = parsed == null ? 0 : Number(parsed)
        lista[index] = {
          ...atual,
          aliquota_percent: Number.isFinite(aliquota) ? aliquota : 0,
        }
      }
      next[regime] = lista
      return next
    })
  }

  const handleOverrideAdd = (regime: RegimeTributario) => {
    setImpostosOverridesDraft((prev) => {
      const next = cloneImpostosOverrides(prev)
      const lista = next[regime] ? [...next[regime]] : []
      lista.push({ nome: '', aliquota_percent: 0 })
      next[regime] = lista
      return next
    })
  }

  const handleOverrideRemove = (regime: RegimeTributario, index: number) => {
    setImpostosOverridesDraft((prev) => {
      const next = cloneImpostosOverrides(prev)
      const lista = next[regime] ? [...next[regime]] : []
      lista.splice(index, 1)
      if (lista.length > 0) {
        next[regime] = lista
      } else {
        delete next[regime]
      }
      return next
    })
  }

  const handleApplyOverrides = () => {
    const sanitized = sanitizeOverridesDraft(impostosOverridesDraft)
    updateVendasConfig({ impostosRegime_overrides: sanitized ?? null })
  }

  const handleResetOverrides = (regime: RegimeTributario) => {
    setImpostosOverridesDraft((prev) => {
      const next = cloneImpostosOverrides(prev)
      delete next[regime]
      const sanitized = sanitizeOverridesDraft(next)
      updateVendasConfig({ impostosRegime_overrides: sanitized ?? null })
      return next
    })
  }

  const handleAprovadoresBlur = () => {
    const emails = aprovadoresText
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    updateVendasConfig({ aprovadores: emails })
  }

  return (
    <div className="settings-vendas-parametros">
      <p className="muted">
        Ajuste os custos internos da usina e os parâmetros comerciais utilizados no cálculo da proposta.
      </p>

      <section className="settings-vendas-card config-card settings-vendas-card--full">
        <div className="settings-vendas-card-header">
          <div>
            <h3>Composição da UFV</h3>
            <p className="settings-vendas-card-description">
              Distribua os custos internos conforme o tipo de implantação padrão ({isTelhado ? 'telhado' : 'solo'}).
            </p>
          </div>
        </div>
        <div className="settings-vendas-card-body">
          <div className="composicao-ufv-groups">
            {isTelhado ? (
              <div className="composicao-ufv-group">
                <h3>Projeto em Telhado</h3>
                <div className="grid g3">
                  {telhadoCampos.map(({ key, label, tooltip }) => (
                    <Field key={`settings-telhado-${key}`} label={labelWithTooltip(label, tooltip)}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatCurrencyInputValue(
                          Number.isFinite(composicaoTelhado[key]) ? composicaoTelhado[key] : 0,
                        )}
                        onChange={(event) => onComposicaoTelhadoChange(key, event.target.value)}
                        onFocus={selectNumberInputOnFocus}
                      />
                    </Field>
                  ))}
                </div>
                <div className="grid g3">
                  {resumoCamposTelhado.map(({ key, label, tooltip }) => (
                    <Field key={`settings-telhado-resumo-${key}`} label={labelWithTooltip(label, tooltip)}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatCurrencyInputValue(
                          Number.isFinite(composicaoTelhado[key]) ? composicaoTelhado[key] : 0,
                        )}
                        onChange={(event) => onComposicaoTelhadoChange(key, event.target.value)}
                        onFocus={selectNumberInputOnFocus}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ) : (
              <div className="composicao-ufv-group">
                <h3>Projeto em Solo</h3>
                <div className="grid g3">
                  {soloCamposPrincipais.map(({ key, label, tooltip }) => (
                    <Field key={`settings-solo-${key}`} label={labelWithTooltip(label, tooltip)}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatCurrencyInputValue(
                          Number.isFinite(composicaoSolo[key]) ? composicaoSolo[key] : 0,
                        )}
                        onChange={(event) => onComposicaoSoloChange(key, event.target.value)}
                        onFocus={selectNumberInputOnFocus}
                      />
                    </Field>
                  ))}
                </div>
                <div className="grid g3">
                  {resumoCamposSolo.map(({ key, label, tooltip }) => (
                    <Field key={`settings-solo-resumo-${key}`} label={labelWithTooltip(label, tooltip)}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatCurrencyInputValue(
                          Number.isFinite(composicaoSolo[key]) ? composicaoSolo[key] : 0,
                        )}
                        onChange={(event) => onComposicaoSoloChange(key, event.target.value)}
                        onFocus={selectNumberInputOnFocus}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="settings-vendas-columns">
        <section className="settings-vendas-card config-card">
          <div className="settings-vendas-card-header">
            <div>
              <h3>Custos &amp; precificação</h3>
              <p className="settings-vendas-card-description">
                Configure valores de referência e guardrails automáticos aplicados nas propostas.
              </p>
            </div>
          </div>
          <div className="settings-vendas-card-body">
            <div className="settings-subsection">
              <h4 className="settings-subheading">Custos de referência</h4>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Custo técnico de implantação (R$)',
                    'Valor interno estimado da implantação da usina (ex-CAPEX). Utilizado apenas para controle de margem.',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={custoImplantacaoReferencia ?? ''}
                    onChange={(event) => handleCustoImplantacaoReferenciaInput(event.target.value)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
              </div>
            </div>

            <div className="settings-subsection">
              <h4 className="settings-subheading">Parâmetros padrão de preço e margem</h4>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Margem operacional padrão (%)',
                    'Percentual aplicado sobre o CAPEX base somado ao valor do orçamento quando a margem está automática.',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    max={80}
                    step="0.1"
                    value={vendasConfig.margem_operacional_padrao_percent}
                    onChange={(event) => {
                      const parsed = parseNumericInput(event.target.value)
                      updateVendasConfig({
                        margem_operacional_padrao_percent: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                      })
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Preço mínimo (% sobre CAPEX)',
                    'Percentual mínimo aplicado ao CAPEX base para validar a proposta.',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={vendasConfig.preco_minimo_percent_sobre_capex}
                    onChange={(event) => {
                      const parsed = parseNumericInput(event.target.value)
                      updateVendasConfig({
                        preco_minimo_percent_sobre_capex: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                      })
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
              </div>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Arredondamento da venda',
                    'Passo utilizado para arredondar o valor final da proposta.',
                  )}
                >
                  <select
                    value={vendasConfig.arredondar_venda_para}
                    onChange={(event) =>
                      updateVendasConfig({
                        arredondar_venda_para: event.target.value as '1' | '10' | '50' | '100',
                      })
                    }
                  >
                    <option value="1">R$ 1</option>
                    <option value="10">R$ 10</option>
                    <option value="50">R$ 50</option>
                    <option value="100">R$ 100</option>
                  </select>
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Incluir impostos no CAPEX',
                    'Quando ativo, soma impostos retidos e do regime ao CAPEX considerado nas análises.',
                  )}
                >
                  <label className="inline-checkbox flex items-center gap-2">
                    <CheckboxSmall
                      checked={vendasConfig.incluirImpostosNoCAPEX_default}
                      onChange={(event) =>
                        updateVendasConfig({ incluirImpostosNoCAPEX_default: event.target.checked })
                      }
                    />
                    <span>Somar impostos ao CAPEX base.</span>
                  </label>
                </Field>
              </div>
            </div>
            <div className="settings-subsection">
              <h4 className="settings-subheading">Resumo do cálculo</h4>
              <p className="muted">
                Valores consolidados da proposta atual. Ajuste o CAPEX base ou a margem manual para recalcular
                automaticamente as demais métricas.
              </p>
              <div className="grid g3">
                <Field label="CAPEX base">
                  <input
                    ref={capexBaseResumoSettingsField.ref}
                    type="text"
                    inputMode="decimal"
                    value={capexBaseResumoSettingsField.text}
                    onChange={capexBaseResumoSettingsField.handleChange}
                    onBlur={() => {
                      capexBaseResumoSettingsField.handleBlur()
                      capexBaseResumoSettingsField.setText(formatMoneyBR(capexBaseResumoValor))
                    }}
                    onFocus={(event) => {
                      capexBaseResumoSettingsField.handleFocus(event)
                      selectNumberInputOnFocus(event)
                    }}
                    placeholder={
                      typeof capexBaseManualValor === 'number'
                        ? MONEY_INPUT_PLACEHOLDER
                        : 'Automático (calculado)'
                    }
                  />
                </Field>
                <Field label="Margem operacional (R$)">
                  <input
                    ref={margemOperacionalResumoSettingsField.ref}
                    type="text"
                    inputMode="decimal"
                    value={margemOperacionalResumoSettingsField.text}
                    onChange={margemOperacionalResumoSettingsField.handleChange}
                    onBlur={() => margemOperacionalResumoSettingsField.handleBlur()}
                    onFocus={(event) => {
                      margemOperacionalResumoSettingsField.handleFocus(event)
                      selectNumberInputOnFocus(event)
                    }}
                    placeholder={
                      margemManualAtiva ? MONEY_INPUT_PLACEHOLDER : 'Automático (padrão)'
                    }
                  />
                </Field>
                <Field label="Comissão líquida (R$)">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.comissao_liquida_valor)} />
                </Field>
              </div>
              <div className="grid g3">
                <Field label="Imposto retido (R$)">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.imposto_retido_valor)} />
                </Field>
                <Field label="Impostos do regime (R$)">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.impostos_regime_valor)} />
                </Field>
                <Field label="Impostos totais (R$)">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.impostos_totais_valor)} />
                </Field>
              </div>
              <div className="grid g3">
                <Field label="CAPEX considerado">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.capex_total)} />
                </Field>
                <Field label="Venda total (bruta)">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.venda_total)} />
                </Field>
                <Field label="Venda líquida">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.venda_liquida)} />
                </Field>
              </div>
              <div className="grid g3">
                <Field label="Descontos comerciais (R$)">
                  <input type="text" readOnly value={currencyValue(descontoValor)} />
                </Field>
                <Field label="Preço mínimo (R$)">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.preco_minimo)} />
                </Field>
                <Field label="Venda sem guardrails (R$)">
                  <input
                    type="text"
                    readOnly
                    value={currencyValue(calculoAtual?.venda_total_sem_guardrails)}
                  />
                </Field>
              </div>
              <div className="grid g3">
                <Field label="Ajuste por arredondamento (R$)">
                  <input type="text" readOnly value={currencyValue(calculoAtual?.arredondamento_aplicado)} />
                </Field>
                <Field label="Desconto aplicado (%)">
                  <input type="text" readOnly value={percentValue(calculoAtual?.desconto_percentual)} />
                </Field>
                <Field label="Aprovação necessária?">
                  <input type="text" readOnly value={aprovacaoLabel} />
                </Field>
              </div>
              <div className="grid g3">
                <Field label="Preço mínimo aplicado?">
                  <input type="text" readOnly value={precoMinimoAplicadoLabel} />
                </Field>
                <Field label="Workflow de aprovação">
                  <input type="text" readOnly value={workflowStatusLabel} />
                </Field>
              </div>
            </div>
            <div className="settings-subsection">
              <h4 className="settings-subheading">
                Detalhamento do regime tributário (
                {REGIME_TRIBUTARIO_LABELS[vendasConfig.regime_tributario_default] ?? ''}
                )
              </h4>
              {regimeBreakdown.length ? (
                <div className="grid g3">
                  {regimeBreakdown.map((item) => (
                    <Field
                      key={item.nome}
                      label={`${item.nome} (${formatNumberBRWithOptions(item.aliquota, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}%)`}
                    >
                      <input type="text" readOnly value={currencyValue(item.valor)} />
                    </Field>
                  ))}
                </div>
              ) : (
                <p className="muted">Sem impostos adicionais para o regime selecionado.</p>
              )}
            </div>
          </div>
        </section>

        <section className="settings-vendas-card config-card">
          <div className="settings-vendas-card-header">
            <div>
              <h3>Comercial &amp; aprovação</h3>
              <p className="settings-vendas-card-description">
                Defina incentivos do time comercial e limites para o fluxo de aprovação.
              </p>
            </div>
          </div>
          <div className="settings-vendas-card-body">
            <div className="settings-subsection">
              <h4 className="settings-subheading">Comissão &amp; incentivos</h4>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Tipo de comissão padrão',
                    'Defina se a comissão é aplicada como valor em reais ou percentual sobre a base selecionada.',
                  )}
                >
                  <select
                    value={vendasConfig.comissao_default_tipo}
                    onChange={(event) =>
                      updateVendasConfig({
                        comissao_default_tipo: event.target.value as 'valor' | 'percentual',
                      })
                    }
                  >
                    <option value="percentual">Percentual</option>
                    <option value="valor">Valor absoluto</option>
                  </select>
                </Field>
                <Field label={comissaoDefaultLabel}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={vendasConfig.comissao_default_percent}
                    onChange={(event) => {
                      const parsed = parseNumericInput(event.target.value)
                      updateVendasConfig({
                        comissao_default_percent: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                      })
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Base do percentual de comissão',
                    'Escolha se a comissão percentual incide sobre a venda total ou sobre a venda líquida.',
                  )}
                >
                  <select
                    value={vendasConfig.comissao_percent_base}
                    onChange={(event) =>
                      updateVendasConfig({
                        comissao_percent_base: event.target.value as 'venda_total' | 'venda_liquida',
                      })
                    }
                  >
                    <option value="venda_total">Venda total</option>
                    <option value="venda_liquida">Venda líquida</option>
                  </select>
                </Field>
              </div>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Bônus de indicação (%)',
                    'Percentual adicional reservado para indicações comerciais.',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={vendasConfig.bonus_indicacao_percent}
                    onChange={(event) => {
                      const parsed = parseNumericInput(event.target.value)
                      updateVendasConfig({
                        bonus_indicacao_percent: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                      })
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Teto de comissão (%)',
                    'Limite máximo aplicado quando a comissão for percentual.',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={vendasConfig.teto_comissao_percent}
                    onChange={(event) => {
                      const parsed = parseNumericInput(event.target.value)
                      updateVendasConfig({
                        teto_comissao_percent: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                      })
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
              </div>
            </div>

            <div className="settings-subsection">
              <h4 className="settings-subheading">Descontos &amp; aprovação</h4>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Desconto máximo sem aprovação (%)',
                    'Percentual de desconto permitido antes de acionar o workflow de aprovação.',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={vendasConfig.desconto_max_percent_sem_aprovacao}
                    onChange={(event) => {
                      const parsed = parseNumericInput(event.target.value)
                      updateVendasConfig({
                        desconto_max_percent_sem_aprovacao: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                      })
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field label="Workflow de aprovação ativo">
                  <label className="inline-checkbox flex items-center gap-2">
                    <CheckboxSmall
                      checked={vendasConfig.workflow_aprovacao_ativo}
                      onChange={(event) =>
                        updateVendasConfig({ workflow_aprovacao_ativo: event.target.checked })
                      }
                    />
                    <span>Exigir aprovação para descontos acima do limite.</span>
                  </label>
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Validade padrão da proposta (dias)',
                    'Quantidade de dias utilizada como validade padrão nas propostas geradas.',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={vendasConfig.validade_proposta_dias}
                    onChange={(event) => {
                      const parsed = parseNumericInput(event.target.value)
                      const normalizado = Number.isFinite(parsed ?? NaN)
                        ? Math.max(0, Math.floor(Number(parsed)))
                        : 0
                      updateVendasConfig({ validade_proposta_dias: normalizado })
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
              </div>
              <Field label="Aprovadores" hint={aprovadoresHint}>
                <textarea
                  rows={3}
                  value={aprovadoresText}
                  onChange={(event) => setAprovadoresText(event.target.value)}
                  onBlur={handleAprovadoresBlur}
                />
              </Field>
            </div>
          </div>
        </section>
      </div>

      <section className="settings-vendas-card config-card settings-vendas-card--full">
        <div className="settings-vendas-card-header">
          <div>
            <h3>Tributação</h3>
            <p className="settings-vendas-card-description">
              Ajuste presets fiscais e personalize alíquotas conforme o regime tributário utilizado nas propostas.
            </p>
          </div>
        </div>
        <div className="settings-vendas-card-body">
          <div className="settings-subsection">
            <h4 className="settings-subheading">Configurações padrão</h4>
            <div className="grid g3">
              <Field
                label={labelWithTooltip(
                  'Regime tributário padrão',
                  'Preset fiscal aplicado por padrão nos cálculos comerciais.',
                )}
              >
                <select
                  value={vendasConfig.regime_tributario_default}
                  onChange={(event) =>
                    updateVendasConfig({
                      regime_tributario_default: event.target.value as RegimeTributario,
                    })
                  }
                >
                  <option value="simples">Simples nacional</option>
                  <option value="lucro_presumido">Lucro presumido</option>
                  <option value="lucro_real">Lucro real</option>
                </select>
              </Field>
              <Field
                label={labelWithTooltip(
                  'Imposto retido padrão (%)',
                  'Percentual de impostos retidos na fonte aplicado sobre a venda total.',
                )}
              >
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={vendasConfig.imposto_retido_aliquota_default}
                  onChange={(event) => {
                    const parsed = parseNumericInput(event.target.value)
                    updateVendasConfig({
                      imposto_retido_aliquota_default: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                    })
                  }}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field label="Mostrar quebra de impostos no PDF">
                <label className="inline-checkbox flex items-center gap-2">
                  <CheckboxSmall
                    checked={vendasConfig.mostrar_quebra_impostos_no_pdf_cliente}
                    onChange={(event) =>
                      updateVendasConfig({
                        mostrar_quebra_impostos_no_pdf_cliente: event.target.checked,
                      })
                    }
                  />
                  <span>Exibir detalhamento dos impostos para o cliente.</span>
                </label>
              </Field>
            </div>
          </div>

          {regimes.map((regime) => {
            const lista = impostosOverridesDraft[regime] ?? []
            const label = REGIME_TRIBUTARIO_LABELS[regime] ?? regime
            return (
              <div key={regime} className="settings-subsection settings-vendas-overrides">
                <div className="table-controls settings-vendas-overrides-header">
                  <span className="muted">Overrides — {label}</span>
                  <div>
                    <button type="button" className="ghost" onClick={() => handleOverrideAdd(regime)}>
                      Adicionar imposto
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleResetOverrides(regime)}
                      disabled={lista.length === 0}
                    >
                      Restaurar preset
                    </button>
                  </div>
                </div>
                {lista.length ? (
                  lista.map((item, index) => (
                    <div key={`${regime}-${index}`} className="grid g3">
                      <Field label="Nome do imposto">
                        <input
                          type="text"
                          value={item.nome ?? ''}
                          onChange={(event) =>
                            handleOverrideFieldChange(regime, index, 'nome', event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Alíquota (%)">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={Number.isFinite(item.aliquota_percent) ? Number(item.aliquota_percent) : 0}
                          onChange={(event) =>
                            handleOverrideFieldChange(regime, index, 'aliquota_percent', event.target.value)
                          }
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <div className="field">
                        <label>&nbsp;</label>
                        <button
                          type="button"
                          className="ghost danger"
                          onClick={() => handleOverrideRemove(regime, index)}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Sem overrides — usando preset padrão.</p>
                )}
              </div>
            )
          })}
          <div className="table-controls settings-vendas-overrides-actions">
            <button type="button" className="primary" onClick={handleApplyOverrides}>
              Aplicar overrides
            </button>
          </div>
        </div>
      </section>

      <section className="settings-vendas-card config-card settings-vendas-card--full">
        <div className="settings-vendas-card-header">
          <div>
            <h3>Exibição no PDF (cliente)</h3>
            <p className="settings-vendas-card-description">
              Personalize as informações exibidas para o cliente nas propostas geradas.
            </p>
          </div>
        </div>
        <div className="settings-vendas-card-body">
          <div className="grid g3">
            <Field label="Exibir preços unitários">
              <label className="inline-checkbox flex items-center gap-2">
                <CheckboxSmall
                  checked={vendasConfig.exibir_precos_unitarios}
                  onChange={(event) =>
                    updateVendasConfig({ exibir_precos_unitarios: event.target.checked })
                  }
                />
                <span>Mostrar valores unitários dos itens na proposta.</span>
              </label>
            </Field>
            <Field label="Exibir margem">
              <label className="inline-checkbox flex items-center gap-2">
                <CheckboxSmall
                  checked={vendasConfig.exibir_margem}
                  onChange={(event) => updateVendasConfig({ exibir_margem: event.target.checked })}
                />
                <span>Mostrar margem operacional no PDF.</span>
              </label>
            </Field>
            <Field label="Exibir comissão">
              <label className="inline-checkbox flex items-center gap-2">
                <CheckboxSmall
                  checked={vendasConfig.exibir_comissao}
                  onChange={(event) => updateVendasConfig({ exibir_comissao: event.target.checked })}
                />
                <span>Exibir comissão líquida para o cliente.</span>
              </label>
            </Field>
            <Field label="Exibir impostos">
              <label className="inline-checkbox flex items-center gap-2">
                <CheckboxSmall
                  checked={vendasConfig.exibir_impostos}
                  onChange={(event) => updateVendasConfig({ exibir_impostos: event.target.checked })}
                />
                <span>Mostrar valores de impostos no PDF.</span>
              </label>
            </Field>
          </div>
          <Field label="Observação padrão da proposta">
            <textarea
              rows={4}
              value={vendasConfig.observacao_padrao_proposta}
              onChange={(event) =>
                updateVendasConfig({ observacao_padrao_proposta: event.target.value })
              }
            />
          </Field>
        </div>
      </section>
    </div>
  )
}
