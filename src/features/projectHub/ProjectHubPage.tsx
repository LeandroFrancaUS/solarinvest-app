// src/features/projectHub/ProjectHubPage.tsx
// Temporary first version of ProjectHubPage — lists projects created via "Converter em Projeto".
// Access is provided by a temporary button in App.tsx and can be removed without side effects.

import React, { useState } from 'react'
import { useProjectStore, selectProjetos, selectUpdateProjeto, type Projeto, type ProjetoStatus } from './useProjectStore'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getTipoBadgeStyles(tipo: string): React.CSSProperties {
  if (tipo === 'leasing') {
    return {
      background: 'var(--color-primary-light, #dbeafe)',
      color: 'var(--color-primary, #1d4ed8)',
      borderRadius: 4,
      padding: '0.1rem 0.5rem',
      fontWeight: 500,
    }
  }
  return {
    background: 'var(--color-success-light, #dcfce7)',
    color: 'var(--color-success, #16a34a)',
    borderRadius: 4,
    padding: '0.1rem 0.5rem',
    fontWeight: 500,
  }
}

interface ProjetoCardProps {
  projeto: Projeto
  selected: boolean
  onSelect: (id: string) => void
}

function ProjetoCard({ projeto, selected, onSelect }: ProjetoCardProps) {
  const { cliente, tipo, status } = projeto
  const [focused, setFocused] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(projeto.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(projeto.id) } }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        border: selected
          ? '2px solid var(--color-primary, #1d4ed8)'
          : '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        background: selected
          ? 'var(--color-primary-light, #dbeafe)'
          : 'var(--color-surface, #fff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        cursor: 'pointer',
        outline: focused ? '2px solid var(--color-primary, #1d4ed8)' : 'none',
        outlineOffset: 2,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{cliente.nome}</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
        <span style={getTipoBadgeStyles(tipo)}>{tipo}</span>
        <span
          style={{
            background: 'var(--color-muted-bg, #f1f5f9)',
            borderRadius: 4,
            padding: '0.1rem 0.5rem',
          }}
        >
          {status}
        </span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #64748b)' }}>
        {projeto.consultor
          ? <>Consultor: <strong>{projeto.consultor.nome}</strong></>
          : 'Sem consultor vinculado'}
      </div>
    </div>
  )
}

interface ProjetoDetailProps {
  projeto: Projeto
  onStatusChange: (id: string, status: ProjetoStatus) => void
}

const STATUS_OPTIONS: ProjetoStatus[] = ['aprovado', 'implantacao', 'ativo', 'monitoramento', 'finalizado']

