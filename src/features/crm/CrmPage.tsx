import React, { useState } from 'react'
import { currency } from '../../utils/formatters'
import { formatPercentBR, fmt } from '../../lib/locale/br-number'
import { CRM_PIPELINE_STAGES, CRM_INSTALACAO_STATUS } from './crmConstants'
import { formatarDataCurta } from './crmUtils'
import type {
  UseCrmState,
  CrmFiltroOperacao,
  CrmFinanceiroStatus,
  CrmLeadFormState,
  CrmLeadRecord,
} from './crmTypes'
import { TipoProjetoModal } from '../../components/projects/TipoProjetoModal'
import type { ProjectType } from '../../domain/projects/types'

export type CrmPageProps = UseCrmState & {
  /** Optional: called when the user wants to create a new project from a lead. */
  onAdicionarNovoProjeto?: (lead: CrmLeadRecord, projectType: ProjectType) => void | Promise<void>
}

export function CrmPage(props: CrmPageProps): React.JSX.Element {
  const {
    crmBusca,
    setCrmBusca,
    crmFiltroOperacao,
    setCrmFiltroOperacao,
    crmLeadSelecionadoId,
    setCrmLeadSelecionadoId,
    crmLeadForm,
    crmNotaTexto,
    setCrmNotaTexto,
    crmDataset,
    crmCustosForm,
    setCrmCustosForm,
    crmContratoForm,
    setCrmContratoForm,
    crmManutencaoForm,
    setCrmManutencaoForm,
    crmLeadSelecionado,
    crmLeadsPorEtapa,
    crmKpis,
    crmFinanceiroResumo,
    crmPosVendaResumo,
    crmIndicadoresGerenciais,
    crmManutencoesPendentes,
    crmContratosPorLead,
    crmTimelineFiltrada,
    handleCrmLeadFormChange,
    handleCrmLeadFormSubmit,
    handleMoverLead,
    handleSelecionarLead,
    handleAdicionarNotaCrm,
    handleAtualizarStatusInstalacao,
    handleRemoverLead,
    handleSalvarCustosCrm,
    handleSalvarContratoCrm,
    handleAdicionarManutencaoCrm,
    handleConcluirManutencaoCrm,
    onAdicionarNovoProjeto,
  } = props

  // Local state for "Adicionar novo projeto" modal
  const [projetoModalLead, setProjetoModalLead] = useState<CrmLeadRecord | null>(null)
  const [projetoModalLoading, setProjetoModalLoading] = useState(false)
  return (
    <div className="crm-page">
      <div className="crm-main">
        {/* Seção 1 - Captação e qualificação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>1. Captação e qualificação</h2>
              <p>
                Cadastre leads vindos do site, redes sociais e indicações. Os dados coletados alimentam automaticamente
                os cálculos financeiros da proposta.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Total de leads</span>
                <strong>{crmKpis.totalLeads}</strong>
              </div>
              <div>
                <span>Fechados</span>
                <strong>{crmKpis.leadsFechados}</strong>
              </div>
              <div>
                <span>Receita recorrente</span>
                <strong>{currency(crmKpis.receitaRecorrente)}</strong>
              </div>
              <div>
                <span>Receita pontual</span>
                <strong>{currency(crmKpis.receitaPontual)}</strong>
              </div>
              <div className="warning">
                <span>Leads em risco</span>
                <strong>{crmKpis.leadsEmRisco}</strong>
              </div>
            </div>
          </div>
          <div className="crm-capture-grid">
            <div className="crm-capture-filters">
              <label htmlFor="crm-busca">Buscar lead</label>
              <input
                id="crm-busca"
                type="search"
                value={crmBusca}
                onChange={(event) => setCrmBusca(event.target.value)}
                placeholder="Pesquisar por nome, telefone, origem ou cidade"
              />
              <label htmlFor="crm-operacao-filter">Tipo de operação</label>
              <select
                id="crm-operacao-filter"
                value={crmFiltroOperacao}
                onChange={(event) => setCrmFiltroOperacao(event.target.value as CrmFiltroOperacao)}
              >
                <option value="all">Todos</option>
                <option value="LEASING">Leasing</option>
                <option value="VENDA_DIRETA">Venda</option>
              </select>
              <p className="crm-hint">
                Leads que abrem uma proposta ou respondem mensagem mudam automaticamente de status. O filtro acima ajuda
                a focar nos modelos de operação desejados.
              </p>
            </div>
            <form className="crm-capture-form" onSubmit={handleCrmLeadFormSubmit}>
              <fieldset>
                <legend>Novo lead</legend>
                <div className="crm-form-row">
                  <label>
                    Nome
                    <input
                      name="crm-nome"
                      id="crm-nome"
                      value={crmLeadForm.nome}
                      onChange={(event) => handleCrmLeadFormChange('nome', event.target.value)}
                      placeholder="Nome do contato"
                      required
                    />
                  </label>
                  <label>
                    Telefone / WhatsApp
                    <input
                      name="crm-telefone"
                      id="crm-telefone"
                      value={crmLeadForm.telefone}
                      onChange={(event) => handleCrmLeadFormChange('telefone', event.target.value)}
                      placeholder="(62) 99999-0000"
                      required
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Cidade
                    <input
                      name="crm-cidade"
                      id="crm-cidade"
                      value={crmLeadForm.cidade}
                      onChange={(event) => handleCrmLeadFormChange('cidade', event.target.value)}
                      placeholder="Cidade do projeto"
                      required
                    />
                  </label>
                  <label>
                    Origem do lead
                    <input
                      name="crm-origem"
                      id="crm-origem"
                      value={crmLeadForm.origemLead}
                      onChange={(event) => handleCrmLeadFormChange('origemLead', event.target.value)}
                      placeholder="Instagram, WhatsApp, Feira..."
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Consumo mensal (kWh)
                    <input
                      name="crm-consumo-kwh"
                      id="crm-consumo-kwh"
                      value={crmLeadForm.consumoKwhMes}
                      onChange={(event) => handleCrmLeadFormChange('consumoKwhMes', event.target.value)}
                      placeholder="Ex: 1200"
                      required
                    />
                  </label>
                  <label>
                    Valor estimado (R$)
                    <input
                      name="crm-valor-estimado"
                      id="crm-valor-estimado"
                      value={crmLeadForm.valorEstimado}
                      onChange={(event) => handleCrmLeadFormChange('valorEstimado', event.target.value)}
                      placeholder="Ex: 250000"
                      required
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Tipo de imóvel
                    <input
                      name="crm-tipo-imovel"
                      id="crm-tipo-imovel"
                      value={crmLeadForm.tipoImovel}
                      onChange={(event) => handleCrmLeadFormChange('tipoImovel', event.target.value)}
                      placeholder="Residencial, Comercial, Cond. Vertical, Cond. Horizontal, Industrial ou Outros (texto)..."
                    />
                  </label>
                  <label>
                    Modelo de operação
                    <select
                      name="crm-tipo-operacao"
                      id="crm-tipo-operacao"
                      value={crmLeadForm.tipoOperacao}
                      onChange={(event) =>
                        handleCrmLeadFormChange('tipoOperacao', event.target.value as CrmLeadFormState['tipoOperacao'])
                      }
                    >
                      <option value="LEASING">Leasing (receita recorrente)</option>
                      <option value="VENDA_DIRETA">Venda (receita pontual)</option>
                    </select>
                  </label>
                </div>
                <label className="crm-form-notes">
                  Observações
                  <textarea
                    name="crm-notas"
                    id="crm-notas"
                    rows={2}
                    value={crmLeadForm.notas}
                    onChange={(event) => handleCrmLeadFormChange('notas', event.target.value)}
                    placeholder="Preferências do cliente, dores principais ou combinações iniciais"
                  />
                </label>
              </fieldset>
              <div className="crm-form-actions">
                <button type="submit" className="primary">
                  Adicionar lead ao funil
                </button>
                <p>
                  Ao salvar, o lead recebe uma tag com o tipo de sistema (on-grid, off-grid, condomínio) e gera um
                  registro de projeto vinculado automaticamente.
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* Seção 2 - Prospecção e proposta */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>2. Prospecção e proposta</h2>
              <p>
                Acompanhe o funil visual de vendas com etapas automáticas. Movimentações geram registros na linha do
                tempo do lead e notificações internas de follow-up.
              </p>
            </div>
          </div>
          <div className="crm-kanban">
            {CRM_PIPELINE_STAGES.map((stage) => {
              const leadsDaEtapa = crmLeadsPorEtapa[stage.id] ?? []
              return (
                <div key={stage.id} className="crm-kanban-column">
                  <header>
                    <h3>{stage.label}</h3>
                    <span>{leadsDaEtapa.length} lead(s)</span>
                  </header>
                  <ul>
                    {leadsDaEtapa.length === 0 ? (
                      <li className="crm-empty">Sem leads aqui no momento</li>
                    ) : (
                      leadsDaEtapa.map((lead) => (
                        <li
                          key={lead.id}
                          className={`crm-lead-chip${crmLeadSelecionadoId === lead.id ? ' selected' : ''}`}
                        >
                          <button type="button" onClick={() => handleSelecionarLead(lead.id)}>
                            <strong>{lead.nome}</strong>
                            <small>{lead.cidade}</small>
                            <small>{currency(lead.valorEstimado)}</small>
                          </button>
                          <div className="crm-lead-actions">
                            <button
                              type="button"
                              aria-label="Mover para etapa anterior"
                              onClick={() => handleMoverLead(lead.id, -1)}
                              disabled={stage.id === CRM_PIPELINE_STAGES[0].id}
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              aria-label="Mover para próxima etapa"
                              onClick={() => handleMoverLead(lead.id, 1)}
                              disabled={stage.id === CRM_PIPELINE_STAGES[CRM_PIPELINE_STAGES.length - 1].id}
                            >
                              ▶
                            </button>
                            {onAdicionarNovoProjeto ? (
                              <button
                                type="button"
                                aria-label="Adicionar novo projeto"
                                title="Adicionar novo projeto"
                                onClick={() => setProjetoModalLead(lead)}
                              >
                                ＋
                              </button>
                            ) : null}
                            <button type="button" className="danger" onClick={() => handleRemoverLead(lead.id)}>
                              Remover
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* Seção 3 - Contrato e implantação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>3. Contrato e implantação</h2>
              <p>
                Integração com assinatura digital, checklist técnico e histórico completo de interações e anexos do
                cliente.
              </p>
            </div>
          </div>
          {crmLeadSelecionado ? (
            <div className="crm-selected">
              <div className="crm-selected-summary">
                <h3>{crmLeadSelecionado.nome}</h3>
                <p>
                  {crmLeadSelecionado.telefone} • {crmLeadSelecionado.email || 'E-mail não informado'}
                </p>
                <p>
                  {crmLeadSelecionado.cidade} • Consumo {fmt.kwhMes(crmLeadSelecionado.consumoKwhMes)}
                </p>
                <label>
                  Status da instalação
                  <select
                    value={crmLeadSelecionado.instalacaoStatus}
                    onChange={(event) =>
                      handleAtualizarStatusInstalacao(
                        crmLeadSelecionado.id,
                        event.target.value as CrmLeadRecord['instalacaoStatus'],
                      )
                    }
                  >
                    {CRM_INSTALACAO_STATUS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Registrar nota
                  <textarea
                    rows={2}
                    value={crmNotaTexto}
                    onChange={(event) => setCrmNotaTexto(event.target.value)}
                    placeholder="Ex: Visita técnica agendada, cliente solicitou revisão de valores"
                  />
                </label>
                <button type="button" className="ghost" onClick={handleAdicionarNotaCrm}>
                  Salvar no histórico
                </button>
              </div>
              <div className="crm-selected-details">
                <div>
                  <h4>Contrato financeiro</h4>
                  {(() => {
                    const contrato = crmContratosPorLead.get(crmLeadSelecionado.id)
                    if (!contrato) {
                      return <p className="crm-empty">Preencha os dados financeiros na seção 6.</p>
                    }
                    return (
                      <ul className="crm-data-list">
                        <li>
                          <span>Modelo</span>
                          <strong>{contrato.modelo === 'LEASING' ? 'Leasing' : 'Venda'}</strong>
                        </li>
                        <li>
                          <span>Parcelas</span>
                          <strong>{contrato.parcelas}x de {currency(contrato.valorParcela)}</strong>
                        </li>
                        <li>
                          <span>Status</span>
                          <strong>{contrato.status.replace('-', ' ')}</strong>
                        </li>
                        <li>
                          <span>Vencimento inicial</span>
                          <strong>{formatarDataCurta(contrato.vencimentoInicialIso)}</strong>
                        </li>
                      </ul>
                    )
                  })()}
                </div>
                <div>
                  <h4>Checklist técnico</h4>
                  <ul className="crm-checklist">
                    <li className={crmLeadSelecionado.etapa !== 'novo-lead' ? 'done' : ''}>Captação concluída</li>
                    <li className={crmLeadSelecionado.etapa !== 'novo-lead' && crmLeadSelecionado.etapa !== 'qualificacao' ? 'done' : ''}>
                      Proposta enviada
                    </li>
                    <li className={crmLeadSelecionado.etapa === 'negociacao' || crmLeadSelecionado.etapa === 'aguardando-contrato' || crmLeadSelecionado.etapa === 'fechado' ? 'done' : ''}>
                      Negociação em andamento
                    </li>
                    <li className={crmLeadSelecionado.etapa === 'aguardando-contrato' || crmLeadSelecionado.etapa === 'fechado' ? 'done' : ''}>
                      Contrato preparado para assinatura
                    </li>
                    <li className={crmLeadSelecionado.instalacaoStatus === 'concluida' ? 'done' : ''}>Usina instalada</li>
                  </ul>
                </div>
                <div>
                  <h4>Histórico recente</h4>
                  <ul className="crm-timeline">
                    {crmTimelineFiltrada.slice(0, 6).map((item) => (
                      <li key={item.id}>
                        <span>{formatarDataCurta(item.criadoEmIso)}</span>
                        <p>{item.mensagem}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="crm-empty">Selecione um lead no funil acima para visualizar detalhes de contrato e implantação.</p>
          )}
        </section>

        {/* Seção 4 - Instalação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>4. Instalação</h2>
              <p>
                O módulo técnico assume tarefas, materiais e cronogramas vinculados ao mesmo registro do cliente.
                Atualize a agenda de manutenção preventiva e acompanhe o status de execução em tempo real.
              </p>
            </div>
          </div>
          <div className="crm-install-grid">
            <div>
              <h4>Manutenções pendentes</h4>
              {crmManutencoesPendentes.length === 0 ? (
                <p className="crm-empty">Nenhuma manutenção pendente. Cadastre uma nova abaixo.</p>
              ) : (
                <ul className="crm-maintenance-list">
                  {crmManutencoesPendentes.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{formatarDataCurta(item.dataIso)}</strong>
                        <span>{item.tipo}</span>
                        {item.observacao ? <small>{item.observacao}</small> : null}
                      </div>
                      <button type="button" onClick={() => handleConcluirManutencaoCrm(item.id)}>
                        Concluir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form className="crm-maintenance-form" onSubmit={handleAdicionarManutencaoCrm}>
              <fieldset>
                <legend>Agendar manutenção</legend>
                <label>
                  Cliente (opcional)
                  <select
                    value={crmManutencaoForm.leadId}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, leadId: event.target.value }))}
                  >
                    <option value="">Usar lead selecionado</option>
                    {crmDataset.leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Data prevista
                  <input
                    type="date"
                    value={crmManutencaoForm.dataIso}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, dataIso: event.target.value }))}
                  />
                </label>
                <label>
                  Tipo de serviço
                  <input
                    value={crmManutencaoForm.tipo}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, tipo: event.target.value }))}
                    placeholder="Vistoria, limpeza, troca de inversor..."
                  />
                </label>
                <label>
                  Observações
                  <textarea
                    rows={2}
                    value={crmManutencaoForm.observacao}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, observacao: event.target.value }))}
                  />
                </label>
              </fieldset>
              <button type="submit" className="ghost">
                Agendar manutenção
              </button>
            </form>
            {crmLeadSelecionado ? (
              <div>
                <h4>Histórico do cliente selecionado</h4>
                <ul className="crm-maintenance-list">
                  {crmDataset.manutencoes
                    .filter((item) => item.leadId === crmLeadSelecionado.id)
                    .slice(0, 5)
                    .map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{formatarDataCurta(item.dataIso)}</strong>
                          <span>{item.tipo}</span>
                          <small>Status: {item.status}</small>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* Seção 5 - Pós-venda e manutenção */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>5. Pós-venda e manutenção</h2>
              <p>
                Monitoramento contínuo da usina, integrações com o inversor e registro de chamados técnicos para manter o
                cliente engajado.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Manutenções totais</span>
                <strong>{crmPosVendaResumo.totalManutencoes}</strong>
              </div>
              <div>
                <span>Pendentes</span>
                <strong>{crmPosVendaResumo.pendentes}</strong>
              </div>
              <div>
                <span>Concluídas</span>
                <strong>{crmPosVendaResumo.concluidas}</strong>
              </div>
              <div>
                <span>Alertas críticos</span>
                <strong>{crmPosVendaResumo.alertasCriticos.length}</strong>
              </div>
            </div>
          </div>
          <div className="crm-post-grid">
            <div className="crm-post-column">
              <h3>Próximas visitas preventivas</h3>
              <ul className="crm-alert-list">
                {crmPosVendaResumo.proximas.length === 0 ? (
                  <li className="crm-empty">Nenhuma visita agendada para os próximos dias.</li>
                ) : (
                  crmPosVendaResumo.proximas.map((item) => {
                    const lead = crmDataset.leads.find((leadItem) => leadItem.id === item.leadId)
                    return (
                      <li key={item.id}>
                        <div>
                          <strong>{formatarDataCurta(item.dataIso)}</strong>
                          <span>{item.tipo}</span>
                          {lead ? <small>{lead.nome}</small> : null}
                        </div>
                        <button type="button" className="link" onClick={() => setCrmLeadSelecionadoId(item.leadId)}>
                          Ver lead
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
              {crmPosVendaResumo.alertasCriticos.length > 0 ? (
                <div className="crm-alert-banner">
                  <h4>Alertas automáticos</h4>
                  <ul>
                    {crmPosVendaResumo.alertasCriticos.map((texto, index) => (
                      <li key={texto + index}>{texto}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="crm-post-column">
              <h3>Relatório de geração (via API do inversor)</h3>
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cidade</th>
                    <th>Previsto (kWh)</th>
                    <th>Gerado (kWh)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {crmPosVendaResumo.geracao.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="crm-empty">
                        Aguarde a integração com o inversor para sincronizar dados de geração.
                      </td>
                    </tr>
                  ) : (
                    crmPosVendaResumo.geracao.map((registro) => (
                      <tr key={registro.id} className={registro.alertaBaixa ? 'alert' : ''}>
                        <td>{registro.nome}</td>
                        <td>{registro.cidade}</td>
                        <td>{registro.geracaoPrevista}</td>
                        <td>{registro.geracaoAtual}</td>
                        <td>{registro.alertaBaixa ? 'Baixa geração' : 'Normal'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="crm-post-column">
              <h3>Chamados recentes</h3>
              <ul className="crm-alert-list">
                {crmPosVendaResumo.chamadosRecentes.length === 0 ? (
                  <li className="crm-empty">Nenhum chamado registrado. Use as notas do lead para registrar atendimentos.</li>
                ) : (
                  crmPosVendaResumo.chamadosRecentes.map((registro) => (
                    <li key={registro.id}>
                      <div>
                        <strong>{registro.dataFormatada}</strong>
                        <span>{registro.mensagem}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Seção 6 - Financeiro integrado */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>6. Financeiro integrado</h2>
              <p>
                Controle de contratos de leasing e vendas diretas e análise de margens para cada
                usina.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Contratos ativos</span>
                <strong>{crmFinanceiroResumo.contratosAtivos}</strong>
              </div>
              <div className="warning">
                <span>Inadimplentes</span>
                <strong>{crmFinanceiroResumo.inadimplentes}</strong>
              </div>
            </div>
          </div>
          <div className="crm-finance-grid">
            {/* Coluna 1: formulários de contratos e custos para alimentar o financeiro do CRM. */}
            <div className="crm-finance-forms">
              <form onSubmit={handleSalvarContratoCrm} className="crm-form">
                <fieldset>
                  <legend>Contrato financeiro</legend>
                  <label>
                    Lead
                    <select
                      value={crmContratoForm.leadId}
                      onChange={(event) => setCrmContratoForm((prev) => ({ ...prev, leadId: event.target.value }))}
                    >
                      <option value="">{crmLeadSelecionado ? 'Usar lead selecionado' : 'Selecione um lead'}</option>
                      {crmDataset.leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modelo
                    <select
                      value={crmContratoForm.modelo}
                      onChange={(event) =>
                        setCrmContratoForm((prev) => ({
                          ...prev,
                          modelo: event.target.value as 'LEASING' | 'VENDA_DIRETA',
                        }))
                      }
                    >
                      <option value="LEASING">Leasing</option>
                      <option value="VENDA_DIRETA">Venda</option>
                    </select>
                  </label>
                  <div className="crm-form-row">
                    <label>
                      Valor total (R$)
                      <input
                        value={crmContratoForm.valorTotal}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, valorTotal: event.target.value }))
                        }
                        placeholder="Ex: 250000"
                      />
                    </label>
                    <label>
                      Entrada (R$)
                      <input
                        value={crmContratoForm.entrada}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, entrada: event.target.value }))
                        }
                        placeholder="Ex: 50000"
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Parcelas
                      <input
                        value={crmContratoForm.parcelas}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, parcelas: event.target.value }))
                        }
                        placeholder="Ex: 36"
                      />
                    </label>
                    <label>
                      Valor parcela (R$)
                      <input
                        value={crmContratoForm.valorParcela}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, valorParcela: event.target.value }))
                        }
                        placeholder="Ex: 4200"
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Reajuste anual (%)
                      <input
                        value={crmContratoForm.reajusteAnualPct}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, reajusteAnualPct: event.target.value }))
                        }
                        placeholder="Ex: 3"
                      />
                    </label>
                    <label>
                      Primeiro vencimento
                      <input
                        type="date"
                        value={crmContratoForm.vencimentoInicialIso}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, vencimentoInicialIso: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Status
                    <select
                      value={crmContratoForm.status}
                      onChange={(event) =>
                        setCrmContratoForm((prev) => ({
                          ...prev,
                          status: event.target.value as CrmFinanceiroStatus,
                        }))
                      }
                    >
                      <option value="em-aberto">Em aberto</option>
                      <option value="ativo">Ativo</option>
                      <option value="inadimplente">Inadimplente</option>
                      <option value="quitado">Quitado</option>
                    </select>
                  </label>
                </fieldset>
                <button type="submit" className="primary">
                  Salvar contrato
                </button>
              </form>

              <form onSubmit={handleSalvarCustosCrm} className="crm-form">
                <fieldset>
                  <legend>Custos do projeto selecionado</legend>
                  <div className="crm-form-row">
                    <label>
                      Equipamentos (R$)
                      <input
                        value={crmCustosForm.equipamentos}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, equipamentos: event.target.value }))}
                      />
                    </label>
                    <label>
                      Mão de obra (R$)
                      <input
                        value={crmCustosForm.maoDeObra}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, maoDeObra: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Deslocamento (R$)
                      <input
                        value={crmCustosForm.deslocamento}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, deslocamento: event.target.value }))}
                      />
                    </label>
                    <label>
                      Taxas e seguros (R$)
                      <input
                        value={crmCustosForm.taxasSeguros}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, taxasSeguros: event.target.value }))}
                      />
                    </label>
                  </div>
                </fieldset>
                <button type="submit" className="ghost">
                  Salvar custos
                </button>
              </form>
            </div>
            {/* Coluna 2: painel analítico de margens e ROI. */}
            <div className="crm-finance-analytics">
              <div className="crm-margins">
                <h3>ROI e margens por lead</h3>
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Modelo</th>
                      <th>Receita (R$)</th>
                      <th>Custos (R$)</th>
                      <th>Margem bruta (R$)</th>
                      <th>Margem (%)</th>
                      <th>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmFinanceiroResumo.margens.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="crm-empty">
                          Informe contratos e custos para acompanhar margens e ROI de cada projeto.
                        </td>
                      </tr>
                    ) : (
                      crmFinanceiroResumo.margens.map((item) => (
                        <tr key={item.leadId}>
                          <td>{item.leadNome}</td>
                          <td>{item.modelo === 'LEASING' ? 'Leasing' : 'Venda'}</td>
                          <td>{currency(item.receitaProjetada)}</td>
                          <td>{currency(item.custoTotal)}</td>
                          <td>{currency(item.margemBruta)}</td>
                          <td>
                            {item.margemPct === null
                              ? null
                              : formatPercentBR((item.margemPct ?? 0) / 100)}
                          </td>
                          <td>{item.roi === null ? null : formatPercentBR(item.roi)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 7 - Inteligência e relatórios */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>7. Inteligência e relatórios</h2>
              <p>
                Indicadores consolidados da operação comercial, técnica e financeira da SolarInvest, com alertas de
                gargalos.
              </p>
            </div>
          </div>
          <div className="crm-insights-grid">
            {/* Painéis estratégicos conectando marketing, operação técnica e finanças. */}
            <div className="crm-insight-panel">
              <h3>Métricas principais</h3>
              <ul className="crm-kpi-list">
                <li>
                  <span>Taxa de conversão</span>
                  <strong>{crmIndicadoresGerenciais.taxaConversao}%</strong>
                </li>
                <li>
                  <span>Tempo médio de fechamento</span>
                  <strong>{crmIndicadoresGerenciais.tempoMedioFechamento} dias</strong>
                </li>
                <li>
                  <span>ROI médio</span>
                  <strong>
                    {Number.isFinite(crmIndicadoresGerenciais.roiMedio)
                      ? formatPercentBR(crmIndicadoresGerenciais.roiMedio)
                      : null}
                  </strong>
                </li>
                <li>
                  <span>Receita recorrente projetada</span>
                  <strong>{currency(crmIndicadoresGerenciais.receitaRecorrenteProjetada)}</strong>
                </li>
                <li>
                  <span>Receita pontual projetada</span>
                  <strong>{currency(crmIndicadoresGerenciais.receitaPontualProjetada)}</strong>
                </li>
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Origem dos leads</h3>
              <ul className="crm-kpi-list">
                {Object.entries(crmIndicadoresGerenciais.leadsPorOrigem).map(([origem, quantidade]) => (
                  <li key={origem}>
                    <span>{origem}</span>
                    <strong>{quantidade}</strong>
                  </li>
                ))}
                {Object.keys(crmIndicadoresGerenciais.leadsPorOrigem).length === 0 ? (
                  <li className="crm-empty">Cadastre leads para visualizar a distribuição de origens.</li>
                ) : null}
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Mapa de geração por cidade</h3>
              <ul className="crm-kpi-list">
                {Object.entries(crmIndicadoresGerenciais.mapaGeracao).map(([cidade, consumo]) => (
                  <li key={cidade}>
                    <span>{cidade}</span>
                    <strong>{consumo} kWh</strong>
                  </li>
                ))}
                {Object.keys(crmIndicadoresGerenciais.mapaGeracao).length === 0 ? (
                  <li className="crm-empty">Nenhum dado de geração disponível. Feche contratos para popular o mapa.</li>
                ) : null}
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Alertas de gargalos</h3>
              {crmIndicadoresGerenciais.gargalos.length === 0 ? (
                <p className="crm-empty">O funil está saudável, sem gargalos detectados.</p>
              ) : (
                <ul className="crm-alert-list">
                  {crmIndicadoresGerenciais.gargalos.map((texto, index) => (
                    <li key={texto + index}>{texto}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Modal: escolha de tipo de projeto para leads */}
      <TipoProjetoModal
        open={projetoModalLead !== null}
        onClose={() => { setProjetoModalLead(null) }}
        clientName={projetoModalLead?.nome}
        loading={projetoModalLoading}
        onConfirm={(projectType) => {
          if (!projetoModalLead || !onAdicionarNovoProjeto) return
          setProjetoModalLoading(true)
          void Promise.resolve(onAdicionarNovoProjeto(projetoModalLead, projectType))
            .finally(() => {
              setProjetoModalLoading(false)
              setProjetoModalLead(null)
            })
        }}
      />
    </div>
  )
}
