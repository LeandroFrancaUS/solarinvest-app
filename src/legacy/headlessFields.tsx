/**
 * Headless Fields Extraction
 * 
 * This module extracts field components from the legacy UI without their container styles,
 * making them reusable in the V8 Flow wizard. Each export renders only the input fields
 * and their immediate labels, without Card, Section, or other legacy wrappers.
 */

import React, { useId } from 'react'
import { labelWithTooltip, InfoTooltip } from '../components/InfoTooltip'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'
import type { ClienteDados } from '../types/printableProposal'

// Simple clear highlight helper
const clearFieldHighlight = (element?: HTMLElement | null) => {
  if (!element) return
  element.classList.remove('invalid')
  element.removeAttribute('aria-invalid')
}

// Simple Field component for V8 flow (extracted from App.tsx logic)
function Field({
  label,
  children,
  hint,
}: {
  label: React.ReactNode
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="v8-field">
      <label className="v8-field-label">{label}</label>
      <div>{children}</div>
      {hint && <small style={{ fontSize: '12px', color: 'var(--v8-text-secondary)' }}>{hint}</small>}
    </div>
  )
}

// Re-export Field component for convenience
export { Field }

/**
 * Cliente Fields (Step 1)
 * Basic client information fields
 */
export interface ClienteFieldsProps {
  cliente: {
    nome: string
    documento: string
    email: string
    telefone: string
    cep: string
    endereco: string
    cidade: string
    uf: string
  }
  segmentoCliente: string
  onClienteChange: <K extends keyof ClienteDados>(key: K, value: ClienteDados[K]) => void
}

export function ClienteFields({ cliente, segmentoCliente, onClienteChange }: ClienteFieldsProps) {
  const isCondominio = segmentoCliente === 'CONDOMINIO'
  
  return (
    <>
      <Field
        label={labelWithTooltip(
          'Nome ou Razão social',
          'Identificação oficial do cliente utilizada em contratos, relatórios e integração com o CRM. Para empresas, informar a Razão Social.',
        )}
      >
        <input
          data-field="nomeCliente"
          value={cliente.nome}
          onChange={(e) => {
            onClienteChange('nome', e.target.value)
            clearFieldHighlight(e.currentTarget)
          }}
          className="v8-field-input"
        />
      </Field>

      <Field
        label={labelWithTooltip(
          'CPF/CNPJ',
          'Documento fiscal do titular da unidade consumidora. Para pessoa física: CPF. Para pessoa jurídica: CNPJ.',
        )}
      >
        <input
          data-field="cpfCnpj"
          value={cliente.documento}
          onChange={(e) => {
            onClienteChange('documento', e.target.value)
            clearFieldHighlight(e.currentTarget)
          }}
          inputMode="numeric"
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          className="v8-field-input"
        />
      </Field>

      <Field
        label={labelWithTooltip(
          'E-mail',
          'E-mail principal do cliente para envio de propostas, contratos e comunicações.',
        )}
      >
        <input
          data-field="email"
          type="email"
          value={cliente.email}
          onChange={(e) => {
            onClienteChange('email', e.target.value)
            clearFieldHighlight(e.currentTarget)
          }}
          placeholder="cliente@exemplo.com"
          className="v8-field-input"
        />
      </Field>

      <Field
        label={labelWithTooltip(
          'Telefone',
          'Telefone de contato do cliente (fixo ou celular com WhatsApp).',
        )}
      >
        <input
          data-field="telefone"
          type="tel"
          value={cliente.telefone}
          onChange={(e) => onClienteChange('telefone', e.target.value)}
          placeholder="(00) 00000-0000"
          className="v8-field-input"
        />
      </Field>

      <Field label="Endereço">
        <input
          data-field="endereco"
          value={cliente.endereco}
          onChange={(e) => onClienteChange('endereco', e.target.value)}
          placeholder="Rua, Avenida, número, etc."
          className="v8-field-input"
        />
      </Field>

      <Field label="CEP">
        <input
          data-field="cep"
          value={cliente.cep}
          onChange={(e) => onClienteChange('cep', e.target.value)}
          placeholder="00000-000"
          className="v8-field-input"
        />
      </Field>

      <Field label="Cidade">
        <input
          data-field="cidade"
          value={cliente.cidade}
          onChange={(e) => onClienteChange('cidade', e.target.value)}
          className="v8-field-input"
        />
      </Field>

      <Field label="UF">
        <select
          data-field="uf"
          value={cliente.uf}
          onChange={(e) => onClienteChange('uf', e.target.value)}
          className="v8-field-select"
        >
          <option value="">Selecione</option>
          <option value="AC">AC</option>
          <option value="AL">AL</option>
          <option value="AP">AP</option>
          <option value="AM">AM</option>
          <option value="BA">BA</option>
          <option value="CE">CE</option>
          <option value="DF">DF</option>
          <option value="ES">ES</option>
          <option value="GO">GO</option>
          <option value="MA">MA</option>
          <option value="MT">MT</option>
          <option value="MS">MS</option>
          <option value="MG">MG</option>
          <option value="PA">PA</option>
          <option value="PB">PB</option>
          <option value="PR">PR</option>
          <option value="PE">PE</option>
          <option value="PI">PI</option>
          <option value="RJ">RJ</option>
          <option value="RN">RN</option>
          <option value="RS">RS</option>
          <option value="RO">RO</option>
          <option value="RR">RR</option>
          <option value="SC">SC</option>
          <option value="SP">SP</option>
          <option value="SE">SE</option>
          <option value="TO">TO</option>
        </select>
      </Field>
    </>
  )
}

