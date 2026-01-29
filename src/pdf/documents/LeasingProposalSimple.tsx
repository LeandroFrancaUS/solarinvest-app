/**
 * Leasing Proposal - Simple Version
 * Compact proposal with essential information (6-8 pages max)
 * A4 real size, zero margins, editorial premium appearance
 */

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { styles as themeStyles, SPACING, FONT_SIZE, COLORS } from '../theme'
import { PdfHeader } from '../components/PdfHeader'
import { PdfFooter } from '../components/PdfFooter'
import { SectionTitle } from '../components/SectionTitle'
import { KeyValueTable, type KeyValueRow } from '../components/KeyValueTable'
import { PricingComparisonTable } from '../components/PricingComparisonTable'
import type { LeasingProposalData } from '../types'

const styles = StyleSheet.create({
  page: {
    ...themeStyles.page,
  },
  content: {
    paddingBottom: 60, // Space for footer
  },
  textBlock: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    fontSize: FONT_SIZE.base,
    lineHeight: 1.5,
    color: COLORS.text.primary,
  },
  highlight: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background.accent,
    marginBottom: SPACING.md,
  },
  highlightText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text.primary,
    lineHeight: 1.4,
  },
})

type LeasingProposalSimpleProps = {
  data: LeasingProposalData
}

export const LeasingProposalSimple: React.FC<LeasingProposalSimpleProps> = ({ data }) => {
  // Format helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }
  
  const formatTariff = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value)
  }
  
  const formatKwh = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' kWh'
  }
  
  const formatKwp = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + ' kWp'
  }
  
  // Build rows for tables
  const clientRows: KeyValueRow[] = [
    { label: 'Cliente', value: data.cliente.nome || '—' },
    { label: 'Documento', value: data.cliente.documento || '—' },
    { label: 'E-mail', value: data.cliente.email || '—' },
    { label: 'Telefone', value: data.cliente.telefone || '—' },
    { label: 'Endereço', value: data.cliente.endereco || '—' },
    { label: 'Cidade/UF', value: `${data.cliente.cidade || '—'} / ${data.cliente.uf || '—'}` },
  ]
  
  const systemRows: KeyValueRow[] = [
    { label: 'Potência instalada', value: formatKwp(data.potenciaInstaladaKwp) },
    { label: 'Geração estimada', value: formatKwh(data.geracaoMensalKwh) + '/mês' },
    { label: 'Módulos fotovoltaicos', value: `${data.numeroModulos} unidades` },
    { label: 'Modelo do módulo', value: data.modeloModulo || '—' },
    { label: 'Inversores', value: data.modeloInversor || '—' },
    { label: 'Tipo de instalação', value: data.tipoInstalacao },
    { label: 'Área necessária', value: `${Math.round(data.areaInstalacao)} m²` },
  ]
  
  const ucRows: KeyValueRow[] = [
    { label: 'UC Geradora', value: data.ucGeradora?.numero || data.cliente.uc || '—' },
    { label: 'Endereço', value: data.ucGeradora?.endereco || '—' },
    { label: 'Distribuidora', value: data.distribuidora },
  ]
  
  const financialRows: KeyValueRow[] = [
    { label: 'Modalidade', value: 'Leasing SolarInvest — investimento total pela SolarInvest' },
    { label: 'Prazo contratual', value: `${data.prazoContratualMeses} meses (${Math.ceil(data.prazoContratualMeses / 12)} anos)` },
    { label: 'Investimento do cliente', value: formatCurrency(data.valorInstalacaoCliente) },
    { label: 'Energia contratada', value: formatKwh(data.energiaContratadaKwh) + '/mês' },
    { label: 'Desconto contratual', value: `${(data.descontoContratualPct * 100).toFixed(0)}%` },
    { label: 'Responsabilidades', value: 'Operação, manutenção, monitoramento e seguro' },
  ]
  
  if (data.validadeDias) {
    financialRows.unshift({
      label: 'Validade da proposta',
      value: `${data.validadeDias} dias`,
    })
  }
  
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <PdfHeader
            eyebrow="Proposta Comercial Leasing"
            title="Energia Solar Fotovoltaica"
            subtitle="Investimento total pela SolarInvest com economia imediata"
            budgetId={data.budgetId}
            date={new Date().toLocaleDateString('pt-BR')}
          />
          
          <View style={styles.highlight}>
            <Text style={styles.highlightText}>
              Gere sua própria energia limpa e renovável com ZERO investimento inicial.
              Economia desde o primeiro mês.
            </Text>
          </View>
        </View>
        <PdfFooter />
      </Page>
      
      {/* Client & System Information */}
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <SectionTitle title="Identificação do Cliente" />
          <KeyValueTable rows={clientRows} />
          
          <SectionTitle title="Especificações da Usina Solar" />
          <KeyValueTable rows={systemRows} />
          
          <SectionTitle title="Dados da Instalação" />
          <KeyValueTable rows={ucRows} />
        </View>
        <PdfFooter />
      </Page>
      
      {/* Financial Terms */}
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <SectionTitle 
            title="Condições Financeiras do Leasing" 
            subtitle="Valores projetados e vigência contratual"
          />
          <KeyValueTable rows={financialRows} />
          
          <View style={styles.textBlock}>
            <Text>
              A SolarInvest realiza 100% do investimento na instalação do sistema fotovoltaico.
              O cliente paga apenas pela energia gerada, com tarifa reduzida e desconto garantido.
            </Text>
          </View>
        </View>
        <PdfFooter />
      </Page>
      
      {/* Pricing Timeline */}
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <SectionTitle 
            title="Economia Gerada com a Solução SolarInvest" 
            subtitle="Comparativo de mensalidades por ano contratual"
          />
          <PricingComparisonTable
            rows={data.mensalidadesPorAno}
            formatCurrency={formatCurrency}
            formatTariff={formatTariff}
          />
          
          <View style={styles.textBlock}>
            <Text>
              Os valores acima são estimativas baseadas no consumo histórico, irradiação média
              da região e tarifa vigente da distribuidora. Valores podem variar conforme consumo
              real e reajustes tarifários.
            </Text>
          </View>
        </View>
        <PdfFooter />
      </Page>
      
      {/* Terms & Conditions */}
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <SectionTitle title="Informações Importantes" />
          
          <View style={styles.textBlock}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: SPACING.sm }}>
              Responsabilidades da SolarInvest:
            </Text>
            <Text>
              • Investimento total na instalação do sistema{'\n'}
              • Operação e manutenção durante todo o contrato{'\n'}
              • Monitoramento remoto 24/7{'\n'}
              • Limpeza periódica dos módulos{'\n'}
              • Seguro contra danos e intempéries{'\n'}
              • Garantia de performance da usina
            </Text>
          </View>
          
          <View style={styles.textBlock}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: SPACING.sm }}>
              Responsabilidades do Cliente:
            </Text>
            <Text>
              • Pagamento da mensalidade conforme contrato{'\n'}
              • Disponibilização do local para instalação{'\n'}
              • Manutenção das condições de acesso à usina{'\n'}
              • Cumprimento das obrigações contratuais
            </Text>
          </View>
          
          {data.observacoes && (
            <View style={styles.textBlock}>
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: SPACING.sm }}>
                Observações:
              </Text>
              <Text>{data.observacoes}</Text>
            </View>
          )}
        </View>
        <PdfFooter />
      </Page>
    </Document>
  )
}
