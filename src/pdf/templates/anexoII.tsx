/**
 * Anexo II - Template PDF
 * 
 * Anexo com condições comerciais e financeiras.
 */

import { Document, Page, View, Text } from '@react-pdf/renderer';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Section } from '../components/Section';
import { Paragraph } from '../components/Paragraph';
import { styles } from '../styles/theme';
import { isNotEmpty } from '../styles/formatters';
import type { ContratoData } from '../schemas/contrato.schema';

export interface AnexoIIProps {
  data: ContratoData;
}

export function AnexoIIPdf({ data }: AnexoIIProps) {
  const { dadosContratuais } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header title="ANEXO II" subtitle="Condições Comerciais e Financeiras" />

        <Section title="CONDIÇÕES DE PAGAMENTO">
          <Paragraph>
            As condições comerciais e financeiras deste contrato de leasing estão 
            estabelecidas conforme descrito no instrumento contratual principal.
          </Paragraph>

          {isNotEmpty(dadosContratuais?.prazoContratual) && (
            <Paragraph>
              <Text style={styles.bodyBold}>Prazo: </Text>
              {dadosContratuais?.prazoContratual} meses
            </Paragraph>
          )}

          {isNotEmpty(dadosContratuais?.diaVencimento) && (
            <Paragraph>
              <Text style={styles.bodyBold}>Dia de Vencimento: </Text>
              {dadosContratuais?.diaVencimento} de cada mês
            </Paragraph>
          )}
        </Section>

        <Section title="FORMA DE PAGAMENTO">
          <Paragraph>
            O pagamento das parcelas mensais deverá ser realizado por meio de boleto bancário 
            ou débito automático, conforme escolha do CONTRATANTE.
          </Paragraph>

          <Paragraph>
            Em caso de atraso no pagamento, incidirão juros de mora e multa conforme 
            estabelecido no contrato principal.
          </Paragraph>
        </Section>

        <Section title="REAJUSTE">
          <Paragraph>
            Os valores do leasing poderão ser reajustados anualmente pelo índice IGPM/FGV 
            ou outro índice que venha a substituí-lo, conforme previsto no contrato principal.
          </Paragraph>
        </Section>

        <Footer 
          text="Anexo II - Condições Comerciais"
          showPageNumbers={true}
        />
      </Page>
    </Document>
  );
}
