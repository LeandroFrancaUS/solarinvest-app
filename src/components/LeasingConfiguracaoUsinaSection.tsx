// src/components/LeasingConfiguracaoUsinaSection.tsx
// "Configuração da UF" card shown in the leasing tab.
// Pure presentational component; all state and handlers remain in App.tsx.

import * as React from 'react'
import { InfoTooltip, labelWithTooltip } from './InfoTooltip'
import { Field } from './ui/Field'
import { CheckboxSmall } from './CheckboxSmall'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'
import { formatNumberBRWithOptions } from '../lib/locale/br-number'
import { PAINEL_OPCOES } from '../app/config'
import { TIPOS_REDE } from '../constants/instalacao'
import type { TipoRede } from '../shared/rede'
import type { VendaForm } from '../lib/finance/roi'
import type { EstruturaUtilizadaTipoWarning } from '../lib/pdf/extractVendas'

export type NormComplianceBanner = {
  tone: string
  title: string
  statusLabel: string
  message: string
  details: string[]
}

export type LeasingConfiguracaoUsinaSectionProps = {
  configuracaoUsinaObservacoesExpanded: boolean
  configuracaoUsinaObservacoesLeasingContainerId: string
  setConfiguracaoUsinaObservacoesExpanded: React.Dispatch<React.SetStateAction<boolean>>
  configuracaoUsinaObservacoes: string
  configuracaoUsinaObservacoesLeasingId: string
  setConfiguracaoUsinaObservacoes: (value: string) => void
  normComplianceBanner: NormComplianceBanner
  normComplianceStatus: string | undefined
  precheckClienteCiente: boolean
  setPrecheckClienteCiente: (value: boolean) => void
  potenciaModulo: number
  setPotenciaModuloDirty: (value: boolean) => void
  setPotenciaModulo: (value: number) => void
  numeroModulosManual: number | ''
  numeroModulosEstimado: number
  moduleQuantityInputRef: React.RefObject<HTMLInputElement | null>
  setNumeroModulosManual: (value: number | '') => void
  tipoRede: TipoRede
  handleTipoRedeSelection: (value: TipoRede) => void
  potenciaFonteManual: boolean
  vendaForm: VendaForm
  potenciaInstaladaKwp: number
  handlePotenciaInstaladaChange: (value: string) => void
  geracaoMensalKwh: number
  areaInstalacao: number
  tipoRedeCompatMessage: string
  estruturaTipoWarning: EstruturaUtilizadaTipoWarning | null
  handleMissingInfoUploadClick: () => void
  inverterModelInputRef: React.RefObject<HTMLInputElement | null>
  applyVendaUpdates: (updates: Partial<VendaForm>) => void
  geracaoDiariaKwh: number
}

