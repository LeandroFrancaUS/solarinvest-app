/**
 * useAdminSettingsDraft.ts
 *
 * Owns all settings-page draft state that represents pending admin edits
 * not yet saved to the vendasConfig store:
 *
 *   - settingsTab            — active tab on the Settings page
 *   - aprovadoresText        — newline-separated approvers draft
 *   - impostosOverridesDraft — tax-regime overrides draft
 *
 * Also derives two read-only memos consumed by the settings form:
 *   - arredondarPasso    — validated rounding step from vendasConfig
 *   - aprovadoresResumo  — comma-joined summary of current approvers
 *
 * Params:
 *   - vendasConfig — the current vendasConfig; used to derive memo values
 *     and to initialise the draft fields on first render.
 *
 * Zero behavioural change — exact same logic as the original App.tsx blocks.
 */

import { useMemo, useState } from 'react'
import { cloneImpostosOverrides } from '../utils/vendasHelpers'
import type { ImpostosRegimeConfig } from '../lib/venda/calcComposicaoUFV'
import type { VendasConfig } from '../types/vendasConfig'
import { INITIAL_VALUES, type SettingsTabKey } from '../app/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseAdminSettingsDraftOptions {
  vendasConfig: VendasConfig
}

export interface UseAdminSettingsDraftResult {
  settingsTab: SettingsTabKey
  setSettingsTab: React.Dispatch<React.SetStateAction<SettingsTabKey>>
  aprovadoresText: string
  setAprovadoresText: React.Dispatch<React.SetStateAction<string>>
  impostosOverridesDraft: Partial<ImpostosRegimeConfig>
  setImpostosOverridesDraft: React.Dispatch<React.SetStateAction<Partial<ImpostosRegimeConfig>>>
  /** Validated rounding step derived from vendasConfig.arredondar_venda_para */
  arredondarPasso: 1 | 10 | 50 | 100
  /** Comma-joined summary of current approvers from vendasConfig */
  aprovadoresResumo: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminSettingsDraft({
  vendasConfig,
}: UseAdminSettingsDraftOptions): UseAdminSettingsDraftResult {
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>(INITIAL_VALUES.settingsTab)

  const [aprovadoresText, setAprovadoresText] = useState(() =>
    vendasConfig.aprovadores.join('\n'),
  )

  const [impostosOverridesDraft, setImpostosOverridesDraft] = useState<
    Partial<ImpostosRegimeConfig>
  >(() => cloneImpostosOverrides(vendasConfig.impostosRegime_overrides))

  const arredondarPasso = useMemo((): 1 | 10 | 50 | 100 => {
    const raw = Number(vendasConfig.arredondar_venda_para)
    return raw === 1 || raw === 10 || raw === 50 || raw === 100 ? raw : 100
  }, [vendasConfig.arredondar_venda_para])

  const aprovadoresResumo = useMemo(() => {
    if (!Array.isArray(vendasConfig.aprovadores) || vendasConfig.aprovadores.length === 0) {
      return ''
    }
    return vendasConfig.aprovadores.join(', ')
  }, [vendasConfig.aprovadores])

  return {
    settingsTab,
    setSettingsTab,
    aprovadoresText,
    setAprovadoresText,
    impostosOverridesDraft,
    setImpostosOverridesDraft,
    arredondarPasso,
    aprovadoresResumo,
  }
}
