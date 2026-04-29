// src/components/portfolio/UfConfigurationFields.tsx
// Reusable UF (solar plant) configuration fields component.
// Extracts and reuses the same fields from the "Configuração da UF" section.

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

const TIPO_INSTALACAO_OPTIONS = [
  { value: '', label: 'Selecione…' },
  { value: 'fibrocimento', label: 'Fibrocimento' },
  { value: 'metalico', label: 'Metálico' },
  { value: 'ceramico', label: 'Cerâmico' },
  { value: 'laje', label: 'Laje' },
  { value: 'solo', label: 'Solo' },
  { value: 'outros', label: 'Outros' },
]

const TIPO_REDE_OPTIONS = [
  { value: 'nenhum', label: 'Selecione…' },
  { value: 'monofasico', label: 'Monofásico' },
  { value: 'bifasico', label: 'Bifásico' },
  { value: 'trifasico', label: 'Trifásico' },
]

const WIFI_STATUS_OPTIONS = [
  { value: '', label: 'Selecione…' },
  { value: 'conectado', label: '🟢 Conectado' },
  { value: 'desconectado', label: '🟡 Desconectado' },
  { value: 'falha', label: '🔴 Falha' },
]

const POTENCIA_MODULO_OPTIONS = [440, 450, 455, 460, 465, 470, 475, 480, 505, 540, 545, 550, 555, 560, 565, 570, 575, 580, 585, 590, 595, 600, 605, 610, 615, 620, 625, 630, 635, 640, 645, 650, 655, 660, 665, 670, 700]

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  boxSizing: 'border-box' as const,
}

const labelStyle: React.CSSProperties = {}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}

function isConcluido(status?: string | null): boolean {
  const normalized = String(status ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalized === 'concluido'
}

export function UfConfigurationFields({ data, onChange, readOnly, installationStatus }: UfConfigurationFieldsProps) {
  const wifiEnabled = !readOnly && isConcluido(installationStatus)

  return (
    <div className="pf-section-card">
      <div className="pf-section-title">
        <span className="pf-icon">☀️</span> Usina Fotovoltaica
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={gridStyle}>
          <label className="pf-label" style={labelStyle}>
            Potência do módulo (Wp)
            <select
              value={data.potencia_modulo_wp}
              onChange={(e) => onChange('potencia_modulo_wp', e.target.value)}
              disabled={readOnly}
              style={inputStyle}
            >
              <option value="">Selecione…</option>
              {POTENCIA_MODULO_OPTIONS.map((opt) => (
                <option key={opt} value={String(opt)}>{opt}</option>
              ))}
            </select>
          </label>
          <label className="pf-label" style={labelStyle}>
            Nº de módulos
            <input
              type="number"
              min={0}
              step={1}
              value={data.numero_modulos}
              onChange={(e) => onChange('numero_modulos', e.target.value)}
              readOnly={readOnly}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={gridStyle}>
          <label className="pf-label" style={labelStyle}>
            Tipo de rede
            <select
              value={data.tipo_rede}
              onChange={(e) => onChange('tipo_rede', e.target.value)}
              disabled={readOnly}
              style={inputStyle}
            >
              {TIPO_REDE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="pf-label" style={labelStyle}>
            Tipo de instalação
            <select
              value={data.tipo_instalacao}
              onChange={(e) => onChange('tipo_instalacao', e.target.value)}
              disabled={readOnly}
              style={inputStyle}
            >
              {TIPO_INSTALACAO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="pf-label" style={labelStyle}>
          Status WiFi / Monitoramento
          <select
            value={data.wifi_status ?? ''}
            onChange={(e) => onChange('wifi_status', e.target.value)}
            disabled={!wifiEnabled}
            style={inputStyle}
          >
            {WIFI_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {!wifiEnabled && (
            <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>
              Disponível após status de instalação em Projeto ficar Concluído.
            </small>
          )}
        </label>

        <div style={gridStyle}>
          <label className="pf-label" style={labelStyle}>
            Potência do sistema (kWp)
            <input
              type="number"
              min={0}
              step="0.01"
              value={data.potencia_kwp}
              onChange={(e) => onChange('potencia_kwp', e.target.value)}
              readOnly={readOnly}
              style={inputStyle}
            />
          </label>
          <label className="pf-label" style={labelStyle}>
            Geração estimada (kWh/mês)
            <input
              type="number"
              min={0}
              value={data.geracao_estimada_kwh}
              onChange={(e) => onChange('geracao_estimada_kwh', e.target.value)}
              readOnly={readOnly}
              style={inputStyle}
            />
          </label>
        </div>

        <label className="pf-label" style={labelStyle}>
          Área utilizada (m²)
          <input
            type="number"
            min={0}
            step="0.1"
            value={data.area_instalacao_m2}
            onChange={(e) => onChange('area_instalacao_m2', e.target.value)}
            readOnly={readOnly}
            style={inputStyle}
          />
        </label>

        <div style={gridStyle}>
          <label className="pf-label" style={labelStyle}>
            Modelo do módulo
            <input
              type="text"
              value={data.modelo_modulo}
              onChange={(e) => onChange('modelo_modulo', e.target.value)}
              readOnly={readOnly}
              style={inputStyle}
            />
          </label>
          <label className="pf-label" style={labelStyle}>
            Modelo do inversor
            <input
              type="text"
              value={data.modelo_inversor}
              onChange={(e) => onChange('modelo_inversor', e.target.value)}
              readOnly={readOnly}
              style={inputStyle}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
