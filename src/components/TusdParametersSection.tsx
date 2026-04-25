import { formatNumberBRWithOptions } from '../lib/locale/br-number'
import { DEFAULT_TUSD_ANO_REFERENCIA, TUSD_TIPO_LABELS } from '../lib/finance/tusd'
import type { TipoClienteTUSD } from '../lib/finance/tusd'
import { NOVOS_TIPOS_TUSD } from '../types/tipoBasico'
import type { SegmentoCliente } from '../lib/finance/roi'
import { currency } from '../utils/formatters'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'
import { CheckboxSmall } from './CheckboxSmall'
import { labelWithTooltip } from './InfoTooltip'
import { Field } from './ui/Field'

export interface TusdParametersSectionProps {
  tusdPercent: number
  tusdTipoCliente: TipoClienteTUSD
  tusdSubtipo: string
  tusdSimultaneidade: number | null
  tusdTarifaRkwh: number | null
  tusdAnoReferencia: number
  tusdOpcoesExpandidas: boolean
  segmentoCliente: SegmentoCliente
  tipoEdificacaoOutro: string
  tusdOptionsTitleId: string
  tusdOptionsToggleId: string
  tusdOptionsContentId: string
  onTusdPercentChange: (value: number) => void
  onTusdTipoClienteChange: (value: TipoClienteTUSD) => void
  onTusdSubtipoChange: (value: string) => void
  onTusdSimultaneidadeChange: (value: number | null) => void
  onTusdTarifaRkwhChange: (value: number | null) => void
  onTusdAnoReferenciaChange: (value: number) => void
  onTusdOpcoesExpandidasChange: (checked: boolean) => void
  onTipoEdificacaoOutroChange: (value: string) => void
}

