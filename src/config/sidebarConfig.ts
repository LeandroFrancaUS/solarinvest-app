// src/config/sidebarConfig.ts
// Pure builder that constructs the sidebar group structure for the main navigation.
// Extracted from App.tsx to keep App.tsx leaner. Zero visual or behavioural change.

import type { SidebarGroup, SidebarItem } from '../layout/Sidebar'
import type { ActivePage, SimulacoesSection } from '../types/navigation'

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
  // Handlers
  abrirDashboard: () => void
  abrirClientesPainel: () => void
  abrirCarteira: () => void
  abrirGestaoFinanceira: () => void
  abrirDashboardOperacional: () => void
  handleNavigateToProposalTab: (tab: 'leasing' | 'vendas') => void
  abrirSimulacoes: (section: SimulacoesSection) => void
  handleGerarContratosComConfirmacao: () => void
  abrirEnvioPropostaModal: () => void
  abrirPesquisaOrcamentos: () => void
  setActivePage: (page: ActivePage) => void
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
    abrirClientesPainel,
    abrirCarteira,
    abrirGestaoFinanceira,
    abrirDashboardOperacional,
    handleNavigateToProposalTab,
    abrirSimulacoes,
    handleGerarContratosComConfirmacao,
    abrirEnvioPropostaModal,
    abrirPesquisaOrcamentos,
    setActivePage,
    crmItems,
    gerandoContratos,
    contatosEnvio,
  } = params

  return [
    ...((canSeeDashboardEffective || canSeePortfolioEffective || canSeeFinancialManagementEffective)
      ? [
          {
            id: 'dashboard',
            label: 'Dashboard',
            items: [
              ...(canSeeDashboardEffective
                ? [
                    {
                      id: 'dashboard-home',
                      label: 'Dashboard',
                      icon: '📊',
                      onSelect: () => {
                        void abrirDashboard()
                      },
                    },
                  ]
                : []),
              ...(canSeeClientsEffective
                ? [
                    {
                      id: 'leads-clientes',
                      label: 'Leads',
                      icon: '👥',
                      onSelect: () => {
                        void abrirClientesPainel()
                      },
                    },
                  ]
                : []),
              ...(canSeePortfolioEffective
                ? [
                    {
                      id: 'carteira-clientes',
                      label: 'Carteira Ativa',
                      icon: '💼',
                      onSelect: () => {
                        void abrirCarteira()
                      },
                    },
                  ]
                : []),
              ...(canSeeFinancialManagementEffective
                ? [
                    {
                      id: 'gestao-financeira-home',
                      label: 'Receita e Cobrança',
                      icon: '💰',
                      onSelect: () => {
                        void abrirGestaoFinanceira()
                      },
                    },
                  ]
                : []),
              ...(canSeeDashboardEffective
                ? [
                    {
                      id: 'operational-dashboard',
                      label: 'Painel Operacional',
                      icon: '⚙️',
                      onSelect: () => {
                        void abrirDashboardOperacional()
                      },
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
    ...((canSeeProposalsEffective || canSeeContractsEffective)
      ? [
          {
            id: 'propostas',
            label: 'Propostas',
            items: [
              ...(canSeeProposalsEffective
                ? [
                    {
                      id: 'propostas-leasing',
                      label: 'Leasing',
                      icon: '📝',
                      onSelect: () => {
                        void handleNavigateToProposalTab('leasing')
                      },
                    },
                    {
                      id: 'propostas-vendas',
                      label: 'Vendas',
                      icon: '🧾',
                      onSelect: () => {
                        void handleNavigateToProposalTab('vendas')
                      },
                    },
                    ...(canSeeFinancialAnalysisEffective
                      ? [
                          {
                            id: 'simulacoes-analise',
                            label: 'Análise Financeira',
                            icon: '✅',
                            onSelect: () => {
                              void abrirSimulacoes('analise')
                            },
                          },
                        ]
                      : []),
                  ]
                : []),
              ...(canSeeContractsEffective
                ? [
                    {
                      id: 'propostas-contratos',
                      label: gerandoContratos ? 'Gerando…' : 'Gerar contratos',
                      icon: '🖋️',
                      onSelect: () => {
                        void handleGerarContratosComConfirmacao()
                      },
                      disabled: gerandoContratos,
                    },
                  ]
                : []),
              ...(canSeeProposalsEffective
                ? [
                    {
                      id: 'propostas-enviar',
                      label: 'Enviar proposta',
                      icon: '📨',
                      onSelect: () => {
                        abrirEnvioPropostaModal()
                      },
                      disabled: contatosEnvio.length === 0,
                      ...(contatosEnvio.length === 0
                        ? { title: 'Cadastre um cliente ou lead com telefone para compartilhar a proposta.' }
                        : {}),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: 'simulacoes',
            label: 'Simulações',
            items: [
        {
          id: 'simulacoes-nova',
          label: 'Nova Simulação',
          icon: '🧮',
          onSelect: () => {
            void abrirSimulacoes('nova')
          },
        },
        {
          id: 'simulacoes-salvas',
          label: 'Simulações Salvas',
          icon: '💾',
          onSelect: () => {
            void abrirSimulacoes('salvas')
          },
        },
        {
          id: 'simulacoes-ia',
          label: 'Análises IA (AI Analytics)',
          icon: '🤖',
          onSelect: () => {
            void abrirSimulacoes('ia')
          },
        },
        {
          id: 'simulacoes-risco',
          label: 'Risco & Monte Carlo',
          icon: '🎲',
          onSelect: () => {
            void abrirSimulacoes('risco')
          },
        },
        {
          id: 'simulacoes-packs',
          label: 'Packs',
          icon: '📦',
          onSelect: () => {
            void abrirSimulacoes('packs')
          },
        },
        {
          id: 'simulacoes-packs-inteligentes',
          label: 'Packs Inteligentes',
          icon: '🧠',
          onSelect: () => {
            void abrirSimulacoes('packs-inteligentes')
          },
        },
            ],
          },
        ]
      : []),
    ...(canSeeProposalsEffective
      ? [
          {
            id: 'relatorios',
            label: 'Relatórios',
            items: [
              {
                id: 'relatorios-pdfs',
                label: 'Ver propostas',
                icon: '📂',
                onSelect: () => {
                  void abrirPesquisaOrcamentos()
                },
              },
              {
                id: 'relatorios-exportacoes',
                label: 'Exportar',
                icon: '📤',
                onSelect: () => {
                  setActivePage('app')
                },
              },
            ],
          },
        ]
      : []),
    ...((canSeeClientsEffective || canSeeProposalsEffective)
      ? [
          {
            id: 'orcamentos',
            label: 'Orçamentos',
            items: [
              {
                id: 'orcamentos-importar',
                label: 'Consultar',
                icon: '📄',
                onSelect: () => {
                  void abrirPesquisaOrcamentos()
                },
              },
            ],
          },
        ]
      : []),
    ...(crmItems.length > 0
      ? [
          {
            id: 'crm',
            label: 'CRM',
            items: crmItems,
          },
        ]
      : []),
    {
      id: 'configuracoes',
      label: '',
      items: [] as SidebarItem[],
    },
  ]
}
