/**
 * Anexo I - Template PDF
 * 
 * Anexo com especificações técnicas detalhadas do sistema.
 */

import { Document, Page, View, Text } from '@react-pdf/renderer';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Section } from '../components/Section';
import { Paragraph } from '../components/Paragraph';
import { Table } from '../components/Table';
import { styles } from '../styles/theme';
import { isNotEmpty } from '../styles/formatters';
import type { ContratoData } from '../schemas/contrato.schema';

export interface AnexoIProps {
  data: ContratoData;
}

export function AnexoIPdf({ data }: AnexoIProps) {
  const { dadosTecnicos } = data;

  // Example technical data table
  const technicalData = [
    ...(isNotEmpty(dadosTecnicos?.potencia) 
      ? [{ item: 'Potência Instalada', valor: `${dadosTecnicos?.potencia} kWp` }]
      : []
    ),
    ...(isNotEmpty(dadosTecnicos?.modulosFV)
      ? [{ item: 'Módulos Fotovoltaicos', valor: dadosTecnicos?.modulosFV }]
      : []
    ),
    ...(isNotEmpty(dadosTecnicos?.inversoresFV)
      ? [{ item: 'Inversores', valor: dadosTecnicos?.inversoresFV }]
      : []
    ),
    ...(isNotEmpty(dadosTecnicos?.kWhContratado)
      ? [{ item: 'Geração Mensal Estimada', valor: `${dadosTecnicos?.kWhContratado} kWh` }]
      : []
    ),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header title="ANEXO I" subtitle="Especificações Técnicas do Sistema" />

        <Section title="DADOS TÉCNICOS">
          <Paragraph>
            Este anexo apresenta as especificações técnicas detalhadas do sistema de geração 
            fotovoltaica objeto do contrato de leasing.
          </Paragraph>

          {technicalData.length > 0 && (
            <Table
              columns={[
                { header: 'Item', key: 'item', width: '50%' },
                { header: 'Especificação', key: 'valor', width: '50%' },
              ]}
              data={technicalData}
            />
          )}
        </Section>

        <Section title="CARACTERÍSTICAS DO SISTEMA">
          <Paragraph>
            O sistema fotovoltaico será dimensionado e instalado de acordo com as normas 
            técnicas vigentes, incluindo NBR 16690 e demais regulamentações aplicáveis 
            da ANEEL e concessionária local.
          </Paragraph>

          <Paragraph>
            A geração de energia estimada considera as condições médias de irradiação solar 
            da região e pode variar conforme condições climáticas ao longo do ano.
          </Paragraph>
        </Section>

        <Footer 
          text="Anexo I - Especificações Técnicas"
          showPageNumbers={true}
        />
      </Page>
    </Document>
  );
}
