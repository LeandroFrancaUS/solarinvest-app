// src/features/simulacoes/SimulacoesStaticModuleCard.tsx
// Static module cards for IA, Risco, Packs and Packs Inteligentes sections.
// Extracted from App.tsx (Subfase 2B.12.3).

import type { SimulacoesSection } from '../../types/navigation'
import { SIMULACOES_SECTION_COPY } from './simulacoesConstants'

interface SimulacoesStaticModuleCardProps {
  section: SimulacoesSection
}

export function SimulacoesStaticModuleCard({ section }: SimulacoesStaticModuleCardProps) {
  if (section === 'ia') {
    return (
      <section className="simulacoes-module-card">
        <header>
          <h3>Análises IA</h3>
          <p>{SIMULACOES_SECTION_COPY[section]}</p>
        </header>
        <div className="simulacoes-module-grid">
          <div className="simulacoes-module-tile">
            <h4>KPIs monitorados</h4>
            <ul>
              <li>ROI, TIR e payback revisados continuamente.</li>
              <li>Alertas de margem mínima e spread solar.</li>
              <li>Clustering de consumo por perfil residencial ou empresarial.</li>
            </ul>
          </div>
          <div className="simulacoes-module-tile">
            <h4>Recomendações</h4>
            <ul>
              <li>Descontos ótimos por distribuidora e bandeira.</li>
              <li>Revisão automática de TUSD e capex.</li>
              <li>Geração de sugestões para Packs Inteligentes.</li>
            </ul>
          </div>
          <div className="simulacoes-module-tile">
            <h4>Exportação</h4>
            <ul>
              <li>Resumo IA preparado para PDF interno e externo.</li>
              <li>Trilha de recomendações com timestamp.</li>
              <li>Integração com painel de aprovação.</li>
            </ul>
          </div>
        </div>
      </section>
    )
  }

  if (section === 'risco') {
    return (
      <section className="simulacoes-module-card">
        <header>
          <h3>Risco &amp; Monte Carlo</h3>
          <p>{SIMULACOES_SECTION_COPY[section]}</p>
        </header>
        <div className="simulacoes-module-grid">
          <div className="simulacoes-module-tile">
            <h4>Entradas</h4>
            <ul>
              <li>Inflação energética, TUSD e consumo ajustável.</li>
              <li>Distribuições customizadas para cenários pessimista e otimista.</li>
              <li>Capex SolarInvest com seguro e encargo embutidos.</li>
            </ul>
          </div>
          <div className="simulacoes-module-tile">
            <h4>Saídas</h4>
            <ul>
              <li>Faixas de VPL e ROI com IC 95%.</li>
              <li>Mapa de sensibilidade full-width.</li>
              <li>Exportação rápida para análise interna.</li>
            </ul>
          </div>
          <div className="simulacoes-module-tile">
            <h4>Operação</h4>
            <ul>
              <li>Rodadas paralelas para cada cenário salvo.</li>
              <li>Integração com IA para detectar outliers.</li>
              <li>Pronto para aprovação interna no próximo passo.</li>
            </ul>
          </div>
        </div>
      </section>
    )
  }

  if (section === 'packs') {
    return (
      <section className="simulacoes-module-card">
        <header>
          <h3>Packs</h3>
          <p>{SIMULACOES_SECTION_COPY[section]}</p>
        </header>
        <div className="simulacoes-module-grid">
          <div className="simulacoes-module-tile">
            <h4>Organização</h4>
            <ul>
              <li>Separação por segmento (residencial, comercial, rural).</li>
              <li>Padrões de desconto e prazo salvos.</li>
              <li>Tags rápidas para buscas no CRM.</li>
            </ul>
          </div>
          <div className="simulacoes-module-tile">
            <h4>Aplicação</h4>
            <ul>
              <li>Aplicar pack diretamente no workspace.</li>
              <li>Duplicar e adaptar valores de mercado.</li>
              <li>Conectar com proposta PDF em um clique.</li>
            </ul>
          </div>
        </div>
      </section>
    )
  }

  if (section === 'packs-inteligentes') {
    return (
      <section className="simulacoes-module-card">
        <header>
          <h3>Packs Inteligentes</h3>
          <p>{SIMULACOES_SECTION_COPY[section]}</p>
        </header>
        <div className="simulacoes-module-grid">
          <div className="simulacoes-module-tile">
            <h4>Automação</h4>
            <ul>
              <li>Regras por ROI mínimo e VPL alvo.</li>
              <li>Ajuste automático de potência e seguros.</li>
              <li>Alertas quando o pack sai da faixa aprovada.</li>
            </ul>
          </div>
          <div className="simulacoes-module-tile">
            <h4>IA Assistida</h4>
            <ul>
              <li>Sugere combinações de módulos e inversores.</li>
              <li>Reaproveita simulações vencedoras.</li>
              <li>Cria versões para teste A/B com clientes.</li>
            </ul>
          </div>
        </div>
      </section>
    )
  }

  return null
}
