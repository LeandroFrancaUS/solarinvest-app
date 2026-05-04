import React from 'react'
import type { ClienteDados } from '../types/printableProposal'
import type { SegmentoCliente } from '../lib/finance/roi'
import type { TipoClienteTUSD } from '../lib/finance/tusd'
import type { ClienteMensagens } from '../types/cliente'
import type { UcBeneficiariaFormState } from '../types/ucBeneficiaria'
import type { ConsultantPickerEntry } from '../services/personnelApi'
import { Field } from './ui/Field'
import { labelWithTooltip } from './InfoTooltip'
import { CheckboxSmall } from './CheckboxSmall'
import { isSegmentoCondominio } from '../utils/segmento'
import { formatNumberBRWithOptions } from '../lib/locale/br-number'
import { UF_LABELS } from '../app/config'
import { TIPO_BASICO_OPTIONS } from '../types/tipoBasico'
import { consultorDisplayName, formatConsultantOptionLabel } from '../services/personnelApi'

const NOVOS_TIPOS_EDIFICACAO = TIPO_BASICO_OPTIONS

type Props = {
  // Data
  cliente: ClienteDados
  budgetCodeDisplay: string | null | undefined
  segmentoCliente: SegmentoCliente
  tipoEdificacaoOutro: string
  tusdTipoCliente: TipoClienteTUSD
  clienteMensagens: ClienteMensagens
  buscandoCep: boolean
  cidadeBloqueadaPorCep: boolean
  cidadeSelectOpen: boolean
  cidadeSearchTerm: string
  cidadesCarregando: boolean
  cidadesFiltradas: string[]
  cidadeManualDigitada: string
  cidadeManualDisponivel: boolean
  verificandoCidade: boolean
  ufsDisponiveis: string[]
  clienteDistribuidorasDisponiveis: string[]
  clienteDistribuidoraDisabled: boolean
  ucGeradoraTitularDiferente: boolean
  ucGeradora_importarEnderecoCliente: boolean
  ucGeradoraTitularPanel: React.ReactNode
  ucsBeneficiarias: UcBeneficiariaFormState[]
  consumoTotalUcsBeneficiarias: number
  consumoUcsExcedeInformado: boolean
  kcKwhMes: number
  temCorresponsavelFinanceiro: boolean
  clienteIndicacaoCheckboxId: string
  clienteIndicacaoNomeId: string
  clienteConsultorSelectId: string
  clienteHerdeirosContentId: string
  clienteHerdeirosExpandidos: boolean
  formConsultores: ConsultantPickerEntry[]
  clienteTemDadosNaoSalvos: boolean
  clienteSaveLabel: string
  oneDriveIntegrationAvailable: boolean
  // Callbacks
  onClienteChange: <K extends keyof ClienteDados>(key: K, value: ClienteDados[K]) => void
  onUpdateClienteSync: (patch: Partial<ClienteDados>) => void
  onClearFieldHighlight: (element?: HTMLElement | null) => void
  onSetCidadeBloqueadaPorCep: (value: boolean) => void
  onSetCidadeSelectOpen: (value: boolean) => void
  onSetCidadeSearchTerm: (value: string) => void
  onSetClienteMensagens: (updater: (prev: ClienteMensagens) => ClienteMensagens) => void
  onClearCepAviso: () => void
  onSegmentoChange: (value: SegmentoCliente) => void
  onTipoEdificacaoOutroChange: (value: string) => void
  onEnderecoFocus: () => void
  onEnderecoBlur: () => void
  onToggleUcGeradoraTitularDiferente: (checked: boolean) => void
  onImportEnderecoClienteParaUcGeradora: (checked: boolean) => void
  onAtualizarUcBeneficiaria: (
    id: string,
    field: 'numero' | 'endereco' | 'rateioPercentual' | 'consumoKWh',
    value: string,
  ) => void
  onAdicionarUcBeneficiaria: () => void
  onRemoverUcBeneficiaria: (id: string) => void
  onHerdeiroChange: (index: number, value: string) => void
  onAdicionarHerdeiro: () => void
  onRemoverHerdeiro: (index: number) => void
  onSetClienteHerdeirosExpandidos: (updater: (prev: boolean) => boolean) => void
  onAbrirCorresponsavelModal: () => void
  onSalvarCliente: () => void
  onAbrirClientesPainel: () => void
}

