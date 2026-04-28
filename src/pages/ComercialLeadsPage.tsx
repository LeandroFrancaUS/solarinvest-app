// src/pages/ComercialLeadsPage.tsx
// Área Comercial — Leads (Etapa 3)
// Exibe leads do CRM filtrados por etapa !== 'fechado' (status_comercial != 'GANHO').
// Reaproveitamento do CrmPage existente: filtra os dados e exibe tabela simplificada.

import React, { useState, useMemo } from 'react'
import { CRM_PIPELINE_STAGES } from '../features/crm/crmConstants'
import type { CrmLeadRecord, CrmStageId } from '../features/crm/crmTypes'
import { formatarDataCurta } from '../features/crm/crmUtils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComercialLeadsPageProps {
  leads: CrmLeadRecord[]
  onAbrirLead: (leadId: string) => void
  onAbrirCrmCompleto: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeSearch = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const STAGE_LABELS: Record<CrmStageId, string> = Object.fromEntries(
  CRM_PIPELINE_STAGES.map((s) => [s.id, s.label]),
) as Record<CrmStageId, string>

const STAGE_COLORS: Record<CrmStageId, string> = {
  'novo-lead': '#3b82f6',
  qualificacao: '#8b5cf6',
  'proposta-enviada': '#f59e0b',
  negociacao: '#ec4899',
  'aguardando-contrato': '#14b8a6',
  fechado: '#22c55e',
}

const TIPO_OPERACAO_LABELS: Record<CrmLeadRecord['tipoOperacao'], string> = {
  LEASING: 'Leasing',
  VENDA_DIRETA: 'Venda direta',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComercialLeadsPage({ leads, onAbrirLead, onAbrirCrmCompleto }: ComercialLeadsPageProps) {
  const [busca, setBusca] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState<CrmStageId | 'all'>('all')
  const [filtroTipo, setFiltroTipo] = useState<CrmLeadRecord['tipoOperacao'] | 'all'>('all')

  // Filtra leads: exclui 'fechado' (= GANHO) e aplica filtros adicionais
  const leadsFiltrados = useMemo(() => {
    return leads
      .filter((l) => l.etapa !== 'fechado')
      .filter((l) => filtroEtapa === 'all' || l.etapa === filtroEtapa)
      .filter((l) => filtroTipo === 'all' || l.tipoOperacao === filtroTipo)
      .filter((l) => {
        if (!busca) return true
        const query = normalizeSearch(busca)
        const nome = normalizeSearch(l.nome)
        const cidade = normalizeSearch(l.cidade)
        const origem = normalizeSearch(l.origemLead)
        return nome.includes(query) || cidade.includes(query) || origem.includes(query)
      })
  }, [leads, busca, filtroEtapa, filtroTipo])

  // Estágios sem 'fechado'
  const etapasVisiveis = CRM_PIPELINE_STAGES.filter((s) => s.id !== 'fechado')

  return (
    <div className="page comercial-leads-page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Leads</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #6b7280)', fontSize: '0.875rem' }}>
            Leads em andamento (excluindo fechados)
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={onAbrirCrmCompleto}
          style={{ fontSize: '0.875rem' }}
        >
          🗂️ CRM Completo
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <label htmlFor="cl-busca" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Buscar
          </label>
          <input
            id="cl-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, cidade ou origem…"
            style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border, #d1d5db)', fontSize: '0.875rem', minWidth: '220px' }}
          />
        </div>

        <div>
          <label htmlFor="cl-etapa" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Etapa
          </label>
          <select
            id="cl-etapa"
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value as CrmStageId | 'all')}
            style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border, #d1d5db)', fontSize: '0.875rem' }}
          >
            <option value="all">Todas as etapas</option>
            {etapasVisiveis.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cl-tipo" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Tipo
          </label>
          <select
            id="cl-tipo"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as CrmLeadRecord['tipoOperacao'] | 'all')}
            style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border, #d1d5db)', fontSize: '0.875rem' }}
          >
            <option value="all">Todos os tipos</option>
            <option value="LEASING">Leasing</option>
            <option value="VENDA_DIRETA">Venda direta</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      {leadsFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted, #6b7280)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛰️</div>
          <p style={{ margin: 0 }}>Nenhum lead encontrado.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border, #e5e7eb)' }}>
                <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', fontWeight: 600 }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', fontWeight: 600 }}>Origem</th>
                <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', fontWeight: 600 }}>Tipo</th>
                <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', fontWeight: 600 }}>Último contato</th>
                <th style={{ padding: '0.625rem 0.75rem' }} />
              </tr>
            </thead>
            <tbody>
              {leadsFiltrados.map((lead) => (
                <tr
                  key={lead.id}
                  style={{ borderBottom: '1px solid var(--color-border, #f3f4f6)', cursor: 'pointer' }}
                  onClick={() => onAbrirLead(lead.id)}
                >
                  <td style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>{lead.nome}</td>
                  <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
                    {lead.origemLead || '—'}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem' }}>
                    {TIPO_OPERACAO_LABELS[lead.tipoOperacao]}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: `${STAGE_COLORS[lead.etapa]}22`,
                        color: STAGE_COLORS[lead.etapa],
                        border: `1px solid ${STAGE_COLORS[lead.etapa]}44`,
                      }}
                    >
                      {STAGE_LABELS[lead.etapa]}
                    </span>
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
                    {formatarDataCurta(lead.ultimoContatoIso)}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                      onClick={(e) => { e.stopPropagation(); onAbrirLead(lead.id) }}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
            {leadsFiltrados.length} lead{leadsFiltrados.length !== 1 ? 's' : ''} exibido{leadsFiltrados.length !== 1 ? 's' : ''}.
            {' '}
            <em>Nota: campos Responsável e Próxima ação dependem de evolução futura do backend.</em>
          </p>
        </div>
      )}
    </div>
  )
}
