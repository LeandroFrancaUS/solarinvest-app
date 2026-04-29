import type { LeasingEndereco, LeasingUcGeradoraTitular } from '../store/useLeasingStore'
import type { UcGeradoraTitularErrors } from '../types/ucGeradoraTitular'
import { Field, FieldError } from './ui/Field'
import { labelWithTooltip } from './InfoTooltip'
import { formatCep, formatCpfCnpj, formatUcGeradoraTitularEndereco } from '../utils/formatters'

type UcGeradoraTitularDraftPatch = Partial<LeasingUcGeradoraTitular> & {
  endereco?: Partial<LeasingEndereco>
}

type Props = {
  ucGeradoraTitularDiferente: boolean
  ucGeradoraTitular: LeasingUcGeradoraTitular | null
  ucGeradoraTitularDraft: LeasingUcGeradoraTitular | null
  ucGeradoraTitularDistribuidoraAneel: string
  panelOpen: boolean
  errors: UcGeradoraTitularErrors
  buscandoCep: boolean
  cepMessage: string | undefined
  cidadeBloqueadaPorCep: boolean
  ufsDisponiveis: string[]
  titularDistribuidoraDisabled: boolean
  ucGeradoraTitularUf: string
  ucGeradoraTitularDistribuidorasDisponiveis: string[]
  onUpdateDraft: (patch: UcGeradoraTitularDraftPatch) => void
  onClearError: (field: keyof UcGeradoraTitularErrors) => void
  onUfChange: (uf: string) => void
  onDistribuidoraChange: (distribuidora: string) => void
  onSalvar: () => void
  onCancelar: () => void
  onEditar: () => void
  onSetCepMessage: (msg: string | undefined) => void
  onSetBuscandoCep: (value: boolean) => void
  onSetCidadeBloqueada: (value: boolean) => void
}

