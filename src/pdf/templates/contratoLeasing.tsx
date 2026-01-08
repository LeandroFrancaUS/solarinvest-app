/**
 * Contrato de Leasing - Template PDF
 * 
 * Template principal para contratos de leasing de sistema fotovoltaico.
 */

import { Document, Page, View, Text } from '@react-pdf/renderer';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Section } from '../components/Section';
import { Paragraph } from '../components/Paragraph';
import { SignatureBlock } from '../components/SignatureBlock';
import { styles } from '../styles/theme';
import { 
  maskCpfCnpj, 
  formatDateExtended, 
  toUpperCase,
  isNotEmpty 
} from '../styles/formatters';
import type { ContratoData } from '../schemas/contrato.schema';

export interface ContratoLeasingProps {
  data: ContratoData;
}

export function ContratoLeasingPdf({ data }: ContratoLeasingProps) {
  const { cliente, dadosTecnicos, dadosContratuais, contratada } = data;
  
  // Build complete address
  const enderecoCompleto = toUpperCase(
    `${cliente.endereco}, ${cliente.cidade} - ${cliente.uf}, ${cliente.cep}`
  );
  
  // Get current date
  const dataAtual = formatDateExtended(new Date());
  const cidadeData = `${cliente.cidade}, ${dataAtual}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header 
          title="CONTRATO DE LEASING"
          subtitle="Sistema de Geração de Energia Fotovoltaica"
        />

        <Section title="QUALIFICAÇÃO DAS PARTES">
          <Paragraph>
            <Text style={styles.bodyBold}>CONTRATANTE: </Text>
            {toUpperCase(cliente.nomeCompleto)}
            {isNotEmpty(cliente.razaoSocial) && ` (${toUpperCase(cliente.razaoSocial)})`}
            , inscrito no {cliente.cpfCnpj.length <= 14 ? 'CPF' : 'CNPJ'} sob o n° {maskCpfCnpj(cliente.cpfCnpj)}
            {isNotEmpty(cliente.rg) && `, RG ${cliente.rg}`}
            , residente e domiciliado em {enderecoCompleto}
            {isNotEmpty(cliente.email) && `, e-mail: ${cliente.email}`}
            {isNotEmpty(cliente.telefone) && `, telefone: ${cliente.telefone}`}.
          </Paragraph>

          <Paragraph>
            <Text style={styles.bodyBold}>CONTRATADA: </Text>
            SOLARINVEST ENERGIA LTDA
            {isNotEmpty(contratada?.cnpjContratada) && `, CNPJ ${maskCpfCnpj(contratada.cnpjContratada)}`}
            {isNotEmpty(contratada?.enderecoContratada) && `, com sede em ${contratada.enderecoContratada}`}.
          </Paragraph>
        </Section>

        <Section title="OBJETO DO CONTRATO">
          <Paragraph>
            O presente instrumento tem por objeto o leasing de sistema de geração de energia 
            elétrica por meio de tecnologia fotovoltaica
            {isNotEmpty(dadosTecnicos?.potencia) && ` com potência de ${dadosTecnicos?.potencia} kWp`}
            , a ser instalado na unidade consumidora
            {isNotEmpty(dadosTecnicos?.unidadeConsumidora) && ` de número ${dadosTecnicos?.unidadeConsumidora}`}
            {isNotEmpty(cliente.enderecoUCGeradora) 
              ? `, localizada em ${toUpperCase(cliente.enderecoUCGeradora)}`
              : `, localizada em ${enderecoCompleto}`
            }.
          </Paragraph>
        </Section>

        <Section title="PRAZO E CONDIÇÕES">
          <Paragraph>
            O prazo de vigência do presente contrato é de
            {isNotEmpty(dadosContratuais?.prazoContratual) 
              ? ` ${dadosContratuais?.prazoContratual} meses`
              : ' [prazo a definir]'
            }
            {isNotEmpty(dadosContratuais?.dataInicio) && ` a partir de ${dadosContratuais?.dataInicio}`}
            .
          </Paragraph>

          {isNotEmpty(dadosContratuais?.diaVencimento) && (
            <Paragraph>
              O vencimento das parcelas mensais ocorrerá todo dia {dadosContratuais?.diaVencimento} 
              de cada mês.
            </Paragraph>
          )}
        </Section>

        {isNotEmpty(dadosTecnicos?.modulosFV) && (
          <Section title="ESPECIFICAÇÕES TÉCNICAS">
            {isNotEmpty(dadosTecnicos?.modulosFV) && (
              <Paragraph>
                <Text style={styles.bodyBold}>Módulos Fotovoltaicos: </Text>
                {dadosTecnicos?.modulosFV}
              </Paragraph>
            )}
            
            {isNotEmpty(dadosTecnicos?.inversoresFV) && (
              <Paragraph>
                <Text style={styles.bodyBold}>Inversores: </Text>
                {dadosTecnicos?.inversoresFV}
              </Paragraph>
            )}

            {isNotEmpty(dadosTecnicos?.kWhContratado) && (
              <Paragraph>
                <Text style={styles.bodyBold}>Geração Estimada: </Text>
                {dadosTecnicos?.kWhContratado} kWh/mês
              </Paragraph>
            )}
          </Section>
        )}

        <Section title="RESPONSABILIDADES">
          <Paragraph>
            A CONTRATADA se responsabiliza pela instalação, operação e manutenção do sistema 
            fotovoltaico durante todo o período de vigência deste contrato.
          </Paragraph>

          <Paragraph>
            O CONTRATANTE se compromete a manter a unidade consumidora em condições adequadas 
            para a operação do sistema e efetuar o pagamento das parcelas mensais conforme 
            acordado.
          </Paragraph>
        </Section>

        <Section title="DISPOSIÇÕES GERAIS">
          <Paragraph>
            Este contrato é celebrado em caráter irrevogável e irretratável, obrigando as 
            partes e seus sucessores a qualquer título.
          </Paragraph>

          <Paragraph>
            Fica eleito o foro da comarca de {cliente.cidade}/{cliente.uf} para dirimir 
            quaisquer questões oriundas do presente contrato.
          </Paragraph>
        </Section>

        <SignatureBlock
          cityDate={cidadeData}
          contractorSignature={{
            name: toUpperCase(cliente.nomeCompleto),
            document: maskCpfCnpj(cliente.cpfCnpj),
            role: 'CONTRATANTE',
          }}
          contracteeSignature={{
            name: 'SOLARINVEST ENERGIA LTDA',
            document: contratada?.cnpjContratada ? maskCpfCnpj(contratada.cnpjContratada) : undefined,
            role: 'CONTRATADA',
          }}
        />

        <Footer 
          text="Contrato de Leasing - Sistema Fotovoltaico"
          showPageNumbers={true}
        />
      </Page>
    </Document>
  );
}
