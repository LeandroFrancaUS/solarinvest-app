import React, { useId } from 'react'
import {
  type LeasingCorresponsavel,
  type LeasingEndereco,
} from '../../store/useLeasingStore'
import { formatCpfCnpj, formatCep } from '../../utils/formatters'
import { Field, FieldError } from '../ui/Field'
import { createEmptyUcGeradoraTitularEndereco } from '../../utils/ucGeradoraTitularFactory'

export type CorresponsavelErrors = {
  nome?: string
  cpf?: string
  telefone?: string
  email?: string
  endereco?: string
}

export const resolveCorresponsavelEndereco = (
  endereco?: LeasingCorresponsavel['endereco'] | null,
): LeasingEndereco => {
  if (!endereco) {
    return createEmptyUcGeradoraTitularEndereco()
  }
  if (typeof endereco === 'string') {
    return { ...createEmptyUcGeradoraTitularEndereco(), logradouro: endereco }
  }
  return {
    ...createEmptyUcGeradoraTitularEndereco(),
    ...endereco,
  }
}

type CorresponsavelModalProps = {
  draft: LeasingCorresponsavel
  errors: CorresponsavelErrors
  temCorresponsavelFinanceiro: boolean
  onChange: (field: keyof LeasingCorresponsavel, value: string) => void
  onChangeEndereco: (field: keyof LeasingEndereco, value: string) => void
  onSave: () => void
  onDeactivate: () => void
  onClose: () => void
}

export function CorresponsavelModal({
  draft,
  errors,
  temCorresponsavelFinanceiro,
  onChange,
  onChangeEndereco,
  onSave,
  onDeactivate,
  onClose,
}: CorresponsavelModalProps) {
  const modalTitleId = useId()
  const endereco = resolveCorresponsavelEndereco(draft.endereco)

  return (
    <div className="modal corresponsavel-modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content corresponsavel-modal__content">
        <div className="modal-header">
          <h3 id={modalTitleId}>Corresponsável financeiro</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar cadastro do corresponsável">
            ✕
          </button>
        </div>
        <div className="modal-body corresponsavel-modal__body">
          <div className="grid g3">
            <Field label="Nome completo" hint={<FieldError message={errors.nome} />}>
              <input
                value={draft.nome}
                onChange={(event) => onChange('nome', event.target.value)}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="CPF" hint={<FieldError message={errors.cpf} />}>
              <input
                value={draft.cpf}
                onChange={(event) => onChange('cpf', formatCpfCnpj(event.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </Field>
            <Field label="Estado civil">
              <input
                value={draft.estadoCivil}
                onChange={(event) => onChange('estadoCivil', event.target.value)}
                placeholder="Ex.: Solteiro(a)"
              />
            </Field>
          </div>
          <div className="grid g3">
            <Field label="Nacionalidade">
              <input
                value={draft.nacionalidade}
                onChange={(event) => onChange('nacionalidade', event.target.value)}
                placeholder="Ex.: Brasileira"
              />
            </Field>
            <Field label="E-mail" hint={<FieldError message={errors.email} />}>
              <input
                type="email"
                value={draft.email}
                onChange={(event) => onChange('email', event.target.value)}
                placeholder="nome@email.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Telefone" hint={<FieldError message={errors.telefone} />}>
              <input
                value={draft.telefone}
                onChange={(event) => onChange('telefone', event.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
          </div>
          <div className="grid g3">
            <Field label="CEP">
              <input
                value={endereco.cep}
                onChange={(event) => onChangeEndereco('cep', formatCep(event.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
              />
            </Field>
            <Field label="Número">
              <input
                value={endereco.numero}
                onChange={(event) => onChangeEndereco('numero', event.target.value)}
                placeholder="Número"
              />
            </Field>
            <Field label="Complemento">
              <input
                value={endereco.complemento}
                onChange={(event) => onChangeEndereco('complemento', event.target.value)}
                placeholder="Apto, bloco, etc."
              />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Logradouro" hint={<FieldError message={errors.endereco} />}>
                <input
                  value={endereco.logradouro}
                  onChange={(event) => onChangeEndereco('logradouro', event.target.value)}
                  placeholder="Rua, avenida, etc."
                />
              </Field>
            </div>
            <Field label="Bairro">
              <input
                value={endereco.bairro}
                onChange={(event) => onChangeEndereco('bairro', event.target.value)}
                placeholder="Bairro"
              />
            </Field>
            <Field label="Cidade">
              <input
                value={endereco.cidade}
                onChange={(event) => onChangeEndereco('cidade', event.target.value)}
                placeholder="Cidade"
              />
            </Field>
            <Field label="UF">
              <input
                value={endereco.uf}
                onChange={(event) => onChangeEndereco('uf', event.target.value.toUpperCase())}
                placeholder="UF"
                maxLength={2}
              />
            </Field>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancelar
          </button>
          {temCorresponsavelFinanceiro ? (
            <button type="button" className="ghost" onClick={onDeactivate}>
              Desativar
            </button>
          ) : null}
          <button type="button" className="primary" onClick={onSave}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
