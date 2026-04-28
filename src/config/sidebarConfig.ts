// src/config/sidebarConfig.ts
// Pure builder that constructs the sidebar group structure for the main navigation.
// Etapa 1: Nova arquitetura — Dashboard / Comercial / Clientes / Cobranças /
//          Operação / Indicadores / Relatórios / Configurações / Sair.
// Backward-compatible: old ActivePage values and handlers are preserved unchanged.

import type { SidebarGroup, SidebarItem } from '../layout/Sidebar'
import type { ActivePage, OperacaoSection, SimulacoesSection } from '../types/navigation'

export interface SidebarConfigParams {
  // Permissions
  canSeeDashboardEffective: boolean
  canSeePortfolioEffective: boolean
  canSeeFinancialManagementEffective: boolean
  canSeeProposalsEffective: boolean
  canSeeContractsEffective: boolean
  canSeeClientsEffective: boolean
  canSeeFinancialAnalysisEffective: boolean
  isAdmin: boolean
  // Navigation handlers — existing
  abrirDashboard: () => void
  abrirCarteira: () => void
  abrirGestaoFinanceira: () => void
  abrirDashboardOperacional: () => void
  handleNavigateToProposalTab: (tab: 'leasing' | 'vendas') => void
  abrirSimulacoes: (section: SimulacoesSection) => void
  handleGerarContratosComConfirmacao: () => void
  abrirEnvioPropostaModal: () => void
  abrirPesquisaOrcamentos: () => void
  setActivePage: (page: ActivePage) => void
  // Navigation handlers — new (Etapa 1)
  abrirCrmCentral: () => void
  abrirClientesPainel: () => void
  abrirConfiguracoes: () => void
  handleLogout: () => void
  abrirOperacaoPlaceholder: (section: OperacaoSection) => void
  // Legacy CRM items (kept for backward compat, no longer in primary nav)
  crmItems: SidebarItem[]
  // State
  gerandoContratos: boolean
  contatosEnvio: unknown[]
}

