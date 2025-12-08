import React from 'react'

import './styles/print-common.css'
import './styles/proposal-leasing.css'
import { currency, formatCpfCnpj, tarifaCurrency } from '../../utils/formatters'
import { formatMoneyBR, formatNumberBRWithOptions } from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'

const PRAZO_LEASING_MESES = 60

const formatKwhMes = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }

  const numero = formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  return `${numero} kWh/mês`
}

const formatKwp = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }

  const numero = formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return `${numero} kWp`
}

const formatWp = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return null
  }

  const numero = formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  return `${numero} Wp`
}

const formatEnderecoCompleto = (
  endereco?: string | null,
  cidade?: string | null,
  uf?: string | null,
  cep?: string | null,
) => {
  const partes: string[] = []

  if (endereco?.trim()) {
    partes.push(endereco.trim())
  }

  const cidadeUf = [cidade?.trim(), uf?.trim()].filter(Boolean).join(' / ')
  if (cidadeUf) {
    partes.push(cidadeUf)
  }

  if (cep?.trim()) {
    partes.push(`CEP ${cep.trim()}`)
  }

  return partes.filter(Boolean).join(' • ')
}

const legalFooter = (
  <p className="print-legal-footer">
    <strong>Aviso:</strong> Todos os valores apresentados nesta proposta são estimativas e podem variar conforme consumo real,
    condições climáticas, reajustes tarifários e bandeiras tarifárias da distribuidora de energia. Esta proposta não constitui
    promessa de economia garantida.
  </p>
)

