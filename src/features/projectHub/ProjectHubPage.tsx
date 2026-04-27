// src/features/projectHub/ProjectHubPage.tsx
// Temporary first version of ProjectHubPage — lists projects created via "Converter em Projeto".
// Access is provided by a temporary button in App.tsx and can be removed without side effects.

import React, { useState } from 'react'
import { useProjectStore, selectProjetos, selectUpdateProjeto, selectAddProjeto, type Projeto, type ProjetoStatus, type ProjetoStatusLeasing, type ProjetoStatusVenda, type ComissaoStatus, type AprovacaoDocumental, type AprovacaoViabilidade } from './useProjectStore'

const DOCUMENTAL_ITEMS: { key: keyof AprovacaoDocumental; label: string }[] = [
  { key: 'comprovacaoRenda', label: 'Comprovação de Renda' },
  { key: 'analiseCreditoSerasa', label: 'Análise de Crédito (Serasa)' },
  { key: 'faturasDistribuidoraSemAtraso', label: 'Faturas da Distribuidora Sem Atraso' },
]

const VIABILIDADE_ITEMS: { key: keyof AprovacaoViabilidade; label: string }[] = [
  { key: 'areaInstalacaoCompativel', label: 'Área de Instalação Compatível' },
  { key: 'padraoRelogioAprovadoEngenharia', label: 'Padrão de Relógio Aprovado pela Engenharia' },
]

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

const COMISSAO_STATUS_LABEL: Record<ComissaoStatus, string> = {
  nao_elegivel: 'Não elegível',
  adiantamento_disponivel: 'Adiantamento disponível',
  adiantamento_pago: 'Adiantamento pago',
  parcial_pago: 'Parcialmente pago',
  pago: 'Pago',
  estornado: 'Estornado',
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

function ProjetoCard({ projeto, selected, onSelect }: ProjetoCardProps) {
  const { cliente, tipo, status, consultor } = projeto
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
          {PROJETO_STATUS_LABEL[status]}
        </span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #64748b)' }}>
        {consultor
          ? <>Consultor: <strong>{consultor.nome}</strong></>
          : <em>Sem consultor vinculado</em>}
      </div>
    </div>
  )
}

interface ProjetoDetailProps {
  projeto: Projeto
  onStatusChange: (id: string, status: ProjetoStatus) => void
}

const STATUS_OPTIONS_LEASING: ProjetoStatusLeasing[] = [
  'proposta_emitida',
  'contrato_emitido',
  'contrato_assinado',
  'validacao_documental',
  'validacao_viabilidade',
  'aprovado',
  'ativo',
  'desativado',
  'cancelado',
]

const STATUS_OPTIONS_VENDA: ProjetoStatusVenda[] = [
  'proposta_emitida',
  'contrato_assinado',
  'aprovado',
  'concluido',
  'cancelado',
]

function getStatusOptions(tipo: Projeto['tipo']): ProjetoStatus[] {
  return tipo === 'leasing' ? STATUS_OPTIONS_LEASING : STATUS_OPTIONS_VENDA
}

function ProjetoDetail({ projeto, onStatusChange }: ProjetoDetailProps) {
  const { cliente, tipo, status, financeiro, createdAt, consultor, comissaoConsultor } = projeto
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
          {getStatusOptions(tipo).map((s) => (
            <option key={s} value={s}>{PROJETO_STATUS_LABEL[s]}</option>
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
      {/* Consultant section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.875rem' }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Consultor
        </div>
        {consultor
          ? (
            <div>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Consultor: </span>
              <strong>{consultor.nome}</strong>
            </div>
          )
          : <div style={{ color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic' }}>Sem consultor vinculado</div>}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e2e8f0)', margin: 0 }} />
      {/* Commission section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem' }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Comissão do Consultor
        </div>
        {comissaoConsultor
          ? (
            <>
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Regra: </span>
                <strong>{comissaoConsultor.regra}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Valor estimado: </span>
                <strong>{formatCurrency(comissaoConsultor.valorTotalEstimado)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Valor pago: </span>
                <strong>{formatCurrency(comissaoConsultor.valorPago)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Status: </span>
                <strong>{COMISSAO_STATUS_LABEL[comissaoConsultor.status]}</strong>
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <div style={{ color: 'var(--color-text-secondary, #64748b)', marginBottom: '0.3rem' }}>Parcelas:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {comissaoConsultor.parcelas.map((parcela, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--color-muted-bg, #f1f5f9)',
                        borderRadius: 6,
                        padding: '0.4rem 0.6rem',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{parcela.descricao} — {parcela.percentual}% — {formatCurrency(parcela.valor)}</div>
                      <div style={{ color: 'var(--color-text-secondary, #64748b)' }}>Gatilho: {parcela.gatilho}</div>
                      <div>
                        {parcela.pago
                          ? <span style={{ color: 'var(--color-success, #16a34a)' }}>✔ Pago{parcela.pagoEm ? ` em ${formatDate(parcela.pagoEm)}` : ''}</span>
                          : <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>Pendente</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
          : <div style={{ color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic' }}>Sem comissão de consultor vinculada</div>}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e2e8f0)', margin: 0 }} />
      {/* Aprovação Documental */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem' }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Aprovação Documental
        </div>
        {projeto.aprovacaoDocumental ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {DOCUMENTAL_ITEMS.map(({ key, label }) => {
              const item = projeto.aprovacaoDocumental![key]
              return (
                <div
                  key={key}
                  style={{
                    background: 'var(--color-muted-bg, #f1f5f9)',
                    borderRadius: 6,
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.82rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{label}</span>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: item.obrigatorio ? 'var(--color-text-secondary, #64748b)' : 'var(--color-text-muted, #94a3b8)',
                        fontStyle: item.obrigatorio ? 'normal' : 'italic',
                      }}
                    >
                      {item.obrigatorio ? 'Obrigatório' : 'Opcional'}
                    </span>
                    {item.aprovado
                      ? <span style={{ color: 'var(--color-success, #16a34a)', fontWeight: 600 }}>✔ Aprovado</span>
                      : <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>Pendente</span>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic' }}>Sem aprovação documental registrada</div>
        )}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e2e8f0)', margin: 0 }} />
      {/* Viabilidade Técnica */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem' }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Viabilidade Técnica
        </div>
        {projeto.aprovacaoViabilidade ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {VIABILIDADE_ITEMS.map(({ key, label }) => {
              const item = projeto.aprovacaoViabilidade![key]
              return (
                <div
                  key={key}
                  style={{
                    background: 'var(--color-muted-bg, #f1f5f9)',
                    borderRadius: 6,
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.82rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{label}</span>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)' }}>
                      Obrigatório
                    </span>
                    {item.aprovado
                      ? <span style={{ color: 'var(--color-success, #16a34a)', fontWeight: 600 }}>✔ Aprovado</span>
                      : <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>Pendente</span>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic' }}>Sem viabilidade técnica registrada</div>
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
  const addProjeto = useProjectStore(selectAddProjeto)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formNome, setFormNome] = useState('')
  const [formTipo, setFormTipo] = useState<'venda' | 'leasing'>('venda')
  const [formPagamento, setFormPagamento] = useState<'avista' | 'parcelado'>('avista')

  const selectedProject = projetos.find((p) => p.id === selectedProjectId) ?? null

  function handleStatusChange(id: string, status: ProjetoStatus) {
    updateProjeto(id, { status })
  }

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
        <div style={{ marginLeft: 'auto' }}>
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