export function buildSidebarGroups(params: SidebarConfigParams): SidebarGroup[] {
  const {
    canSeeDashboardEffective,
    canSeePortfolioEffective,
    canSeeFinancialManagementEffective,
    canSeeProposalsEffective,
    canSeeContractsEffective,
    canSeeClientsEffective,
    canSeeFinancialAnalysisEffective,
    isAdmin,
    abrirDashboard,
    abrirCarteira,
    abrirGestaoFinanceira,
    handleNavigateToProposalTab,
    abrirSimulacoes,
    handleGerarContratosComConfirmacao,
    abrirEnvioPropostaModal,
    abrirPesquisaOrcamentos,
    setActivePage,
    abrirCrmCentral,
    abrirClientesPainel,
    abrirConfiguracoes,
    handleLogout,
    abrirOperacaoPlaceholder,
    gerandoContratos,
    contatosEnvio,
  } = params

  const groups: SidebarGroup[] = []

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (canSeeDashboardEffective || canSeePortfolioEffective || canSeeFinancialManagementEffective) {
    groups.push({
      id: 'dashboard',
      label: '',
      items: [
        {
          id: 'dashboard-home',
          label: 'Dashboard',
          icon: '📊',
          onSelect: () => { void abrirDashboard() },
        },
      ],
    })
  }

  // ── Comercial ─────────────────────────────────────────────────────────────
  if (canSeeProposalsEffective || canSeeContractsEffective) {
    const comercialItems: SidebarItem[] = []

    // Leads → CRM Central
    if (canSeeProposalsEffective) {
      comercialItems.push({
        id: 'comercial-leads',
        label: 'Leads',
        icon: '🛰️',
        onSelect: () => { void abrirCrmCentral() },
      })
    }

    // Propostas → submenu (Leasing / Vendas / Enviar proposta)
    if (canSeeProposalsEffective) {
      const propostasChildren: SidebarItem[] = [
        {
          id: 'propostas-leasing',
          label: 'Leasing',
          icon: '📝',
          onSelect: () => { void handleNavigateToProposalTab('leasing') },
        },
        {
          id: 'propostas-vendas',
          label: 'Vendas',
          icon: '🧾',
          onSelect: () => { void handleNavigateToProposalTab('vendas') },
        },
        {
          id: 'propostas-enviar',
          label: 'Enviar proposta',
          icon: '📨',
          onSelect: () => { abrirEnvioPropostaModal() },
          disabled: contatosEnvio.length === 0,
          title:
            contatosEnvio.length === 0
              ? 'Cadastre um cliente ou lead com telefone para compartilhar a proposta.'
              : undefined,
        },
      ]

      // Análise Financeira (admin / canSeeFinancialAnalysis)
      if (canSeeFinancialAnalysisEffective) {
        propostasChildren.push({
          id: 'simulacoes-analise',
          label: 'Análise Financeira',
          icon: '✅',
          onSelect: () => { void abrirSimulacoes('analise') },
        })
      }

      comercialItems.push({
        id: 'comercial-propostas',
        label: 'Propostas',
        icon: '📋',
        items: propostasChildren,
      })
    }

    // Contratos → submenu (Gerar / Ver)
    if (canSeeContractsEffective) {
      comercialItems.push({
        id: 'comercial-contratos',
        label: 'Contratos',
        icon: '🖋️',
        items: [
          {
            id: 'propostas-contratos',
            label: gerandoContratos ? 'Gerando…' : 'Gerar contratos',
            icon: '🖋️',
            onSelect: () => { void handleGerarContratosComConfirmacao() },
            disabled: gerandoContratos,
          },
          {
            id: 'relatorios-contratos',
            label: 'Ver contratos',
            icon: '📂',
            onSelect: () => { void abrirPesquisaOrcamentos() },
          },
        ],
      })
    }

    groups.push({ id: 'comercial', label: 'Comercial', items: comercialItems })
  }

  // ── Clientes ───────────────────────────────────────────────────────────────
  if (canSeePortfolioEffective || canSeeClientsEffective) {
    const clientesItems: SidebarItem[] = []

    if (canSeePortfolioEffective) {
      clientesItems.push({
        id: 'carteira-clientes',
        label: 'Todos os clientes',
        icon: '💼',
        onSelect: () => { void abrirCarteira() },
      })
    }

    if (canSeeClientsEffective) {
      clientesItems.push({
        id: 'crm-clientes',
        label: 'Clientes salvos',
        icon: '👥',
        onSelect: () => { void abrirClientesPainel() },
      })
    }

    if (clientesItems.length > 0) {
      groups.push({ id: 'clientes', label: 'Clientes', items: clientesItems })
    }
  }

  // ── Cobranças ──────────────────────────────────────────────────────────────
  if (canSeeFinancialManagementEffective) {
    groups.push({
      id: 'cobrancas',
      label: 'Cobranças',
      items: [
        {
          id: 'cobrancas-mensalidades',
          label: 'Mensalidades',
          icon: '💰',
          onSelect: () => { void abrirGestaoFinanceira() },
        },
        {
          id: 'cobrancas-recebimentos',
          label: 'Recebimentos',
          icon: '💳',
          onSelect: () => { void abrirGestaoFinanceira() },
        },
        {
          id: 'cobrancas-inadimplencia',
          label: 'Inadimplência',
          icon: '⚠️',
          onSelect: () => { void abrirGestaoFinanceira() },
        },
      ],
    })
  }

  // ── Operação ───────────────────────────────────────────────────────────────
  {
    const operacaoItems: SidebarItem[] = [
      {
        id: 'operacao-agenda',
        label: 'Agenda',
        icon: '📅',
        onSelect: () => { abrirOperacaoPlaceholder('operacao-agenda') },
      },
      {
        id: 'operacao-chamados',
        label: 'Chamados',
        icon: '🎫',
        onSelect: () => { abrirOperacaoPlaceholder('operacao-chamados') },
      },
      {
        id: 'operacao-manutencoes',
        label: 'Manutenções',
        icon: '🔧',
        onSelect: () => { abrirOperacaoPlaceholder('operacao-manutencoes') },
      },
      {
        id: 'operacao-limpezas',
        label: 'Limpezas',
        icon: '🧹',
        onSelect: () => { abrirOperacaoPlaceholder('operacao-limpezas') },
      },
      {
        id: 'operacao-seguros',
        label: 'Seguros',
        icon: '🛡️',
        onSelect: () => { abrirOperacaoPlaceholder('operacao-seguros') },
      },
    ]

    // Keep Painel Operacional accessible for canSeeDashboard users
    if (canSeeDashboardEffective) {
      operacaoItems.unshift({
        id: 'operational-dashboard',
        label: 'Painel Operacional',
        icon: '⚙️',
        onSelect: () => { setActivePage('operational-dashboard') },
      })
    }

    groups.push({ id: 'operacao', label: 'Operação', items: operacaoItems })
  }

  // ── Indicadores ────────────────────────────────────────────────────────────
  if (canSeeFinancialAnalysisEffective || canSeeFinancialManagementEffective || isAdmin) {
    const indicadoresItems: SidebarItem[] = []

    if (canSeeFinancialManagementEffective) {
      indicadoresItems.push(
        {
          id: 'indicadores-visao-geral',
          label: 'Visão Geral',
          icon: '📈',
          onSelect: () => { void abrirGestaoFinanceira() },
        },
        {
          id: 'indicadores-fluxo-caixa',
          label: 'Fluxo de Caixa',
          icon: '💵',
          onSelect: () => { void abrirGestaoFinanceira() },
        },
      )
    }

    if (canSeeProposalsEffective) {
      indicadoresItems.push(
        {
          id: 'indicadores-leasing',
          label: 'Leasing',
          icon: '🔆',
          onSelect: () => { void handleNavigateToProposalTab('leasing') },
        },
        {
          id: 'indicadores-vendas',
          label: 'Vendas',
          icon: '📦',
          onSelect: () => { void handleNavigateToProposalTab('vendas') },
        },
      )
    }

    // Admin-only Simulações items preserved under Indicadores
    if (isAdmin) {
      indicadoresItems.push({
        id: 'simulacoes-admin',
        label: 'Simulações',
        icon: '🧮',
        items: [
          {
            id: 'simulacoes-nova',
            label: 'Nova Simulação',
            icon: '🧮',
            onSelect: () => { void abrirSimulacoes('nova') },
          },
          {
            id: 'simulacoes-salvas',
            label: 'Simulações Salvas',
            icon: '💾',
            onSelect: () => { void abrirSimulacoes('salvas') },
          },
          {
            id: 'simulacoes-analise-ind',
            label: 'Análise Financeira',
            icon: '✅',
            onSelect: () => { void abrirSimulacoes('analise') },
          },
        ],
      })
    }

    if (indicadoresItems.length > 0) {
      groups.push({ id: 'indicadores', label: 'Indicadores', items: indicadoresItems })
    }
  }

  // ── Relatórios ────────────────────────────────────────────────────────────
  if (canSeeProposalsEffective || canSeeClientsEffective) {
    const relatoriosItems: SidebarItem[] = []

    if (canSeeProposalsEffective) {
      relatoriosItems.push(
        {
          id: 'relatorios-pdfs',
          label: 'Propostas',
          icon: '📂',
          onSelect: () => { void abrirPesquisaOrcamentos() },
        },
        {
          id: 'orcamentos-importar',
          label: 'Contratos',
          icon: '🖋️',
          onSelect: () => { void abrirPesquisaOrcamentos() },
        },
      )
    }

    if (canSeeFinancialManagementEffective) {
      relatoriosItems.push({
        id: 'relatorios-financeiro',
        label: 'Financeiro',
        icon: '💰',
        onSelect: () => { void abrirGestaoFinanceira() },
      })
    }

    if (canSeeClientsEffective) {
      relatoriosItems.push({
        id: 'relatorios-clientes',
        label: 'Clientes',
        icon: '👥',
        onSelect: () => { void abrirClientesPainel() },
      })
    }

    if (relatoriosItems.length > 0) {
      groups.push({ id: 'relatorios', label: 'Relatórios', items: relatoriosItems })
    }
  }

  // ── Configurações + Sair — always visible ─────────────────────────────────
  groups.push({
    id: 'configuracoes',
    label: '',
    items: [
      {
        id: 'configuracoes-home',
        label: 'Configurações',
        icon: '⚙️',
        onSelect: () => { void abrirConfiguracoes() },
      },
      {
        id: 'sair',
        label: 'Sair',
        icon: '🚪',
        onSelect: () => { void handleLogout() },
      },
    ],
  })

  return groups
}

