// src/features/simulacoes/AfBaseSistemaPanel.tsx
// Extracted from AnaliseFinanceiraSection.tsx (Subfase 2B.12.4B).
// Renders the "Base do sistema" tile with editable system-base overrides.

import type React from 'react'
import { Field } from '../../components/ui/Field'

export interface AfBaseSistemaPanelProps {
  afConsumoOverride: number
  setAfConsumoOverride: (v: number) => void
  afNumModulosOverride: number | null
  setAfNumModulosOverride: (v: number | null) => void
  afModuloWpOverride: number
  setAfModuloWpOverride: (v: number) => void
  afIrradiacaoOverride: number
  setAfIrradiacaoOverride: (v: number) => void
  afPROverride: number
  setAfPROverride: (v: number) => void
  afDiasOverride: number
  setAfDiasOverride: (v: number) => void
  potenciaModulo: number
  baseIrradiacao: number
  eficienciaNormalizada: number
  diasMesNormalizado: number
  selectNumberInputOnFocus: (e: React.FocusEvent<HTMLInputElement>) => void
}

export function AfBaseSistemaPanel({
  afConsumoOverride,
  setAfConsumoOverride,
  afNumModulosOverride,
  setAfNumModulosOverride,
  afModuloWpOverride,
  setAfModuloWpOverride,
  afIrradiacaoOverride,
  setAfIrradiacaoOverride,
  afPROverride,
  setAfPROverride,
  afDiasOverride,
  setAfDiasOverride: _setAfDiasOverride,
  potenciaModulo,
  baseIrradiacao,
  eficienciaNormalizada,
  diasMesNormalizado,
  selectNumberInputOnFocus,
}: AfBaseSistemaPanelProps) {
  return (
    <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
      <h4>Base do sistema</h4>
      <div className="grid g3">
        <Field label="Consumo (kWh/mês)">
          <input
            type="number"
            value={afConsumoOverride}
            min={0}
            onFocus={selectNumberInputOnFocus}
            onChange={(e) => {
              const consumo = Number(e.target.value) || 0
              setAfConsumoOverride(consumo)
              if (consumo > 0) {
                const modWp = afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo
                const irr = afIrradiacaoOverride > 0 ? afIrradiacaoOverride : baseIrradiacao
                const pr = afPROverride > 0 ? afPROverride : eficienciaNormalizada
                const dias = afDiasOverride > 0 ? afDiasOverride : diasMesNormalizado
                const fator = irr * pr * dias
                if (fator > 0 && modWp > 0) {
                  const n = Math.max(1, Math.ceil((consumo / fator * 1000) / modWp))
                  setAfNumModulosOverride(n)
                } else {
                  setAfNumModulosOverride(null)
                }
              } else {
                setAfNumModulosOverride(null)
              }
            }}
          />
        </Field>
        <Field label="Nº de módulos (estimado)">
          <input
            type="number"
            min={0}
            value={afNumModulosOverride ?? 0}
            onFocus={selectNumberInputOnFocus}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value) || 0)
              if (n > 0) {
                setAfNumModulosOverride(n)
                const modWp = afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo
                const irr = afIrradiacaoOverride > 0 ? afIrradiacaoOverride : baseIrradiacao
                const pr = afPROverride > 0 ? afPROverride : eficienciaNormalizada
                const dias = afDiasOverride > 0 ? afDiasOverride : diasMesNormalizado
                const fator = irr * pr * dias
                if (fator > 0 && modWp > 0) {
                  const kwp = (n * modWp) / 1000
                  setAfConsumoOverride(Math.round(kwp * fator * 100) / 100)
                }
              } else {
                setAfNumModulosOverride(null)
                setAfConsumoOverride(0)
              }
            }}
          />
        </Field>
        <Field label="Potência do sistema (kWp)">
          <input
            type="number"
            step="0.01"
            min={0}
            value={
              afNumModulosOverride != null && afNumModulosOverride > 0
                ? ((afNumModulosOverride * (afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo)) / 1000).toFixed(2)
                : '0'
            }
            onFocus={selectNumberInputOnFocus}
            onChange={(e) => {
              const kwp = Number(e.target.value) || 0
              const modWp = afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo
              if (kwp > 0 && modWp > 0) {
                const n = Math.max(1, Math.ceil((kwp * 1000) / modWp))
                setAfNumModulosOverride(n)
                const irr = afIrradiacaoOverride > 0 ? afIrradiacaoOverride : baseIrradiacao
                const pr = afPROverride > 0 ? afPROverride : eficienciaNormalizada
                const dias = afDiasOverride > 0 ? afDiasOverride : diasMesNormalizado
                const fator = irr * pr * dias
                if (fator > 0) {
                  setAfConsumoOverride(Math.round(kwp * fator * 100) / 100)
                }
              } else {
                setAfNumModulosOverride(null)
                setAfConsumoOverride(0)
              }
            }}
          />
        </Field>
        <Field label="Irradiação (kWh/m²/dia)">
          <input
            type="number"
            step="0.01"
            value={afIrradiacaoOverride > 0 ? afIrradiacaoOverride : baseIrradiacao}
            min={0}
            onFocus={selectNumberInputOnFocus}
            onChange={(e) => setAfIrradiacaoOverride(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Performance ratio">
          <input
            type="number"
            step="0.001"
            value={afPROverride > 0 ? afPROverride : eficienciaNormalizada}
            min={0}
            max={1}
            onFocus={selectNumberInputOnFocus}
            onChange={(e) => setAfPROverride(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Módulo (Wp)">
          <input
            type="number"
            value={afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo}
            min={1}
            onFocus={selectNumberInputOnFocus}
            onChange={(e) => {
              const wp = Number(e.target.value) || 0
              setAfModuloWpOverride(wp)
          }}
          />
        </Field>
      </div>
    </div>
  )
}