function ProjetoDetail({ projeto, onStatusChange }: ProjetoDetailProps) {
  const { cliente, tipo, status, financeiro, createdAt } = projeto
  return (
    <div
      style={{
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 8,
        padding: '1.5rem',
        background: 'var(--color-surface, #fff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{cliente.nome}</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <span style={getTipoBadgeStyles(tipo)}>{tipo}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
        <label htmlFor={`status-select-${projeto.id}`} style={{ color: 'var(--color-text-secondary, #64748b)', whiteSpace: 'nowrap' }}>
          Status:
        </label>
        <select
          id={`status-select-${projeto.id}`}
          value={status}
          onChange={(e) => onStatusChange(projeto.id, e.target.value as ProjetoStatus)}
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: 4,
            border: '1px solid var(--color-border, #e2e8f0)',
            background: 'var(--color-surface, #fff)',
            fontSize: '0.875rem',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e2e8f0)', margin: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem' }}>
        <div>
          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Valor do Contrato: </span>
          <strong>{formatCurrency(financeiro.valorContrato)}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Custo Total: </span>
          <strong>{formatCurrency(financeiro.custoTotal)}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Margem: </span>
          <strong>{formatCurrency(financeiro.margem)}</strong>
        </div>
        {tipo === 'leasing' && financeiro.mensalidade !== undefined && (
          <div>
            <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Mensalidade: </span>
            <strong>{formatCurrency(financeiro.mensalidade)}</strong>
          </div>
        )}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e2e8f0)', margin: 0 }} />
      {/* Consultor */}
      <div style={{ fontSize: '0.875rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Consultor</div>
        {projeto.consultor
          ? <div><strong>{projeto.consultor.nome}</strong></div>
          : <div style={{ color: 'var(--color-text-secondary, #64748b)' }}>Sem consultor vinculado</div>}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e2e8f0)', margin: 0 }} />
      {/* Comissão */}
      <div style={{ fontSize: '0.875rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Comissão de Consultor</div>
        {projeto.comissaoConsultor ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Regra: </span>
              <strong>{projeto.comissaoConsultor.regra}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Valor estimado: </span>
              <strong>{formatCurrency(projeto.comissaoConsultor.valorTotalEstimado)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Valor pago: </span>
              <strong>{formatCurrency(projeto.comissaoConsultor.valorPago)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Status: </span>
              <strong>{projeto.comissaoConsultor.status}</strong>
            </div>
            <div style={{ marginTop: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-secondary, #64748b)' }}>
              Parcelas:
            </div>
            {projeto.comissaoConsultor.parcelas.map((parcela, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--color-muted-bg, #f1f5f9)',
                  borderRadius: 6,
                  padding: '0.4rem 0.6rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ fontWeight: 600 }}>{parcela.descricao}</div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Percentual: </span>
                  {parcela.percentual}%
                  <span style={{ marginLeft: '0.75rem', color: 'var(--color-text-secondary, #64748b)' }}>Valor: </span>
                  {formatCurrency(parcela.valor)}
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Gatilho: </span>
                  {parcela.gatilho}
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Pago: </span>
                  {parcela.pago ? `Sim${parcela.pagoEm ? ` (${formatDate(parcela.pagoEm)})` : ''}` : 'Não'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-secondary, #64748b)' }}>Sem comissão de consultor vinculada</div>
        )}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #94a3b8)' }}>
        Criado em {formatDate(createdAt)}
      </div>
    </div>
  )
}

interface ProjectHubPageProps {
  onBack: () => void
}

export function ProjectHubPage({ onBack }: ProjectHubPageProps) {
  const projetos = useProjectStore(selectProjetos)
  const updateProjeto = useProjectStore(selectUpdateProjeto)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const selectedProject = projetos.find((p) => p.id === selectedProjectId) ?? null

  function handleStatusChange(id: string, status: ProjetoStatus) {
    updateProjeto(id, { status })
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button type="button" className="ghost" onClick={onBack}>
          ← Voltar
        </button>
        <h2 style={{ margin: 0 }}>Project Hub</h2>
        <span
          style={{
            background: 'var(--color-muted-bg, #f1f5f9)',
            borderRadius: 12,
            padding: '0.1rem 0.65rem',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {projetos.length} {projetos.length === 1 ? 'projeto' : 'projetos'}
        </span>
      </div>

      {projetos.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: 'var(--color-text-secondary, #64748b)',
            border: '2px dashed var(--color-border, #e2e8f0)',
            borderRadius: 8,
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem' }}>Nenhum projeto criado ainda.</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
            Use o botão <strong>"Converter em Projeto"</strong> na Análise Financeira para criar projetos.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Project list column */}
          <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {projetos.map((projeto) => (
              <ProjetoCard
                key={projeto.id}
                projeto={projeto}
                selected={projeto.id === selectedProjectId}
                onSelect={setSelectedProjectId}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedProject ? (
              <ProjetoDetail projeto={selectedProject} onStatusChange={handleStatusChange} />
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--color-text-secondary, #64748b)',
                  border: '2px dashed var(--color-border, #e2e8f0)',
                  borderRadius: 8,
                }}
              >
                Selecione um projeto para ver os detalhes
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
