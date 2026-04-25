// src/components/LeasingContratoSection.tsx
// "Dados contratuais do leasing" card shown in the leasing tab.
// Pure presentational component; all state and handlers live in App.tsx.

import * as React from 'react'
import { Field } from './ui/Field'
import {
  type LeasingContratoDados,
  type LeasingContratoProprietario,
} from '../store/useLeasingStore'

export type LeasingContratoSectionProps = {
  leasingContrato: LeasingContratoDados
  leasingHomologacaoInputId: string
  clienteDiaVencimento: string
  onCampoChange: <K extends keyof LeasingContratoDados>(key: K, value: LeasingContratoDados[K]) => void
  onClienteDiaVencimentoChange: (value: string) => void
  onProprietarioChange: (index: number, campo: keyof LeasingContratoProprietario, valor: string) => void
  onAdicionarProprietario: () => void
  onRemoverProprietario: (index: number) => void
}

function LeasingLabel({ text }: { text: string }) {
  return <span className="leasing-field-label-text">{text}</span>
}

export function LeasingContratoSection({
  leasingContrato,
  leasingHomologacaoInputId,
  clienteDiaVencimento,
  onCampoChange,
  onClienteDiaVencimentoChange,
  onProprietarioChange,
  onAdicionarProprietario,
  onRemoverProprietario,
}: LeasingContratoSectionProps) {
  const isCondominioContrato = leasingContrato.tipoContrato === 'condominio'
  const tipoContratoSelecionado = leasingContrato.tipoContrato

  return (
    <section className="card leasing-contract-card">
      <div className="card-header">
        <h2>Dados contratuais do leasing</h2>
      </div>
      <div className="leasing-form-grid">
        <div className="leasing-contract-dates-grid">
          <Field label="Tipo de contrato">
            <div
              className="flex flex-row gap-3 items-center leasing-contract-toggle-group"
              role="radiogroup"
              aria-label="Tipo de contrato"
            >
              <button
                type="button"
                role="radio"
                aria-checked={tipoContratoSelecionado === 'residencial'}
                className={`leasing-contract-toggle${
                  tipoContratoSelecionado === 'residencial' ? ' is-active' : ''
                }`}
                onClick={() => onCampoChange('tipoContrato', 'residencial')}
              >
                Residencial
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={tipoContratoSelecionado === 'condominio'}
                className={`leasing-contract-toggle${
                  tipoContratoSelecionado === 'condominio' ? ' is-active' : ''
                }`}
                onClick={() => onCampoChange('tipoContrato', 'condominio')}
              >
                Condomínio
              </button>
            </div>
          </Field>
          <Field label={<LeasingLabel text="Data de início do contrato" />}>
            <input
              className="leasing-compact-input"
              type="date"
              value={leasingContrato.dataInicio}
              onChange={(event) => onCampoChange('dataInicio', event.target.value)}
            />
          </Field>
          <Field label={<LeasingLabel text="Data de término do contrato" />}>
            <input
              className="leasing-compact-input"
              type="date"
              value={leasingContrato.dataFim}
              onChange={(event) => onCampoChange('dataFim', event.target.value)}
            />
          </Field>
          <Field label={<LeasingLabel text="Dia de vencimento da mensalidade" />}>
            <select
              className="leasing-compact-input"
              value={clienteDiaVencimento || '10'}
              onChange={(event) => onClienteDiaVencimentoChange(event.target.value)}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={String(day)}>
                  Dia {day}
                </option>
              ))}
            </select>
          </Field>
          <Field label={<LeasingLabel text="Data da homologação (opcional)" />}>
            <input
              id={leasingHomologacaoInputId}
              className="leasing-compact-input"
              type="date"
              value={leasingContrato.dataHomologacao}
              onChange={(event) => onCampoChange('dataHomologacao', event.target.value)}
            />
          </Field>
        </div>
        <div className="leasing-equipments-grid">
          <Field label="Módulos fotovoltaicos instalados">
            <textarea
              value={leasingContrato.modulosFV}
              onChange={(event) => onCampoChange('modulosFV', event.target.value)}
              rows={2}
            />
          </Field>
          <Field label="Inversores instalados">
            <textarea
              value={leasingContrato.inversoresFV}
              onChange={(event) => onCampoChange('inversoresFV', event.target.value)}
              rows={2}
            />
          </Field>
        </div>
        {isCondominioContrato ? (
          <div className="leasing-condominio-grid">
            <Field label="Nome do condomínio">
              <input
                value={leasingContrato.nomeCondominio}
                onChange={(event) => onCampoChange('nomeCondominio', event.target.value)}
              />
            </Field>
            <Field label="CNPJ do condomínio">
              <input
                value={leasingContrato.cnpjCondominio}
                onChange={(event) => onCampoChange('cnpjCondominio', event.target.value)}
              />
            </Field>
            <Field label="Nome do síndico">
              <input
                value={leasingContrato.nomeSindico}
                onChange={(event) => onCampoChange('nomeSindico', event.target.value)}
              />
            </Field>
            <Field label="CPF do síndico">
              <input
                value={leasingContrato.cpfSindico}
                onChange={(event) => onCampoChange('cpfSindico', event.target.value)}
              />
            </Field>
            <Field
              label="Proprietários / representantes legais (autorização do proprietário)"
              hint="Inclua o nome e o CPF/CNPJ que devem constar no termo de autorização."
            >
              <div className="cliente-herdeiros-group">
                {leasingContrato.proprietarios.map((proprietario, index) => (
                  <div className="cliente-herdeiro-row" key={`leasing-proprietario-${index}`}>
                    <input
                      value={proprietario.nome}
                      onChange={(event) =>
                        onProprietarioChange(index, 'nome', event.target.value)
                      }
                      placeholder={`Nome do proprietário ${index + 1}`}
                    />
                    <input
                      value={proprietario.cpfCnpj}
                      onChange={(event) =>
                        onProprietarioChange(index, 'cpfCnpj', event.target.value)
                      }
                      placeholder="CPF ou CNPJ"
                    />
                    <button
                      type="button"
                      className="ghost cliente-herdeiro-remove"
                      onClick={() => onRemoverProprietario(index)}
                      aria-label={`Remover proprietário ${index + 1}`}
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <div className="cliente-herdeiros-actions">
                  <button
                    type="button"
                    className="ghost cliente-herdeiro-add"
                    onClick={onAdicionarProprietario}
                  >
                    Adicionar proprietário
                  </button>
                </div>
              </div>
            </Field>
          </div>
        ) : null}
      </div>
    </section>
  )
}
