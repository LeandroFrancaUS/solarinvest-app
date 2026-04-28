// src/features/projectHub/ProjectHubPage.tsx
// Temporary first version of ProjectHubPage — lists projects created via "Converter em Projeto".
// Access is provided by a temporary button in App.tsx and can be removed without side effects.

import React, { useState } from 'react'
import { useProjectStore, selectProjetos, selectAddProjeto, selectRemoveProjeto, type Projeto, type ProjetoStatus, type ComissaoStatus } from './useProjectStore'
import { isBackendProjectId } from '../../utils/isBackendProjectId'

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
  onSelect: (id: string) => void
}

const PROJETO_STATUS_LABEL: Record<ProjetoStatus, string> = {
  proposta_emitida: 'Proposta emitida',
  contrato_emitido: 'Contrato emitido',
  contrato_assinado: 'Contrato assinado',
  validacao_documental: 'Validação documental',
  validacao_viabilidade: 'Validação de viabilidade',
  aprovado: 'Aprovado',
  ativo: 'Ativo',
  desativado: 'Desativado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const LOCAL_BADGE_STYLE: React.CSSProperties = {
  background: 'var(--color-warning-light, #fef9c3)',
  color: 'var(--color-warning, #a16207)',
  borderRadius: 4,
  padding: '0.1rem 0.5rem',
  fontWeight: 500,
}