/**
 * Consumo & Tarifa Fields (Step 2)
 * Energy consumption and tariff parameters
 */
export interface ConsumoTarifaFieldsProps {
  kcKwhMes: number
  tarifaCheia: number
  taxaMinima: number
  encargosFixosExtras: number
  ufTarifa: string
  distribuidoraTarifa: string
  irradiacaoMedia: number
  ufsDisponiveis: string[]
  distribuidorasDisponiveis: string[]
  ufLabels: Record<string, string>
  onKcKwhMesChange: (value: number) => void
  onTarifaCheiaChange: (value: number) => void
  onTaxaMinimaChange: (value: string) => void
  onEncargosFixosExtrasChange: (value: number) => void
  onUfChange: (uf: string) => void
  onDistribuidoraChange: (dist: string) => void
  onIrradiacaoMediaChange: (value: number) => void
  taxaMinimaInputEmpty?: boolean | undefined
}

export function ConsumoTarifaFields({
  kcKwhMes,
  tarifaCheia,
  taxaMinima,
  encargosFixosExtras,
  ufTarifa,
  distribuidoraTarifa,
  irradiacaoMedia,
  ufsDisponiveis,
  distribuidorasDisponiveis,
  ufLabels,
  onKcKwhMesChange,
  onTarifaCheiaChange,
  onTaxaMinimaChange,
  onEncargosFixosExtrasChange,
  onUfChange,
  onDistribuidoraChange,
  onIrradiacaoMediaChange,
  taxaMinimaInputEmpty = false,
}: ConsumoTarifaFieldsProps) {
  return (
    <>
      <Field
        label={labelWithTooltip(
          'Consumo médio (kWh/mês)',
          'Consumo médio mensal histórico da UC principal; serve como base para dimensionar geração e economia.',
        )}
      >
        <input
          data-field="consumoMedioMensal"
          type="number"
          value={kcKwhMes}
          onChange={(e) => onKcKwhMesChange(Number(e.target.value) || 0)}
          onFocus={selectNumberInputOnFocus}
          className="v8-field-input"
          placeholder="Ex: 500"
        />
      </Field>

      <Field
        label={labelWithTooltip(
          'Tarifa cheia (R$/kWh)',
          'Valor cobrado por kWh sem descontos; multiplicado pelo consumo projetado para estimar a conta cheia.',
        )}
      >
        <input
          data-field="tarifaCheia"
          type="number"
          step="0.001"
          value={tarifaCheia}
          onChange={(e) => onTarifaCheiaChange(Number(e.target.value) || 0)}
          onFocus={selectNumberInputOnFocus}
          className="v8-field-input"
          placeholder="Ex: 0.95"
        />
      </Field>

      <Field
        label={labelWithTooltip(
          'Custos fixos mensais (R$)',
          'Total de custos fixos cobrados pela distribuidora independentemente da compensação de créditos.',
        )}
      >
        <input
          data-field="taxaMinima"
          type="number"
          min={0}
          value={taxaMinimaInputEmpty ? '' : taxaMinima}
          onChange={(e) => onTaxaMinimaChange(e.target.value)}
          onFocus={selectNumberInputOnFocus}
          className="v8-field-input"
          placeholder="Ex: 50.00"
        />
      </Field>

      <Field
        label={labelWithTooltip(
          'Encargos adicionais (R$/mês)',
          'Outras cobranças fixas recorrentes (CIP, iluminação, taxas municipais) adicionadas à conta mensal.',
        )}
      >
        <input
          data-field="encargosFixos"
          type="number"
          value={encargosFixosExtras}
          onChange={(e) => onEncargosFixosExtrasChange(Number(e.target.value) || 0)}
          onFocus={selectNumberInputOnFocus}
          className="v8-field-input"
          placeholder="Ex: 20.00"
        />
      </Field>

      <Field
        label={labelWithTooltip(
          'UF (ANEEL)',
          'Estado utilizado para buscar tarifas homologadas pela ANEEL e sugerir parâmetros regionais.',
        )}
      >
        <select
          data-field="ufTarifa"
          value={ufTarifa}
          onChange={(e) => onUfChange(e.target.value)}
          className="v8-field-select"
        >
          <option value="">Selecione a UF</option>
          {ufsDisponiveis.map((uf) => (
            <option key={uf} value={uf}>
              {uf} — {ufLabels[uf] ?? uf}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={labelWithTooltip(
          'Distribuidora (ANEEL)',
          'Concessionária selecionada para carregar automaticamente tarifas de TE e TUSD.',
        )}
      >
        <select
          data-field="distribuidora"
          value={distribuidoraTarifa}
          onChange={(e) => onDistribuidoraChange(e.target.value)}
          disabled={!ufTarifa || distribuidorasDisponiveis.length === 0}
          className="v8-field-select"
        >
          <option value="">
            {ufTarifa ? 'Selecione a distribuidora' : 'Selecione a UF primeiro'}
          </option>
          {distribuidorasDisponiveis.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={
          <>
            Irradiação média (kWh/m²/dia)
            <InfoTooltip text="Irradiação média é preenchida automaticamente a partir da UF/distribuidora ou do valor configurado manualmente." />
          </>
        }
      >
        <input
          data-field="irradiacaoMedia"
          type="number"
          step="0.01"
          value={irradiacaoMedia}
          onChange={(e) => onIrradiacaoMediaChange(Number(e.target.value) || 0)}
          onFocus={selectNumberInputOnFocus}
          className="v8-field-input"
          placeholder="Ex: 5.5"
        />
      </Field>
    </>
  )
}

/**
 * Sistema Fields (Step 3)
 * Installation type and system configuration
 */
export interface SistemaFieldsProps {
  tipoInstalacao: string
  tipoInstalacaoOutro: string
  tipoSistema: string
  tiposInstalacao: Array<{ value: string; label: string }>
  tipoSistemaValues: string[]
  onTipoInstalacaoChange: (value: string) => void
  onTipoInstalacaoOutroChange: (value: string) => void
  onTipoSistemaChange: (value: string) => void
  isManualBudgetForced: boolean
  manualBudgetForceReason: string
}

export function SistemaFields({
  tipoInstalacao,
  tipoInstalacaoOutro,
  tipoSistema,
  tiposInstalacao,
  tipoSistemaValues,
  onTipoInstalacaoChange,
  onTipoInstalacaoOutroChange,
  onTipoSistemaChange,
  isManualBudgetForced,
  manualBudgetForceReason,
}: SistemaFieldsProps) {
  return (
    <>
      <Field label="Tipo de instalação">
        <select
          data-field="tipoInstalacao"
          value={tipoInstalacao}
          onChange={(e) => onTipoInstalacaoChange(e.target.value)}
          aria-label="Selecionar tipo de instalação"
          className="v8-field-select"
        >
          {tiposInstalacao.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {tipoInstalacao === 'outros' && (
          <input
            type="text"
            placeholder="Descreva o tipo de instalação"
            value={tipoInstalacaoOutro || ''}
            onChange={(e) => onTipoInstalacaoOutroChange(e.target.value)}
            style={{ marginTop: '6px' }}
            className="v8-field-input"
          />
        )}
      </Field>

      <Field label="Tipo de sistema">
        <div
          className="toggle-group"
          role="radiogroup"
          aria-label="Selecionar tipo de sistema"
        >
          {tipoSistemaValues.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={tipoSistema === value}
              className={`toggle-option${tipoSistema === value ? ' active' : ''}`}
              onClick={() => onTipoSistemaChange(value)}
              data-field="tipoSistema"
            >
              {value === 'ON_GRID' ? 'On-grid' : value === 'HIBRIDO' ? 'Híbrido' : 'Off-grid'}
            </button>
          ))}
        </div>
      </Field>

      {isManualBudgetForced && (
        <div className="v8-alert warning">
          <p>
            <strong>⚠️ {manualBudgetForceReason}</strong>
          </p>
        </div>
      )}
    </>
  )
}

/**
 * Generates Proposta Actions (Step 6)
 * Final review and proposal generation
 */
export interface GerarPropostaActionsProps {
  onGenerateProposal: () => void | Promise<void>
  isSaving: boolean
  canGenerate: boolean
  missingFields: string[]
}

export function GerarPropostaActions({
  onGenerateProposal,
  isSaving,
  canGenerate,
  missingFields,
}: GerarPropostaActionsProps) {
  return (
    <div className="v8-field-grid">
      {missingFields.length > 0 && (
        <div className="v8-alert warning">
          <p>
            <strong>Campos obrigatórios pendentes:</strong>
          </p>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            {missingFields.map((field, idx) => (
              <li key={idx}>{field}</li>
            ))}
          </ul>
        </div>
      )}

      {canGenerate && (
        <div className="v8-alert success">
          <p>
            <strong>✓ Todos os campos obrigatórios preenchidos</strong>
            <br />
            Revise as informações e clique em "Gerar Proposta" para criar o documento.
          </p>
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <button
          type="button"
          className="v8-btn v8-btn-primary v8-btn-large"
          onClick={onGenerateProposal}
          disabled={!canGenerate || isSaving}
        >
          {isSaving ? 'Gerando...' : 'Gerar Proposta'}
        </button>
      </div>
    </div>
  )
}