export function LeasingConfiguracaoUsinaSection({
  configuracaoUsinaObservacoesExpanded,
  configuracaoUsinaObservacoesLeasingContainerId,
  setConfiguracaoUsinaObservacoesExpanded,
  configuracaoUsinaObservacoes,
  configuracaoUsinaObservacoesLeasingId,
  setConfiguracaoUsinaObservacoes,
  normComplianceBanner,
  normComplianceStatus,
  precheckClienteCiente,
  setPrecheckClienteCiente,
  potenciaModulo,
  setPotenciaModuloDirty,
  setPotenciaModulo,
  numeroModulosManual,
  numeroModulosEstimado,
  moduleQuantityInputRef,
  setNumeroModulosManual,
  tipoRede,
  handleTipoRedeSelection,
  potenciaFonteManual,
  vendaForm,
  potenciaInstaladaKwp,
  handlePotenciaInstaladaChange,
  geracaoMensalKwh,
  areaInstalacao,
  tipoRedeCompatMessage,
  estruturaTipoWarning,
  handleMissingInfoUploadClick,
  inverterModelInputRef,
  applyVendaUpdates,
  geracaoDiariaKwh,
}: LeasingConfiguracaoUsinaSectionProps) {
  return (
    <section className="card configuracao-usina-card">
      <div className="configuracao-usina-card__header">
        <h2>Configuração da UF</h2>
        <button
          type="button"
          className="configuracao-usina-card__toggle"
          aria-expanded={configuracaoUsinaObservacoesExpanded}
          aria-controls={configuracaoUsinaObservacoesLeasingContainerId}
          onClick={() =>
            setConfiguracaoUsinaObservacoesExpanded((previous) => !previous)
          }
        >
          {configuracaoUsinaObservacoesExpanded
            ? 'Ocultar observações'
            : configuracaoUsinaObservacoes.trim()
            ? 'Editar observações'
            : 'Adicionar observações'}
        </button>
      </div>
      <div className={`norm-precheck-banner norm-precheck-banner--${normComplianceBanner.tone}`}>
        <div className="norm-precheck-banner__header">
          <strong>{normComplianceBanner.title}</strong>
          <span className="norm-precheck-banner__status">{normComplianceBanner.statusLabel}</span>
        </div>
        <p>{normComplianceBanner.message}</p>
        {normComplianceBanner.details.length > 0 ? (
          <ul>
            {normComplianceBanner.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
        {normComplianceStatus === 'FORA_DA_NORMA' ? (
          <label className="norm-precheck-banner__ack flex items-center gap-3">
            <CheckboxSmall
              checked={precheckClienteCiente}
              onChange={(event) => setPrecheckClienteCiente(event.target.checked)}
            />
            <span>Cliente ciente e fará adequação do padrão.</span>
          </label>
        ) : null}
      </div>
      <div
        id={configuracaoUsinaObservacoesLeasingContainerId}
        className="configuracao-usina-card__observacoes"
        hidden={!configuracaoUsinaObservacoesExpanded}
      >
        <label className="configuracao-usina-card__observacoes-label" htmlFor={configuracaoUsinaObservacoesLeasingId}>
          Observações
        </label>
        <textarea
          id={configuracaoUsinaObservacoesLeasingId}
          value={configuracaoUsinaObservacoes}
          onChange={(event) => setConfiguracaoUsinaObservacoes(event.target.value)}
          placeholder="Inclua observações relevantes sobre a configuração da usina"
          rows={3}
        />
      </div>
      <div className="grid g4">
        <Field
          label={labelWithTooltip(
            'Potência do módulo (Wp)',
            'Potência nominal de cada módulo fotovoltaico; usada na conversão kWp = (módulos × Wp) ÷ 1000.',
          )}
        >
          <select
            value={potenciaModulo}
            onChange={(event) => {
              setPotenciaModuloDirty(true)
              const parsed = Number(event.target.value)
              const potenciaSelecionada = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setPotenciaModulo(potenciaSelecionada)
            }}
          >
            {PAINEL_OPCOES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Nº de módulos (estimado)',
            'Quantidade de módulos utilizada no dimensionamento. Estimativa = ceil(Consumo alvo ÷ (Irradiação × Eficiência × dias) × 1000 ÷ Potência do módulo).',
          )}
        >
          <input
            type="number"
            min={0}
            step={1}
            ref={moduleQuantityInputRef}
            value={
              numeroModulosManual === ''
                ? numeroModulosEstimado > 0
                  ? numeroModulosEstimado
                  : 0
                : numeroModulosManual
            }
            onChange={(event) => {
              const { value } = event.target
              if (value === '') {
                setNumeroModulosManual('')
                return
              }
              const parsed = Number(value)
              if (!Number.isFinite(parsed) || parsed <= 0) {
                setNumeroModulosManual('')
                return
              }
              const inteiro = Math.max(1, Math.round(parsed))
              setNumeroModulosManual(inteiro)
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Tipo de rede',
            'Seleciona a rede do cliente para calcular o custo de disponibilidade (CID) padrão de 30/50/100 kWh e somá-lo às tarifas quando a taxa mínima estiver ativa.',
          )}
        >
          <select
            data-field="cliente-tipoRede"
            value={tipoRede}
            onChange={(event) => handleTipoRedeSelection(event.target.value as TipoRede)}
          >
            {TIPOS_REDE.map((rede) => (
              <option key={rede.value} value={rede.value}>
                {rede.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            <>
              Potência do sistema (kWp)
              <InfoTooltip text="Potência do sistema = (Nº de módulos × Potência do módulo) ÷ 1000. Sem entrada manual de módulos, estimamos por Consumo ÷ (Irradiação × Eficiência × 30 dias)." />
            </>
          }
        >
          <input
            type="number"
            min={0}
            step="0.01"
            value={
              potenciaFonteManual
                ? vendaForm.potencia_instalada_kwp ?? ''
                : potenciaInstaladaKwp || ''
            }
            onChange={(event) => handlePotenciaInstaladaChange(event.target.value)}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={
            <>
              Geração estimada (kWh/mês)
              <InfoTooltip text="Geração estimada = Potência do sistema × Irradiação média × Eficiência × 30 dias." />
            </>
          }
        >
          <input
            readOnly
            value={formatNumberBRWithOptions(geracaoMensalKwh, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Área utilizada (m²)',
            'Estimativa de área ocupada: Nº de módulos × fator (3,3 m² para telhado ou 7 m² para solo).',
          )}
        >
          <input
            readOnly
            value={
              areaInstalacao > 0
                ? formatNumberBRWithOptions(areaInstalacao, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })
                : ''
            }
          />
        </Field>
      </div>
      {tipoRedeCompatMessage ? (
        <div className="warning rede-compat-warning" role="alert">
          <strong>Incompatibilidade entre potência e rede.</strong> {tipoRedeCompatMessage}
        </div>
      ) : null}
      {estruturaTipoWarning ? (
        <div className="estrutura-warning-alert" role="alert">
          <div>
            <h3>Estrutura utilizada não identificada</h3>
            <p>
              Não foi possível extrair o campo <strong>Tipo</strong> da tabela{' '}
              <strong>Estrutura utilizada</strong> no documento enviado. Tente enviar um arquivo em outro formato.
            </p>
          </div>
          <div className="estrutura-warning-alert-actions">
            <button type="button" className="ghost" onClick={handleMissingInfoUploadClick}>
              Enviar outro arquivo
            </button>
          </div>
        </div>
      ) : null}
      <div className="grid g3">
        <Field
          label={labelWithTooltip(
            'Modelo do módulo',
            'Descrição comercial do módulo fotovoltaico utilizado na proposta.',
          )}
        >
          <input
            type="text"
            value={vendaForm.modelo_modulo ?? ''}
            onChange={(event) => applyVendaUpdates({ modelo_modulo: event.target.value || undefined })}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Modelo do inversor',
            'Modelo comercial do inversor responsável pela conversão CC/CA.',
          )}
        >
          <input
            type="text"
            ref={inverterModelInputRef}
            value={vendaForm.modelo_inversor ?? ''}
            onChange={(event) => applyVendaUpdates({ modelo_inversor: event.target.value || undefined })}
          />
        </Field>
      </div>
      <div className="info-inline">
        <span className="pill">
          <InfoTooltip text="Consumo diário estimado = Geração mensal ÷ 30 dias." />
          Consumo diário
          <strong>
            {`${formatNumberBRWithOptions(geracaoDiariaKwh, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} kWh`}
          </strong>
        </span>
      </div>
    </section>
  )
}
