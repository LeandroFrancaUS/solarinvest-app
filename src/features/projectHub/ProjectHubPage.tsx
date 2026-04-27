// src/features/projectHub/ProjectHubPage.tsx
// Temporary first version of ProjectHubPage — lists projects created via "Converter em Projeto".
// Access is provided by a temporary button in App.tsx and can be removed without side effects.

import React from 'react'
import { useProjectStore, selectProjetos, type Projeto } from './useProjectStore'

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

interface ProjetoCardProps {
  projeto: Projeto
}

function ProjetoCard({ projeto }: ProjetoCardProps) {
  const { cliente, tipo, status, financeiro, createdAt } = projeto
  return (
    <div
      style={{
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 8,
        padding: '1rem 1.25rem',
        background: 'var(--color-surface, #fff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '1rem' }}>{cliente.nome}</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <span
          style={{
            background: tipo === 'leasing' ? 'var(--color-primary-light, #dbeafe)' : 'var(--color-success-light, #dcfce7)',
            color: tipo === 'leasing' ? 'var(--color-primary, #1d4ed8)' : 'var(--color-success, #16a34a)',
            borderRadius: 4,
            padding: '0.1rem 0.5rem',
            fontWeight: 500,
          }}
        >
          {tipo}
        </span>
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
      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #64748b)' }}>
        <span>Contrato: {formatCurrency(financeiro.valorContrato)}</span>
        {' · '}
        <span>Custo: {formatCurrency(financeiro.custoTotal)}</span>
        {' · '}
        <span>Margem: {formatCurrency(financeiro.margem)}</span>
      </div>
      {tipo === 'leasing' && financeiro.mensalidade !== undefined && (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #64748b)' }}>
          Mensalidade: {formatCurrency(financeiro.mensalidade)}
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: '0.25rem' }}>
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

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {projetos.map((projeto) => (
            <ProjetoCard key={projeto.id} projeto={projeto} />
          ))}
        </div>
      )}
    </div>
  )
}
