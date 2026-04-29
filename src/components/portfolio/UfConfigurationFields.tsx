// src/components/portfolio/UfConfigurationFields.tsx
import React from 'react'

export interface UfConfigData {
  potencia_modulo_wp: string
  numero_modulos: string
  modelo_modulo: string
  modelo_inversor: string
  tipo_instalacao: string
  area_instalacao_m2: string
  geracao_estimada_kwh: string
  potencia_kwp: string
  tipo_rede: string
  wifi_status?: 'conectado' | 'desconectado' | 'falha' | '' | null
}

interface UfConfigurationFieldsProps {
  data: UfConfigData
  onChange: (field: keyof UfConfigData, value: string) => void
  readOnly?: boolean
  installationStatus?: string | null
}

const WIFI_STATUS_OPTIONS = [
  { value: '', label: 'Selecione…' },
  { value: 'conectado', label: '🟢 Conectado' },
  { value: 'desconectado', label: '🟡 Desconectado' },
  { value: 'falha', label: '🔴 Falha' },
]

function isConcluido(status?: string | null): boolean {
  const normalized = String(status ?? '').toLowerCase()
  return normalized.includes('concluido')
}

export function UfConfigurationFields({ data, onChange, readOnly, installationStatus }: UfConfigurationFieldsProps) {
  const isEditing = readOnly === false
  const wifiEnabled = isEditing && isConcluido(installationStatus)

  return (
    <div className="pf-section-card">
      <div className="pf-section-title">
        ☀️ Usina Fotovoltaica
      </div>

      <label>
        Status WiFi / Monitoramento
        <select
          value={data.wifi_status ?? ''}
          onChange={(e) => onChange('wifi_status', e.target.value)}
          disabled={!wifiEnabled}
        >
          {WIFI_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {!isEditing && <small>Somente em modo edição</small>}
        {isEditing && !isConcluido(installationStatus) && (
          <small>Disponível após instalação concluída</small>
        )}
      </label>
    </div>
  )
}