export function UcGeradoraTitularPanel({
  ucGeradoraTitularDiferente,
  ucGeradoraTitular,
  ucGeradoraTitularDraft,
  ucGeradoraTitularDistribuidoraAneel,
  panelOpen,
  errors,
  buscandoCep,
  cepMessage,
  cidadeBloqueadaPorCep,
  ufsDisponiveis,
  titularDistribuidoraDisabled,
  ucGeradoraTitularUf,
  ucGeradoraTitularDistribuidorasDisponiveis,
  onUpdateDraft,
  onClearError,
  onUfChange,
  onDistribuidoraChange,
  onSalvar,
  onCancelar,
  onEditar,
  onSetCepMessage,
  onSetBuscandoCep,
  onSetCidadeBloqueada,
}: Props) {
  if (!ucGeradoraTitularDiferente) {
    return null
  }

  return (
    <div className="uc-geradora-titular-panel-row">
      <div className="uc-geradora-titular-panel">
        {panelOpen ? (
          <>
            <div className="uc-geradora-titular-grid">
              <Field
                label="Nome completo"
                hint={<FieldError message={errors.nomeCompleto} />}
              >
                <input
                  data-field="ucGeradoraTitular-nomeCompleto"
                  value={ucGeradoraTitularDraft?.nomeCompleto ?? ''}
                  onChange={(event) => {
                    onUpdateDraft({ nomeCompleto: event.target.value })
                    onClearError('nomeCompleto')
                  }}
                  placeholder="Nome completo"
                />
              </Field>
              <Field
                label="CPF"
                hint={<FieldError message={errors.cpf} />}
              >
                <input
                  data-field="ucGeradoraTitular-cpf"
                  value={ucGeradoraTitularDraft?.cpf ?? ''}
                  onChange={(event) => {
                    onUpdateDraft({
                      cpf: formatCpfCnpj(event.target.value),
                    })
                    onClearError('cpf')
                  }}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </Field>
              <Field
                label="CEP"
                hint={
                  errors.cep || buscandoCep || cepMessage ? (
                    <>
                      <FieldError message={errors.cep} />
                      {buscandoCep ? (
                        <span>Buscando CEP...</span>
                      ) : cepMessage ? (
                        <span>{cepMessage}</span>
                      ) : null}
                    </>
                  ) : undefined
                }
              >
                <input
                  data-field="ucGeradoraTitular-cep"
                  value={ucGeradoraTitularDraft?.endereco.cep ?? ''}
                  onChange={(event) => {
                    onSetCepMessage(undefined)
                    onSetBuscandoCep(false)
                    onSetCidadeBloqueada(false)
                    onUpdateDraft({
                      endereco: { cep: formatCep(event.target.value) },
                    })
                    onClearError('cep')
                  }}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
              </Field>
              <Field
                label="Logradouro"
                hint={<FieldError message={errors.logradouro} />}
              >
                <input
                  data-field="ucGeradoraTitular-logradouro"
                  value={ucGeradoraTitularDraft?.endereco.logradouro ?? ''}
                  onChange={(event) => {
                    onUpdateDraft({
                      endereco: { logradouro: event.target.value },
                    })
                    onClearError('logradouro')
                  }}
                  placeholder="Rua, avenida, etc."
                />
              </Field>
              <Field
                label="Cidade"
                hint={
                  cidadeBloqueadaPorCep ? (
                    <span>Cidade definida pelo CEP. Altere o CEP para modificar.</span>
                  ) : (
                    <FieldError message={errors.cidade} />
                  )
                }
              >
                <input
                  data-field="ucGeradoraTitular-cidade"
                  value={ucGeradoraTitularDraft?.endereco.cidade ?? ''}
                  readOnly={cidadeBloqueadaPorCep}
                  aria-readonly={cidadeBloqueadaPorCep}
                  onChange={(event) => {
                    if (cidadeBloqueadaPorCep) {
                      return
                    }
                    onUpdateDraft({
                      endereco: { cidade: event.target.value },
                    })
                    onClearError('cidade')
                  }}
                  placeholder="Cidade"
                />
              </Field>
              <Field
                label="UF"
                hint={<FieldError message={errors.uf} />}
              >
                <select
                  data-field="ucGeradoraTitular-uf"
                  value={ucGeradoraTitularDraft?.endereco.uf ?? ''}
                  onChange={(event) => {
                    onUfChange(event.target.value)
                    onClearError('uf')
                  }}
                >
                  <option value="">UF</option>
                  {ufsDisponiveis.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field
                  label={labelWithTooltip(
                    'Distribuidora (ANEEL)',
                    'Concessionária responsável pela UC geradora; define tarifas homologadas e regras de compensação.',
                  )}
                >
                  <select
                    data-field="ucGeradoraTitular-distribuidoraAneel"
                    value={ucGeradoraTitularDistribuidoraAneel}
                    onChange={(event) => onDistribuidoraChange(event.target.value)}
                    disabled={titularDistribuidoraDisabled}
                    aria-disabled={titularDistribuidoraDisabled}
                    style={
                      titularDistribuidoraDisabled
                        ? { opacity: 0.6, cursor: 'not-allowed' }
                        : undefined
                    }
                  >
                    <option value="">
                      {ucGeradoraTitularUf ? 'Selecione a distribuidora' : 'Selecione a UF'}
                    </option>
                    {ucGeradoraTitularDistribuidorasDisponiveis.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                    {ucGeradoraTitularDistribuidoraAneel &&
                    !ucGeradoraTitularDistribuidorasDisponiveis.includes(
                      ucGeradoraTitularDistribuidoraAneel,
                    ) ? (
                      <option value={ucGeradoraTitularDistribuidoraAneel}>
                        {ucGeradoraTitularDistribuidoraAneel}
                      </option>
                    ) : null}
                  </select>
                </Field>
              </div>
            </div>
            <div className="uc-geradora-titular-actions">
              <button
                type="button"
                className="primary uc-geradora-titular-button"
                onClick={onSalvar}
              >
                Salvar
              </button>
              <button
                type="button"
                className="ghost uc-geradora-titular-button"
                onClick={onCancelar}
              >
                Cancelar
              </button>
            </div>
          </>
        ) : ucGeradoraTitular ? (
          <div className="uc-geradora-titular-summary">
            <div className="uc-geradora-titular-summary-info">
              <strong>{ucGeradoraTitular.nomeCompleto}</strong>
              <span>CPF: {ucGeradoraTitular.cpf}</span>
              <span>
                {formatUcGeradoraTitularEndereco(ucGeradoraTitular.endereco)}
              </span>
              {ucGeradoraTitularDistribuidoraAneel ? (
                <span>
                  Distribuidora (ANEEL): {ucGeradoraTitularDistribuidoraAneel}
                </span>
              ) : null}
            </div>
            <div className="uc-geradora-titular-summary-actions">
              <button
                type="button"
                className="ghost"
                onClick={onEditar}
              >
                Editar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