function PrintableProposalLeasingInner(
  props: PrintableProposalProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    cliente,
    ucGeradora,
    geracaoMensalKwh,
    energiaContratadaKwh,
    potenciaInstaladaKwp,
    numeroModulos,
    potenciaModulo,
    leasingModeloModulo,
    leasingModeloInversor,
    tarifaCheia,
    parcelasLeasing,
    leasingDataInicioOperacao,
    leasingROI,
    anos,
  } = props

  const clienteNome = cliente.nome?.trim() || '—'
  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : '—'
  const enderecoCompleto =
    formatEnderecoCompleto(cliente.endereco, cliente.cidade, cliente.uf, cliente.cep) || '—'
  const unidadeConsumidora = ucGeradora?.numero?.trim() || cliente.uc?.trim() || '—'

  const potenciaInstalada = formatKwp(potenciaInstaladaKwp)
  const modulosDescricao = leasingModeloModulo?.trim()
    ? leasingModeloModulo.trim()
    : numeroModulos > 0
      ? `${numeroModulos} módulos${formatWp(potenciaModulo) ? ` de ${formatWp(potenciaModulo)}` : ''}`
      : '—'
  const inversoresDescricao = leasingModeloInversor?.trim() || '—'
  const geracaoEstimativa = formatKwhMes(geracaoMensalKwh)
  const energiaContratada = formatKwhMes(energiaContratadaKwh)

  const mensalidadeEstimativaValor = parcelasLeasing?.[0]?.mensalidade
  const mensalidadeEstimativaLabel = Number.isFinite(mensalidadeEstimativaValor)
    ? currency(mensalidadeEstimativaValor ?? 0)
    : '—'

  const tarifaBaseLabel = Number.isFinite(tarifaCheia) && (tarifaCheia ?? 0) > 0 ? tarifaCurrency(tarifaCheia ?? 0) : '—'
  const dataInicio = leasingDataInicioOperacao?.trim() || '—'

  const economiaAno1Valor = (() => {
    const indiceAno1 = anos.findIndex((ano) => ano === 1)
    if (indiceAno1 >= 0 && Number.isFinite(leasingROI[indiceAno1])) {
      return leasingROI[indiceAno1]
    }
    return Number.isFinite(leasingROI?.[0]) ? leasingROI[0] : null
  })()

  const economiaTotalValor = (() => {
    const indiceCincoAnos = anos.findIndex((ano) => ano >= 5)
    if (indiceCincoAnos >= 0 && Number.isFinite(leasingROI[indiceCincoAnos])) {
      return leasingROI[indiceCincoAnos]
    }
    return leasingROI.length > 0 && Number.isFinite(leasingROI[leasingROI.length - 1])
      ? leasingROI[leasingROI.length - 1]
      : null
  })()

  const economiaAno1Label = economiaAno1Valor != null ? formatMoneyBR(economiaAno1Valor) : '—'
  const economiaTotalLabel = economiaTotalValor != null ? formatMoneyBR(economiaTotalValor) : '—'

  return (
    <div ref={ref} className="print-root">
      <div className="print-layout leasing-print-layout" data-print-section="proposal" aria-hidden="false">
        <div className="print-page">
          <header className="print-header">
            <div className="print-header__brand">
              <img src="/proposal-header-logo.svg" alt="Logo SolarInvest" />
              <div className="print-header__titles">
                <p className="print-header__headline">Proposta Comercial SolarInvest</p>
                <p className="print-header__subtitle">Leasing com operação completa, manutenção e suporte incluídos</p>
              </div>
            </div>
          </header>

          <section className="print-section keep-together" id="dados-cliente">
            <h2 className="section-title">Dados do Cliente</h2>
            <ul className="print-info-list">
              <li>
                <strong>Cliente:</strong> {clienteNome}
              </li>
              <li>
                <strong>CPF/CNPJ:</strong> {documentoCliente}
              </li>
              <li>
                <strong>Endereço:</strong> {enderecoCompleto}
              </li>
              <li>
                <strong>UC (Unidade Consumidora):</strong> {unidadeConsumidora}
              </li>
            </ul>
          </section>

          <section className="print-section keep-together" id="apresentacao">
            <h2 className="section-title">Apresentação da Proposta</h2>
            <p>
              A SolarInvest agradece a oportunidade de apresentar esta proposta de fornecimento de energia solar em modelo de
              leasing, com operação completa, manutenção, seguro e suporte técnico durante toda a vigência do contrato.
            </p>
            <p>Esta proposta foi desenvolvida com base:</p>
            <ul>
              <li>Nas informações fornecidas pelo cliente;</li>
              <li>No histórico de consumo da unidade consumidora;</li>
              <li>Na tarifa vigente da distribuidora local;</li>
              <li>Na análise técnica preliminar do local de instalação.</li>
            </ul>
            <p>
              Todos os valores apresentados são simulações que podem variar conforme tarifação, condições climáticas e consumo
              real.
            </p>
          </section>

          <section className="print-section keep-together" id="resumo-solucao">
            <h2 className="section-title">Resumo da Solução Proposta</h2>
            <div className="print-subsection">
              <h3 className="print-subheading">Sistema Fotovoltaico</h3>
              <ul>
                <li>Potência instalada estimada: {potenciaInstalada}</li>
                <li>Módulos: {modulosDescricao}</li>
                <li>Inversores: {inversoresDescricao}</li>
                <li>Arquitetura: On-Grid / Híbrido (definida conforme viabilidade técnica)</li>
              </ul>
            </div>

            <div className="print-subsection">
              <h3 className="print-subheading">Energia Estimada</h3>
              <ul>
                <li>Geração mensal estimada: {geracaoEstimativa}</li>
                <li>Energia contratada no modelo de leasing: {energiaContratada}</li>
              </ul>
              <p>
                Observação: A energia contratada poderá ser ajustada conforme limitações de área, inclinação, sombreamento ou
                condições estruturais. Esse ajuste não altera a forma de cálculo da mensalidade, apenas ajusta a energia
                efetivamente gerada e compensada para o cliente.
              </p>
            </div>
          </section>

          <section className="print-section keep-together" id="mensalidade-estimada">
            <h2 className="section-title">Mensalidade Estimada</h2>
            <p>A mensalidade do leasing é calculada considerando:</p>
            <ul>
              <li>O valor atual da tarifa da distribuidora;</li>
              <li>A parcela de energia que será compensada pelo sistema;</li>
              <li>O histórico de reajustes da distribuidora;</li>
              <li>A projeção de geração ao longo dos meses.</li>
            </ul>

            <div className="print-key-values">
              <p>
                <strong>Tarifa-base atual:</strong> {tarifaBaseLabel}
              </p>
              <p>
                <strong>Mensalidade estimada:</strong> {mensalidadeEstimativaLabel}
              </p>
              <p>
                <strong>Prazo contratual:</strong> {PRAZO_LEASING_MESES} meses
              </p>
              <p>
                <strong>Previsão de ativação:</strong> {dataInicio}
              </p>
            </div>
            <p className="print-highlight">
              <strong>Importante:</strong> a mensalidade é uma estimativa que acompanha os reajustes tarifários da distribuidora,
              já que o valor do kWh não é definido pela SolarInvest.
            </p>
            {legalFooter}
          </section>

          <section className="print-section keep-together" id="economia-estimada">
            <h2 className="section-title">Economia Estimada</h2>
            <p>Com base no consumo informado e na tarifa vigente, estimamos:</p>
            <ul>
              <li>Economia estimada no primeiro ano: {economiaAno1Label}</li>
              <li>Economia estimada ao longo de 60 meses: {economiaTotalLabel}</li>
            </ul>
            <p>
              As economias apresentadas são projeções baseadas em dados históricos e comportamento tarifário. Podem variar
              conforme consumo real, bandeiras tarifárias e condições climáticas.
            </p>
            {legalFooter}
          </section>

          <section className="print-section keep-together" id="informacoes-importantes">
            <h2 className="section-title">Informações Importantes (Responsabilidades, Garantias e Condições Gerais)</h2>

            <div className="print-subsection">
              <h3 className="print-subheading">Operação e Suporte Técnico</h3>
              <p>Durante a vigência do contrato, a SolarInvest assume integralmente:</p>
              <ul>
                <li>Operação da usina;</li>
                <li>Monitoramento remoto;</li>
                <li>Manutenção preventiva e corretiva;</li>
                <li>Seguro contra danos elétricos, incêndio, vendaval, queda de raio e roubo, conforme apólice vigente;</li>
                <li>Substituição de componentes quando necessário;</li>
                <li>Atendimento técnico especializado.</li>
              </ul>
            </div>

            <div className="print-subsection">
              <h3 className="print-subheading">Qualidade dos Equipamentos</h3>
              <p>Todos os equipamentos utilizados são certificados pelo INMETRO e instalados conforme:</p>
              <ul>
                <li>Normas da ANEEL;</li>
                <li>Normas da ABNT aplicáveis;</li>
                <li>Requisitos da distribuidora local.</li>
              </ul>
            </div>

            <div className="print-subsection">
              <h3 className="print-subheading">Projeções e Simulações</h3>
              <p>As informações de geração, economia e mensalidade são estimativas, elaboradas a partir de:</p>
              <ul>
                <li>Tarifas vigentes;</li>
                <li>Dados históricos da distribuidora;</li>
                <li>Consumo informado pelo cliente;</li>
                <li>Condições climáticas médias da região.</li>
              </ul>
              <p>
                Não há garantia de economia fixa, pois a tarifa de energia, as bandeiras tarifárias e o consumo variam
                mensalmente.
              </p>
            </div>

            <div className="print-subsection">
              <h3 className="print-subheading">Reajustes Tarifários</h3>
              <p>A distribuidora de energia pode aplicar:</p>
              <ul>
                <li>Reajustes anuais homologados pela ANEEL;</li>
                <li>Reajustes extraordinários;</li>
                <li>Bandeiras tarifárias.</li>
              </ul>
              <p>Esses fatores impactam diretamente:</p>
              <ul>
                <li>O valor final da mensalidade;</li>
                <li>A economia estimada;</li>
                <li>O comparativo com a conta tradicional de energia.</li>
              </ul>
              <p>A SolarInvest não controla os valores das tarifas da distribuidora.</p>
            </div>

            <div className="print-subsection">
              <h3 className="print-subheading">Geração e Condições Técnicas</h3>
              <p>A geração final do sistema pode ser influenciada por:</p>
              <ul>
                <li>Estações do ano e variações climáticas;</li>
                <li>Sombreamento ocasional ou permanente;</li>
                <li>Poeira, sujeira ou obstruções nos módulos;</li>
                <li>Degradação natural dos equipamentos;</li>
                <li>Condições estruturais reais encontradas no local.</li>
              </ul>
            </div>
          </section>

          <section className="print-section keep-together" id="garantia-performance">
            <h2 className="section-title">Garantia de Performance</h2>
            <p>
              A SolarInvest projeta a usina para gerar, anualmente, a energia prevista nesta proposta, considerando ciclos de 12
              meses consecutivos, desde que:
            </p>
            <ul>
              <li>
                Não ocorram obstruções inesperadas (novas construções, árvores, antenas, reformas) que causem sombreamento
                relevante;
              </li>
              <li>O cliente não altere a estrutura ou o layout da cobertura sem comunicação prévia;</li>
              <li>O sistema esteja operando dentro dos limites técnicos e climáticos previstos para a região.</li>
            </ul>
          </section>

          <section className="print-section keep-together" id="opcao-compra">
            <h2 className="section-title">Opção de Compra ao Final ou Durante o Contrato</h2>
            <p>
              Ao final do prazo contratual (60 meses), a propriedade do sistema passa automaticamente para o cliente, sem custo
              adicional, conforme condições do contrato.
            </p>
            <div className="print-subsection">
              <h3 className="print-subheading">Compra antecipada</h3>
              <p>
                O cliente poderá solicitar a compra antecipada do sistema a partir do 7º mês de vigência do contrato. O valor
                será calculado considerando, entre outros parâmetros:
              </p>
              <ul>
                <li>Valor de mercado atualizado do sistema;</li>
                <li>Tempo de uso;</li>
                <li>Investimento remanescente;</li>
                <li>Atualização econômica;</li>
                <li>Parcelas já pagas até a data da solicitação.</li>
              </ul>
              <p>
                Após a compra antecipada, a SolarInvest deixa de ser responsável por manutenção, seguro e operação do sistema,
                que passa a ser de propriedade integral do cliente.
              </p>
            </div>
          </section>

          <section className="print-section keep-together" id="proximos-passos">
            <h2 className="section-title">Próximos Passos</h2>
            <p>Para seguirmos com a implantação da usina solar, são necessários os seguintes passos:</p>
            <ol>
              <li>Assinatura eletrônica do contrato de leasing;</li>
              <li>Envio da documentação pessoal ou empresarial solicitada;</li>
              <li>Vistoria técnica detalhada e validação do projeto junto à distribuidora;</li>
              <li>Instalação da usina conforme cronograma acordado;</li>
              <li>Homologação e ativação do sistema de compensação de energia elétrica.</li>
            </ol>
          </section>

          <section className="print-section print-section--footer no-break-inside">
            {legalFooter}
            <div className="print-brand-footer">
              <strong>SolarInvest</strong>
              <span>Transformando economia mensal em patrimônio real</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export const PrintableProposalLeasing = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalLeasingInner,
)

export default PrintableProposalLeasing