export function TusdParametersSection({
  tusdPercent,
  tusdTipoCliente,
  tusdSubtipo,
  tusdSimultaneidade,
  tusdTarifaRkwh,
  tusdAnoReferencia,
  tusdOpcoesExpandidas,
  segmentoCliente,
  tipoEdificacaoOutro,
  tusdOptionsTitleId,
  tusdOptionsToggleId,
  tusdOptionsContentId,
  onTusdPercentChange,
  onTusdTipoClienteChange,
  onTusdSubtipoChange,
  onTusdSimultaneidadeChange,
  onTusdTarifaRkwhChange,
  onTusdAnoReferenciaChange,
  onTusdOpcoesExpandidasChange,
  onTipoEdificacaoOutroChange,
}: TusdParametersSectionProps) {
  const tusdPercentLabel = formatNumberBRWithOptions(tusdPercent, {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(tusdPercent) ? 0 : 2,
  })
  const resumoPartes: string[] = [
    `${tusdPercentLabel}% • ${TUSD_TIPO_LABELS[tusdTipoCliente]}`,
  ]
  const subtipoAtual = tusdSubtipo.trim()
  if (subtipoAtual !== '') {
    resumoPartes.push(subtipoAtual)
  }
  if (tusdSimultaneidade != null) {
    const simultaneidadeLabel = formatNumberBRWithOptions(tusdSimultaneidade, {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(tusdSimultaneidade) ? 0 : 2,
    })
    resumoPartes.push(`Simultaneidade ${simultaneidadeLabel}`)
  }
  if (tusdTarifaRkwh != null) {
    resumoPartes.push(`Tarifa ${currency(tusdTarifaRkwh)}/kWh`)
  }
  if (tusdAnoReferencia !== DEFAULT_TUSD_ANO_REFERENCIA) {
    resumoPartes.push(`Ano ${tusdAnoReferencia}`)
  }

  return (
    <section className="tusd-options" aria-labelledby={tusdOptionsTitleId}>
      <div className="tusd-options-header">
        <div className="tusd-options-title-row">
          <h3 id={tusdOptionsTitleId}>Opções de TUSD</h3>
          <label
            className="tusd-options-toggle flex items-center gap-2"
            htmlFor={tusdOptionsToggleId}
          >
            <CheckboxSmall
              id={tusdOptionsToggleId}
              checked={tusdOpcoesExpandidas}
              onChange={(event) => onTusdOpcoesExpandidasChange(event.target.checked)}
              aria-expanded={tusdOpcoesExpandidas}
              aria-controls={tusdOpcoesExpandidas ? tusdOptionsContentId : undefined}
            />
            <span className="tusd-options-toggle-indicator" aria-hidden="true" />
            <span className="tusd-options-toggle-text">
              {tusdOpcoesExpandidas ? 'Ocultar opções' : 'Exibir opções'}
            </span>
          </label>
        </div>
        <p className="tusd-options-description">
          Configuração atual: {resumoPartes.join(' • ')}
        </p>
      </div>
      {tusdOpcoesExpandidas ? (
        <div className="grid g3 tusd-options-grid" id={tusdOptionsContentId} aria-hidden={false}>
          <Field
            label={labelWithTooltip(
              'TUSD (%)',
              'Percentual do fio B aplicado sobre a energia compensada. Valores superiores a 1 são interpretados como percentuais (ex.: 27 = 27%).',
            )}
          >
            <input
              type="number"
              min={0}
              step="0.1"
              value={tusdPercent}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                onTusdPercentChange(normalized)
              }}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Tipo de cliente TUSD',
              'Categoria utilizada para determinar simultaneidade padrão e fator ano da TUSD.',
            )}
          >
            <select
              value={tusdTipoCliente}
              onChange={(event) =>
                onTusdTipoClienteChange(event.target.value as TipoClienteTUSD)
              }
            >
              {NOVOS_TIPOS_TUSD.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {(segmentoCliente === 'outros' || tusdTipoCliente === 'outros') && (
              <input
                type="text"
                placeholder="Descreva..."
                style={{ marginTop: '6px' }}
                value={tipoEdificacaoOutro}
                onChange={(event) => onTipoEdificacaoOutroChange(event.target.value)}
              />
            )}
          </Field>
          <Field
            label={labelWithTooltip(
              'Subtipo TUSD (opcional)',
              'Permite refinar a simultaneidade padrão conforme o perfil da unidade consumidora.',
            )}
          >
            <input
              type="text"
              value={tusdSubtipo}
              onChange={(event) => {
                onTusdSubtipoChange(event.target.value)
              }}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Simultaneidade (%)',
              'Percentual de consumo instantâneo considerado na TUSD. Informe em fração (0-1) ou percentual (0-100).',
            )}
          >
            <input
              type="number"
              min={0}
              step="0.1"
              value={tusdSimultaneidade ?? ''}
              onChange={(event) => {
                const { value } = event.target
                if (value === '') {
                  onTusdSimultaneidadeChange(null)
                } else {
                  const parsed = Number(value)
                  const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                  onTusdSimultaneidadeChange(normalized)
                }
              }}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'TUSD informado (R$/kWh)',
              'Informe o valor em R$/kWh quando desejar substituir o percentual por uma tarifa fixa de TUSD.',
            )}
          >
            <input
              type="number"
              min={0}
              step="0.001"
              value={tusdTarifaRkwh ?? ''}
              onChange={(event) => {
                const { value } = event.target
                if (value === '') {
                  onTusdTarifaRkwhChange(null)
                } else {
                  const parsed = Number(value)
                  const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                  onTusdTarifaRkwhChange(normalized)
                }
              }}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Ano de referência TUSD',
              'Define o ano-base para aplicar o fator de escalonamento da TUSD conforme a Lei 14.300.',
            )}
          >
            <input
              type="number"
              min={2000}
              step="1"
              value={tusdAnoReferencia}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                const normalized = Number.isFinite(parsed)
                  ? Math.max(1, Math.trunc(parsed))
                  : DEFAULT_TUSD_ANO_REFERENCIA
                onTusdAnoReferenciaChange(normalized)
              }}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
        </div>
      ) : null}
    </section>
  )
}