function ProjetoCard({ projeto, onSelect }: ProjetoCardProps) {
  const { cliente, tipo, status, consultor } = projeto
  const [focused, setFocused] = useState(false)
  const isBackend = isBackendProjectId(projeto.id)

  function handleActivate() {
    if (!isBackend) return
    onSelect(projeto.id)
  }

  return (
    <div
      role={isBackend ? 'button' : undefined}
      tabIndex={isBackend ? 0 : undefined}
      aria-disabled={!isBackend || undefined}
      onClick={handleActivate}
      onKeyDown={(e) => { if (isBackend && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(projeto.id) } }}
      onFocus={() => isBackend && setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        background: 'var(--color-surface, #fff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        cursor: isBackend ? 'pointer' : 'default',
        opacity: isBackend ? 1 : 0.7,
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
          {PROJETO_STATUS_LABEL[status]}
        </span>
        {!isBackend && (
          <span style={LOCAL_BADGE_STYLE}>local</span>
        )}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #64748b)' }}>
        {consultor
          ? <>Consultor: <strong>{consultor.nome}</strong></>
          : <em>Sem consultor vinculado</em>}
      </div>
      {!isBackend && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-warning, #a16207)', marginTop: '0.2rem' }}>
          Projeto local — converta novamente com cliente vinculado para habilitar cobranças.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Commission automation helper
// ---------------------------------------------------------------------------

/**
 * Returns a Partial<Projeto> patch that updates comissaoConsultor when a
 * status-change triggers a commission payment rule, or null when no action
 * is needed.
 *
 * Rules:
 *  - leasing + status 'ativo'     → mark parcela 1 (40%) as paid
 *  - venda   + status 'concluido' → mark single parcela as paid
 *
 * Idempotent: skips update if the target parcela is already marked as paid.
 */
export function applyComissaoAutomation(
  projeto: Projeto,
  newStatus: ProjetoStatus,
): Partial<Projeto> | null {
  if (!projeto.comissaoConsultor) return null

  const comissao = projeto.comissaoConsultor
  if (!comissao.parcelas?.length) return null

  // Guard: never update status for non-eligible commissions
  if (comissao.status === 'nao_elegivel') return null

  const now = new Date().toISOString()

  // --- Leasing rule: project activated → pay parcela 1 (40%) ---
  if (projeto.tipo === 'leasing' && newStatus === 'ativo') {
    const parcela0 = comissao.parcelas[0]
    if (!parcela0 || parcela0.pago) return null // idempotency guard

    const updatedParcelas = comissao.parcelas.map((p, idx) =>
      idx === 0 ? { ...p, pago: true, pagoEm: now } : p,
    )
    const newValorPago = comissao.valorPago + parcela0.valor
    const hasPending = updatedParcelas.some((p) => !p.pago)
    const newComissaoStatus: ComissaoStatus = hasPending ? 'parcial_pago' : 'pago'

    return {
      comissaoConsultor: {
        ...comissao,
        parcelas: updatedParcelas,
        valorPago: newValorPago,
        status: newComissaoStatus,
      },
    }
  }

  // --- Venda rule: project concluded → pay single parcela ---
  if (projeto.tipo === 'venda' && newStatus === 'concluido') {
    const parcela0 = comissao.parcelas[0]
    if (!parcela0 || parcela0.pago) return null // idempotency guard

    const updatedParcelas = comissao.parcelas.map((p, idx) =>
      idx === 0 ? { ...p, pago: true, pagoEm: now } : p,
    )

    return {
      comissaoConsultor: {
        ...comissao,
        parcelas: updatedParcelas,
        valorPago: comissao.valorPago + parcela0.valor,
        status: 'pago',
      },
    }
  }

  // Future extension (not yet active):
  // if (projeto.tipo === 'leasing' && newStatus === 'mensalidade_paga') {
  //   // parcela 2 (60%) — first invoice paid
  //   const parcela1 = comissao.parcelas[1]
  //   if (!parcela1 || parcela1.pago) return null
  //   const updatedParcelas = comissao.parcelas.map((p, idx) =>
  //     idx === 1 ? { ...p, pago: true, pagoEm: now } : p,
  //   )
  //   const newValorPago = comissao.valorPago + parcela1.valor
  //   const hasPending = updatedParcelas.some((p) => !p.pago)
  //   const newComissaoStatus: ComissaoStatus = hasPending ? 'parcial_pago' : 'pago'
  //   return { comissaoConsultor: { ...comissao, parcelas: updatedParcelas, valorPago: newValorPago, status: newComissaoStatus } }
  // }

  return null
}

// ---------------------------------------------------------------------------

interface ProjectHubPageProps {
  onBack: () => void
  onOpenProjectDetail: (id: string) => void
}

export function ProjectHubPage({ onBack, onOpenProjectDetail }: ProjectHubPageProps) {
  const projetos = useProjectStore(selectProjetos)
  const addProjeto = useProjectStore(selectAddProjeto)
  const removeProjeto = useProjectStore(selectRemoveProjeto)
  const [showForm, setShowForm] = useState(false)
  const [formNome, setFormNome] = useState('')
  const [formTipo, setFormTipo] = useState<'venda' | 'leasing'>('venda')
  const [formPagamento, setFormPagamento] = useState<'avista' | 'parcelado'>('avista')

  const localProjects = projetos.filter((p) => !isBackendProjectId(p.id))

  function handleSalvarProjeto() {
    if (!formNome.trim()) return
    addProjeto({
      id: crypto.randomUUID(),
      tipo: formTipo,
      status: 'proposta_emitida',
      cliente: { nome: formNome.trim() },
      financeiro: { valorContrato: 0, custoTotal: 0, margem: 0 },
      pagamento: { modalidade: formPagamento },
      createdAt: new Date().toISOString(),
    })
    setFormNome('')
    setFormTipo('venda')
    setFormPagamento('avista')
    setShowForm(false)
  }

  function handleLimparLocais() {
    localProjects.forEach((p) => removeProjeto(p.id))
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {localProjects.length > 0 && (
            <button
              type="button"
              className="ghost"
              onClick={handleLimparLocais}
              title="Remove projetos sem ID de backend (não afeta dados no servidor)"
            >
              Limpar projetos locais ({localProjects.length})
            </button>
          )}
          <button type="button" className="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Novo Projeto'}
          </button>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            background: 'var(--color-surface, #fff)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'flex-end',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 200, flex: '1 1 200px' }}>
            <label htmlFor="novo-projeto-nome" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary, #64748b)' }}>
              Nome do cliente *
            </label>
            <input
              id="novo-projeto-nome"
              type="text"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Ex: João Silva"
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 4,
                border: '1px solid var(--color-border, #e2e8f0)',
                fontSize: '0.875rem',
                background: 'var(--color-surface, #fff)',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="novo-projeto-tipo" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary, #64748b)' }}>
              Tipo *
            </label>
            <select
              id="novo-projeto-tipo"
              value={formTipo}
              onChange={(e) => setFormTipo(e.target.value as 'venda' | 'leasing')}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 4,
                border: '1px solid var(--color-border, #e2e8f0)',
                fontSize: '0.875rem',
                background: 'var(--color-surface, #fff)',
              }}
            >
              <option value="venda">Venda</option>
              <option value="leasing">Leasing</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="novo-projeto-pagamento" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary, #64748b)' }}>
              Pagamento
            </label>
            <select
              id="novo-projeto-pagamento"
              value={formPagamento}
              onChange={(e) => setFormPagamento(e.target.value as 'avista' | 'parcelado')}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 4,
                border: '1px solid var(--color-border, #e2e8f0)',
                fontSize: '0.875rem',
                background: 'var(--color-surface, #fff)',
              }}
            >
              <option value="avista">À vista</option>
              <option value="parcelado">Parcelado</option>
            </select>
          </div>
          <button
            type="button"
            className="primary"
            onClick={handleSalvarProjeto}
            disabled={!formNome.trim()}
          >
            Salvar Projeto
          </button>
        </div>
      )}

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
            Use o botão <strong>"Novo Projeto"</strong> acima para criar o primeiro projeto.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {projetos.map((projeto) => (
            <ProjetoCard
              key={projeto.id}
              projeto={projeto}
              onSelect={onOpenProjectDetail}
            />
          ))}
        </div>
      )}
    </div>
  )
}