export function ClienteDadosSection({
  cliente,
  budgetCodeDisplay,
  segmentoCliente,
  tipoEdificacaoOutro,
  tusdTipoCliente,
  clienteMensagens,
  buscandoCep,
  cidadeBloqueadaPorCep,
  cidadeSelectOpen,
  cidadeSearchTerm,
  cidadesCarregando,
  cidadesFiltradas,
  cidadeManualDigitada,
  cidadeManualDisponivel,
  verificandoCidade,
  ufsDisponiveis,
  clienteDistribuidorasDisponiveis,
  clienteDistribuidoraDisabled,
  ucGeradoraTitularDiferente,
  ucGeradora_importarEnderecoCliente,
  ucGeradoraTitularPanel,
  ucsBeneficiarias,
  consumoTotalUcsBeneficiarias,
  consumoUcsExcedeInformado,
  kcKwhMes,
  temCorresponsavelFinanceiro,
  clienteIndicacaoCheckboxId,
  clienteIndicacaoNomeId,
  clienteConsultorSelectId,
  clienteHerdeirosContentId,
  clienteHerdeirosExpandidos,
  formConsultores,
  clienteTemDadosNaoSalvos,
  clienteSaveLabel,
  oneDriveIntegrationAvailable,
  onClienteChange,
  onUpdateClienteSync,
  onClearFieldHighlight,
  onSetCidadeBloqueadaPorCep,
  onSetCidadeSelectOpen,
  onSetCidadeSearchTerm,
  onSetClienteMensagens,
  onClearCepAviso,
  onSegmentoChange,
  onTipoEdificacaoOutroChange,
  onEnderecoFocus,
  onEnderecoBlur,
  onToggleUcGeradoraTitularDiferente,
  onImportEnderecoClienteParaUcGeradora,
  onAtualizarUcBeneficiaria,
  onAdicionarUcBeneficiaria,
  onRemoverUcBeneficiaria,
  onHerdeiroChange,
  onAdicionarHerdeiro,
  onRemoverHerdeiro,
  onSetClienteHerdeirosExpandidos,
  onAbrirCorresponsavelModal,
  onSalvarCliente,
  onAbrirClientesPainel,
}: Props) {
  const herdeirosPreenchidos = cliente.herdeiros.filter((nome) => nome.trim().length > 0)
  const herdeirosResumo =
    herdeirosPreenchidos.length === 0
      ? 'Nenhum herdeiro cadastrado'
      : `${herdeirosPreenchidos.length} ${
          herdeirosPreenchidos.length === 1
            ? 'herdeiro cadastrado'
            : 'herdeiros cadastrados'
        }`
  const isCondominio = isSegmentoCondominio(segmentoCliente)

  return (
    <section className="card">
      <div className="card-header">
        <h2>Dados do cliente</h2>
        {budgetCodeDisplay ? (
          <div
            className="budget-code-badge"
          role="status"
          aria-live="polite"
          aria-label="Código do orçamento salvo"
        >
          <span className="budget-code-badge__label">Orçamento</span>
          <span className="budget-code-badge__value">{budgetCodeDisplay}</span>
        </div>
      ) : null}
    </div>
    <div className="grid g2">
      <Field
        label={labelWithTooltip(
          'Nome ou Razão social',
          'Identificação oficial do cliente utilizada em contratos, relatórios e integração com o CRM. Para empresas, informar a Razão Social.',
        )}
      >
        <input
          data-field="cliente-nomeRazao"
          value={cliente.nome}
          onChange={(e) => {
            onClienteChange('nome', e.target.value)
            onClearFieldHighlight(e.currentTarget)
          }}
        />
      </Field>
      <Field
        label={labelWithTooltip(
          'CPF/CNPJ',
          'Documento fiscal do titular da unidade consumidora. Para pessoa física: CPF. Para pessoa jurídica: CNPJ.',
        )}
      >
        <input
          data-field="cliente-cpfCnpj"
          value={cliente.documento}
          onChange={(e) => {
            onClienteChange('documento', e.target.value)
            onClearFieldHighlight(e.currentTarget)
          }}
          inputMode="numeric"
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
        />
      </Field>
      <Field
        label={labelWithTooltip(
          'Representante Legal',
          'Nome do representante legal (para pessoa jurídica/CNPJ). Deixar em branco para pessoa física.',
        )}
      >
        <input
          value={cliente.representanteLegal || ''}
          onChange={(e) => onClienteChange('representanteLegal', e.target.value)}
          placeholder="Nome do diretor ou sócio"
        />
      </Field>
      <Field
        label={labelWithTooltip(
          'Estado Civil',
          'Estado civil do contratante pessoa física (solteiro, casado, divorciado, viúvo, etc.).',
        )}
      >
        <select
          data-field="cliente-estadoCivil"
          value={cliente.estadoCivil || ''}
          onChange={(e) => {
            onClienteChange('estadoCivil', e.target.value)
            onClearFieldHighlight(e.currentTarget)
          }}
        >
          <option value="">Selecione</option>
          <option value="Solteiro(a)">Solteiro(a)</option>
          <option value="Casado(a)">Casado(a)</option>
          <option value="Divorciado(a)">Divorciado(a)</option>
          <option value="Viúvo(a)">Viúvo(a)</option>
          <option value="União Estável">União Estável</option>
        </select>
      </Field>
      <Field
        label={labelWithTooltip(
          'Nacionalidade',
          'Nacionalidade do contratante pessoa física.',
        )}
      >
        <input
          value={cliente.nacionalidade || ''}
          onChange={(e) => onClienteChange('nacionalidade', e.target.value)}
          placeholder="Brasileira"
        />
      </Field>
      <Field
        label={labelWithTooltip(
          'E-mail',
          'Endereço eletrônico usado para envio da proposta, acompanhamento e notificações automáticas.',
        )}
        hint={clienteMensagens.email}
      >
        <input
          data-field="cliente-email"
          value={cliente.email}
          onChange={(e) => {
            onClienteChange('email', e.target.value)
            onClearFieldHighlight(e.currentTarget)
          }}
          type="email"
          placeholder="nome@empresa.com"
        />
      </Field>
      <Field
        label={labelWithTooltip(
          'Telefone',
          'Contato telefônico principal do cliente para follow-up comercial e registros no CRM.',
        )}
      >
        <input
          data-field="cliente-telefone"
          value={cliente.telefone}
          onChange={(e) => {
            onClienteChange('telefone', e.target.value)
            onClearFieldHighlight(e.currentTarget)
          }}
          inputMode="tel"
          autoComplete="tel"
          placeholder="(00) 00000-0000"
        />
      </Field>
      <Field
        label={labelWithTooltip(
          'CEP',
          'Código postal da instalação; utilizado para preencher endereço automaticamente e consultar tarifas locais.',
        )}
        hint={buscandoCep ? 'Buscando CEP...' : clienteMensagens.cep}
      >
        <input
          data-field="cliente-cep"
          value={cliente.cep}
          onChange={(e) => {
            onClienteChange('cep', e.target.value)
            onSetCidadeBloqueadaPorCep(false)
            onClearFieldHighlight(e.currentTarget)
          }}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
        />
      </Field>
      <Field
        label={labelWithTooltip(
          'Cidade',
          'Município da instalação utilizado em relatórios, cálculo de impostos locais e validação de CEP.',
        )}
        hint={
          !cliente.uf.trim()
            ? 'Selecione a UF para escolher a cidade.'
            : cidadeBloqueadaPorCep
              ? 'Cidade definida pelo CEP. Altere o CEP para modificar.'
              : verificandoCidade
                ? 'Verificando cidade...'
                : clienteMensagens.cidade
        }
      >
        <div
          className={`city-select${!cliente.uf.trim() || cidadeBloqueadaPorCep ? ' is-disabled' : ''}`}
        >
          <details
            open={cidadeSelectOpen}
            onToggle={(event) => {
              if (!cliente.uf.trim() || cidadeBloqueadaPorCep) {
                event.preventDefault()
                event.currentTarget.open = false
                onSetCidadeSelectOpen(false)
                return
              }
              onSetCidadeSelectOpen(event.currentTarget.open)
            }}
          >
            <summary
              data-field="cliente-cidade"
              role="button"
              aria-disabled={!cliente.uf.trim() || cidadeBloqueadaPorCep}
              onClick={(event) => {
                if (!cliente.uf.trim() || cidadeBloqueadaPorCep) {
                  event.preventDefault()
                }
              }}
            >
              {cliente.cidade.trim()
                ? cliente.cidade
                : cliente.uf.trim()
                  ? 'Selecione a cidade'
                  : 'Selecione a UF para escolher a cidade'}
            </summary>
            <div className="city-select-panel">
              <input
                type="text"
                placeholder="Buscar cidade…"
                value={cidadeSearchTerm}
                onChange={(event) => onSetCidadeSearchTerm(event.target.value)}
                disabled={!cliente.uf.trim() || cidadeBloqueadaPorCep}
              />
              <div className="city-select-list" role="listbox">
                {!cidadeBloqueadaPorCep && cliente.cidade.trim() ? (
                  <button
                    type="button"
                    className="city-select-option is-manual"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      onClienteChange('cidade', '')
                      onSetCidadeSearchTerm('')
                      onSetCidadeSelectOpen(false)
                      onClearCepAviso()
                      onSetClienteMensagens((prev) => ({ ...prev, cidade: undefined }))
                      onClearFieldHighlight(
                        document.querySelector('[data-field="cliente-cidade"]') as HTMLElement | null,
                      )
                    }}
                  >
                    Limpar cidade
                  </button>
                ) : null}
                {cidadesCarregando ? (
                  <div className="city-select-empty">Carregando cidades...</div>
                ) : cidadesFiltradas.length > 0 ? (
                  cidadesFiltradas.map((cidade) => {
                    const selecionada = cidade === cliente.cidade
                    return (
                      <button
                        key={cidade}
                        type="button"
                        className={`city-select-option${selecionada ? ' is-selected' : ''}`}
                        role="option"
                        aria-selected={selecionada}
                        disabled={cidadeBloqueadaPorCep}
                        onClick={() => {
                          onClienteChange('cidade', cidade)
                          onSetCidadeSearchTerm('')
                          onSetCidadeSelectOpen(false)
                          onClearCepAviso()
                          onSetClienteMensagens((prev) => ({ ...prev, cidade: undefined }))
                          onClearFieldHighlight(
                            document.querySelector('[data-field="cliente-cidade"]') as HTMLElement | null,
                          )
                          if (cliente.uf.trim()) {
                            onClearFieldHighlight(
                              document.querySelector('[data-field="cliente-uf"]') as HTMLElement | null,
                            )
                          }
                        }}
                      >
                        {cidade}
                      </button>
                    )
                  })
                ) : (
                  <div className="city-select-empty">
                    Nenhuma cidade encontrada para esta UF.
                  </div>
                )}
                {!cidadeBloqueadaPorCep && !cidadesCarregando && cidadeManualDisponivel ? (
                  <button
                    type="button"
                    className="city-select-option is-manual"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      onClienteChange('cidade', cidadeManualDigitada)
                      onSetCidadeSearchTerm('')
                      onSetCidadeSelectOpen(false)
                      onClearCepAviso()
                      onSetClienteMensagens((prev) => ({ ...prev, cidade: undefined }))
                      onClearFieldHighlight(
                        document.querySelector('[data-field="cliente-cidade"]') as HTMLElement | null,
                      )
                      if (cliente.uf.trim()) {
                        onClearFieldHighlight(
                          document.querySelector('[data-field="cliente-uf"]') as HTMLElement | null,
                        )
                      }
                    }}
                  >
                    Usar "{cidadeManualDigitada}"
                  </button>
                ) : null}
              </div>
            </div>
          </details>
        </div>
      </Field>
      <Field
        label={labelWithTooltip(
          'UF ou Estado',
          'Estado da instalação; utilizado para listar distribuidoras disponíveis, definir tarifas e parâmetros regionais.',
        )}
      >
        <select
          data-field="cliente-uf"
          value={cliente.uf}
          onChange={(e) => {
            const nextUf = e.target.value
            if (nextUf !== cliente.uf) {
              onClienteChange('uf', nextUf)
              if (cliente.cidade.trim() && !cidadeBloqueadaPorCep) {
                onClienteChange('cidade', '')
              }
              onSetCidadeSearchTerm('')
              onSetCidadeSelectOpen(false)
              onClearCepAviso()
            }
            onClearFieldHighlight(e.currentTarget)
          }}
        >
          <option value="">Selecione um estado</option>
          {ufsDisponiveis.map((uf) => (
            <option key={uf} value={uf}>
              {uf} — {UF_LABELS[uf] ?? uf}
            </option>
          ))}
          {cliente.uf && !ufsDisponiveis.includes(cliente.uf) ? (
            <option value={cliente.uf}>
              {cliente.uf} — {UF_LABELS[cliente.uf] ?? cliente.uf}
            </option>
          ) : null}
        </select>
      </Field>
      <Field
        label={labelWithTooltip(
          'Distribuidora (ANEEL)',
          'Concessionária responsável pela unidade consumidora; define tarifas homologadas e regras de compensação.',
        )}
      >
        <select
          data-field="cliente-distribuidoraAneel"
          value={cliente.distribuidora}
          onChange={(e) => {
            onClienteChange('distribuidora', e.target.value)
            onClearFieldHighlight(e.currentTarget)
          }}
          disabled={clienteDistribuidoraDisabled}
          aria-disabled={clienteDistribuidoraDisabled}
          style={
            clienteDistribuidoraDisabled
              ? { opacity: 0.6, cursor: 'not-allowed' }
              : undefined
          }
        >
          <option value="">
            {cliente.uf ? 'Selecione a distribuidora' : 'Selecione a UF'}
          </option>
          {clienteDistribuidorasDisponiveis.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
          {cliente.distribuidora && !clienteDistribuidorasDisponiveis.includes(cliente.distribuidora) ? (
            <option value={cliente.distribuidora}>{cliente.distribuidora}</option>
          ) : null}
        </select>
      </Field>
      <Field
        label={labelWithTooltip(
          'Tipo de Edificação',
          'Classificação da edificação (Residencial, Comercial, Cond. Vertical, Cond. Horizontal, Industrial ou Outros (texto)), utilizada para relatórios e cálculos de tarifas.',
        )}
      >
        <select
          data-field="cliente-tipoEdificacao"
          value={segmentoCliente}
          onChange={(event) => {
            onSegmentoChange(event.target.value as SegmentoCliente)
            onClearFieldHighlight(event.currentTarget)
          }}
        >
          <option value="">Selecione</option>
          {NOVOS_TIPOS_EDIFICACAO.map((option) => (
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
          'UC Geradora (número)',
          'Código numérico da unidade consumidora geradora junto à distribuidora, usado para vincular contratos e projeções de consumo.',
        )}
      >
        <input
          data-field="cliente-ucGeradoraNumero"
          value={cliente.uc}
          onChange={(e) => {
            onClienteChange('uc', e.target.value)
            onClearFieldHighlight(e.currentTarget)
          }}
          placeholder="Número da UC geradora (15 dígitos)"
        />
      </Field>
      <Field
        label={labelWithTooltip(
          'Endereço do Contratante',
          'Endereço do contratante; será usado nos contratos. Pode ser diferente do endereço de instalação.',
        )}
      >
        <input
          data-field="cliente-enderecoContratante"
          value={cliente.endereco ?? ''}
          onChange={(e) => {
            onUpdateClienteSync({ endereco: e.target.value })
            onClearFieldHighlight(e.currentTarget)
          }}
          onFocus={() => {
            onEnderecoFocus()
          }}
          onBlur={() => {
            onEnderecoBlur()
          }}
          autoComplete="street-address"
          placeholder="Rua, número, complemento"
        />
      </Field>
      <Field
        label={
          <div className="leasing-location-label">
            <div className="leasing-location-title">
              <span className="leasing-field-label-text">
                Informações da UC geradora
              </span>
              <div className="leasing-location-checkboxes">
                <label className="leasing-location-checkbox flex items-center gap-2">
                  <CheckboxSmall
                    checked={ucGeradoraTitularDiferente}
                    onChange={(event) =>
                      onToggleUcGeradoraTitularDiferente(event.target.checked)
                    }
                  />
                  <span>Diferente titular da UC geradora</span>
                </label>
                <label className="leasing-location-checkbox flex items-center gap-2">
                  <CheckboxSmall
                    checked={ucGeradora_importarEnderecoCliente}
                    disabled={!ucGeradoraTitularDiferente}
                    onChange={(event) =>
                      onImportEnderecoClienteParaUcGeradora(event.target.checked)
                    }
                  />
                  <span>Importar endereço do cliente</span>
                </label>
              </div>
            </div>
          </div>
        }
        hint="O endereço da UC geradora seguirá o endereço do contratante, exceto quando houver titular diferente."
      >
        <div aria-hidden="true" />
      </Field>
      {ucGeradoraTitularPanel}
      {isCondominio ? (
        <div className="grid g3">
          <Field label="Nome do síndico">
            <input
              value={cliente.nomeSindico}
              onChange={(event) => onClienteChange('nomeSindico', event.target.value)}
              placeholder="Nome completo"
            />
          </Field>
          <Field label="CPF do síndico">
            <input
              value={cliente.cpfSindico}
              onChange={(event) => onClienteChange('cpfSindico', event.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </Field>
          <Field label="Contato do síndico">
            <input
              value={cliente.contatoSindico}
              onChange={(event) => onClienteChange('contatoSindico', event.target.value)}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>
        </div>
      ) : null}
      <Field
        label={labelWithTooltip(
          'UCs Beneficiárias',
          'Cadastre as unidades consumidoras que receberão rateio automático dos créditos de energia gerados.',
        )}
      >
        <div className="cliente-ucs-beneficiarias-group">
          {ucsBeneficiarias.length === 0 ? (
            <p className="cliente-ucs-beneficiarias-empty">
              Nenhuma UC beneficiária cadastrada. Utilize o botão abaixo para adicionar.
            </p>
          ) : null}
          {ucsBeneficiarias.map((uc, index) => (
            <div className="cliente-ucs-beneficiaria-row" key={uc.id}>
              <span className="cliente-ucs-beneficiaria-index" aria-hidden="true">
                UC {index + 1}
              </span>
              <input
                className="cliente-ucs-beneficiaria-numero"
                value={uc.numero}
                onChange={(event) =>
                  onAtualizarUcBeneficiaria(uc.id, 'numero', event.target.value)
                }
                placeholder="Número da UC (15 dígitos)"
                aria-label={`Número da UC beneficiária ${index + 1}`}
              />
              <input
                className="cliente-ucs-beneficiaria-endereco"
                value={uc.endereco}
                onChange={(event) =>
                  onAtualizarUcBeneficiaria(uc.id, 'endereco', event.target.value)
                }
                placeholder="Endereço completo"
                aria-label={`Endereço completo da UC beneficiária ${index + 1}`}
              />
              <input
                className="cliente-ucs-beneficiaria-consumo"
                value={uc.consumoKWh}
                onChange={(event) =>
                  onAtualizarUcBeneficiaria(uc.id, 'consumoKWh', event.target.value)
                }
                placeholder="Consumo (kWh/mês)"
                inputMode="decimal"
                aria-label={`Consumo mensal da UC beneficiária ${index + 1}`}
              />
              <input
                className="cliente-ucs-beneficiaria-rateio"
                value={uc.rateioPercentual}
                onChange={(event) =>
                  onAtualizarUcBeneficiaria(
                    uc.id,
                    'rateioPercentual',
                    event.target.value,
                  )
                }
                placeholder="Rateio (%)"
                inputMode="decimal"
                aria-label={`Rateio percentual da UC beneficiária ${index + 1}`}
              />
              <button
                type="button"
                className="ghost cliente-ucs-beneficiaria-remove"
                onClick={() => onRemoverUcBeneficiaria(uc.id)}
                aria-label={`Remover UC beneficiária ${index + 1}`}
              >
                Remover
              </button>
            </div>
          ))}
          <div className="cliente-ucs-beneficiarias-actions">
            <button
              type="button"
              className="ghost"
              onClick={onAdicionarUcBeneficiaria}
            >
              Adicionar UC beneficiária
            </button>
          </div>
        </div>
      </Field>
      {consumoUcsExcedeInformado ? (
        <div className="warning ucs-consumo-warning" role="alert">
          <strong>Consumo das UCs acima do total informado.</strong>{' '}
          A soma dos consumos das UCs beneficiárias (
          {formatNumberBRWithOptions(consumoTotalUcsBeneficiarias, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}{' '}
          kWh/mês) ultrapassa o consumo mensal informado (
          {formatNumberBRWithOptions(kcKwhMes, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}{' '}
          kWh/mês). Ajuste os valores para manter o rateio consistente.
        </div>
      ) : null}
      <Field
        label={labelWithTooltip(
          'Indicação',
          'Marque quando o cliente tiver sido indicado e registre quem realizou a indicação para controle comercial.',
        )}
        hint={cliente.temIndicacao ? 'Informe o nome do responsável pela indicação.' : undefined}
      >
        <div className="cliente-indicacao-group">
          <label
            className="cliente-indicacao-toggle flex items-center gap-2"
            htmlFor={clienteIndicacaoCheckboxId}
          >
            <CheckboxSmall
              id={clienteIndicacaoCheckboxId}
              checked={cliente.temIndicacao}
              onChange={(event) => onClienteChange('temIndicacao', event.target.checked)}
            />
            <span>Indicação</span>
          </label>
          {cliente.temIndicacao ? (
            <input
              id={clienteIndicacaoNomeId}
              className="cfg-input"
              value={cliente.indicacaoNome}
              onChange={(event) => onClienteChange('indicacaoNome', event.target.value)}
              placeholder="Nome de quem indicou"
              aria-label="Nome de quem indicou"
            />
          ) : null}
        </div>
      </Field>
      <Field
        label={labelWithTooltip(
          'Consultor',
          'Consultor responsável por este cliente. O campo é preenchido automaticamente com o consultor vinculado ao usuário logado.',
        )}
      >
        <select
          id={clienteConsultorSelectId}
          className="cfg-input"
          value={cliente.consultorId}
          onChange={(event) => {
            const selectedId = event.target.value
            const consultor = formConsultores.find((c) => String(c.id) === selectedId)
            onClienteChange('consultorId', selectedId)
            onClienteChange('consultorNome', consultor ? consultorDisplayName(consultor) : '')
          }}
          aria-label="Consultor responsável"
          style={{ color: 'var(--input-text, #0f172a)', backgroundColor: 'var(--input-bg, #fff)' }}
        >
          <option value="">— Selecione um consultor —</option>
          {formConsultores.map((c) => (
            <option key={c.id} value={String(c.id)} style={{ color: '#0f172a', backgroundColor: '#fff' }}>
              {formatConsultantOptionLabel(c)}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={labelWithTooltip(
          'Herdeiros (opcional)',
          'Registre os herdeiros do cliente e utilize as tags {{herdeiro#1}}, {{herdeiro#2}} e assim por diante em modelos e textos.',
        )}
        hint="As tags seguem o formato {{herdeiro#n}} conforme a ordem dos campos."
      >
        <div className="cliente-herdeiros-group">
          <div className="cliente-herdeiros-toolbar">
            <button
              type="button"
              className="cliente-herdeiros-toggle"
              onClick={() => onSetClienteHerdeirosExpandidos((prev) => !prev)}
              aria-expanded={clienteHerdeirosExpandidos}
              aria-controls={clienteHerdeirosContentId}
            >
              {clienteHerdeirosExpandidos ? 'Ocultar herdeiros' : 'Gerenciar herdeiros'}
            </button>
            <button
              type="button"
              className="cliente-herdeiros-toggle"
              onClick={onAbrirCorresponsavelModal}
              aria-haspopup="dialog"
            >
              Corresponsável financeiro
            </button>
            {temCorresponsavelFinanceiro ? (
              <span className="cliente-corresponsavel-status">Corresponsável cadastrado</span>
            ) : null}
          </div>
          <small className="cliente-herdeiros-summary">{herdeirosResumo}</small>
          {clienteHerdeirosExpandidos ? (
            <div
              className="cliente-herdeiros-content"
              id={clienteHerdeirosContentId}
              aria-hidden={false}
            >
              {cliente.herdeiros.map((herdeiro, index) => (
                <div className="cliente-herdeiro-row" key={`cliente-herdeiro-${index}`}>
                  <input
                    value={herdeiro}
                    onChange={(event) => onHerdeiroChange(index, event.target.value)}
                    placeholder={`Nome do herdeiro ${index + 1}`}
                    aria-label={`Nome do herdeiro ${index + 1}`}
                  />
                  <span className="cliente-herdeiro-tag" aria-hidden="true">
                    {`{{herdeiro#${index + 1}}}`}
                  </span>
                  {cliente.herdeiros.length > 1 ? (
                    <button
                      type="button"
                      className="ghost cliente-herdeiro-remove"
                      onClick={() => onRemoverHerdeiro(index)}
                      aria-label={`Remover herdeiro ${index + 1}`}
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              ))}
              <div className="cliente-herdeiros-actions">
                <button
                  type="button"
                  className="ghost cliente-herdeiro-add"
                  onClick={onAdicionarHerdeiro}
                >
                  Adicionar herdeiro
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </Field>
    </div>
    <div className="card-actions">
      <button
        type="button"
        className="primary"
        onClick={onSalvarCliente}
        disabled={!clienteTemDadosNaoSalvos}
        aria-disabled={!clienteTemDadosNaoSalvos}
        title={clienteTemDadosNaoSalvos ? clienteSaveLabel : 'Nenhuma alteração pendente para salvar'}
      >
        {clienteSaveLabel}
      </button>
      <button type="button" className="ghost" onClick={onAbrirClientesPainel}>
        Ver clientes
      </button>
    </div>
    {!oneDriveIntegrationAvailable ? (
      <p className="muted integration-hint" role="status">
        Sincronização automática com o OneDrive indisponível. Configure a integração para habilitar o envio.
      </p>
    ) : null}
    </section>
  )
}
