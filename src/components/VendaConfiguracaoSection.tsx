// src/components/VendaConfiguracaoSection.tsx
// "Configuração da UF" card shown in the vendas tab (manual budget mode).
// Pure presentational component; all state and handlers remain in App.tsx.

import * as React from 'react'
import { InfoTooltip, labelWithTooltip } from './InfoTooltip'
import { Field } from './ui/Field'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'
import { formatNumberBRWithOptions } from '../lib/locale/br-number'
import { PAINEL_OPCOES } from '../app/config'
import { TIPOS_INSTALACAO, TIPOS_REDE } from '../constants/instalacao'
import type { TipoInstalacao } from '../shared/ufvComposicao'
import type { TipoRede } from '../shared/rede'
import type { TipoSistema, VendaForm } from '../lib/finance/roi'
import type { EstruturaUtilizadaTipoWarning } from '../lib/pdf/extractVendas'

export type VendaConfiguracaoSectionProps = {
  configuracaoUsinaObservacoesExpanded: boolean
  configuracaoUsinaObservacoesVendaContainerId: string
  setConfiguracaoUsinaObservacoesExpanded: React.Dispatch<React.SetStateAction<boolean>>
  configuracaoUsinaObservacoes: string
  configuracaoUsinaObservacoesVendaId: string
  setConfiguracaoUsinaObservacoes: (value: string) => void
  potenciaModulo: number
  setPotenciaModuloDirty: (value: boolean) => void
  setPotenciaModulo: (value: number) => void
  numeroModulosManual: number | ''
  numeroModulosEstimado: number
  moduleQuantityInputRef: React.RefObject<HTMLInputElement | null>
  setNumeroModulosManual: (value: number | '') => void
  applyVendaUpdates: (updates: Partial<VendaForm>) => void
  tipoInstalacao: TipoInstalacao
  handleTipoInstalacaoChange: (value: TipoInstalacao) => void
  tipoSistema: TipoSistema
  handleTipoSistemaChange: (value: TipoSistema) => void
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
  geracaoDiariaKwh: number
}

export function VendaConfiguracaoSection({
  configuracaoUsinaObservacoesExpanded,
  configuracaoUsinaObservacoesVendaContainerId,
  setConfiguracaoUsinaObservacoesExpanded,
  configuracaoUsinaObservacoes,
  configuracaoUsinaObservacoesVendaId,
  setConfiguracaoUsinaObservacoes,
  potenciaModulo,
  setPotenciaModuloDirty,
  setPotenciaModulo,
  numeroModulosManual,
  numeroModulosEstimado,
  moduleQuantityInputRef,
  setNumeroModulosManual,
  applyVendaUpdates,
  tipoInstalacao,
  handleTipoInstalacaoChange,
  tipoSistema,
  handleTipoSistemaChange,
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
  geracaoDiariaKwh,
}: VendaConfiguracaoSectionProps) {
  return (
    <section className="card configuracao-usina-card">
      <div className="configuracao-usina-card__header">
        <h2>Configuração da UF</h2>
        <button
          type="button"
          className="configuracao-usina-card__toggle"
          aria-expanded={configuracaoUsinaObservacoesExpanded}
          aria-controls={configuracaoUsinaObservacoesVendaContainerId}
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
      <div
        id={configuracaoUsinaObservacoesVendaContainerId}
        className="configuracao-usina-card__observacoes"
        hidden={!configuracaoUsinaObservacoesExpanded}
      >
        <label className="configuracao-usina-card__observacoes-label" htmlFor={configuracaoUsinaObservacoesVendaId}>
          Observações
        </label>
        <textarea
          id={configuracaoUsinaObservacoesVendaId}
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
              <option key={opt} value={opt}>
                {opt}
              </option>
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
            ref={moduleQuantityInputRef as React.RefObject<HTMLInputElement>}
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
                applyVendaUpdates({ quantidade_modulos: undefined })
                return
              }
              const parsed = Number(value)
              if (!Number.isFinite(parsed) || parsed <= 0) {
                setNumeroModulosManual('')
                applyVendaUpdates({ quantidade_modulos: undefined })
                return
              }
              const inteiro = Math.max(1, Math.round(parsed))
              setNumeroModulosManual(inteiro)
              applyVendaUpdates({ quantidade_modulos: inteiro })
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Tipo de instalação',
            'Selecione entre Telhado de fibrocimento, Telhas metálicas, Telhas cerâmicas, Laje, Solo ou Outros (texto); a escolha impacta área estimada e custos de estrutura.',
          )}
        >
          <select
            value={tipoInstalacao}
            onChange={(event) =>
              handleTipoInstalacaoChange(event.target.value as TipoInstalacao)
            }
          >
            {TIPOS_INSTALACAO.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Tipo de sistema',
            'Escolha entre on-grid, híbrido ou off-grid para registrar a topologia elétrica da proposta.',
          )}
        >
          <select
            value={tipoSistema}
            onChange={(event) => handleTipoSistemaChange(event.target.value as TipoSistema)}
          >
            <option value="ON_GRID">On-grid</option>
            <option value="HIBRIDO">Híbrido</option>
            <option value="OFF_GRID">Off-grid</option>
          </select>
        </Field>
          <Field
            label={labelWithTooltip(
              'Tipo de rede',
              'Seleciona a rede do cliente para calcular o custo de disponibilidade (CID) padrão de 30/50/100 kWh e somá-lo às tarifas quando a taxa mínima estiver ativa.',
            )}
          >
            <select
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
            ref={inverterModelInputRef as React.RefObject<HTMLInputElement>}
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
