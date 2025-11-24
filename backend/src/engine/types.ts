export interface RawInvoiceData {
  distribuidora: string | null;
  uf: string | null;
  mesReferencia: string | null;
  numeroCliente?: string | null;
  numeroInstalacao?: string | null;
  numeroContaContrato?: string | null;
  consumoKWh: number | null;
  energiaCompensadaKWh: number | null;
  creditosAnterioresKWh: number | null;
  creditosAtuaisKWh: number | null;
  tarifaCheiaRSKWh: number | null;
  tarifaPisoComDescontoRSKWh: number | null;
  valorCIP: number | null;
  valorBandeira: number | null;
  outrosEncargos: number | null;
  nomeTitular?: string | null;
  enderecoInstalacao?: string | null;
  numeroUC?: string | null;
}

export interface ContractParams {
  idContrato: string;
  kcEnergiaContratadaKWh: number;
  descontoPercentual: number;
  incluirCIPNaCobranca: boolean;
  incluirBandeiraNaCobranca: boolean;
  incluirOutrosEncargosNaCobranca: boolean;
}

export interface BillingInput {
  rawInvoice: RawInvoiceData;
  contrato: ContractParams;
}

export interface BillingItem {
  codigo: string;
  descricao: string;
  valor: number;
  incluidoNaCobranca: boolean;
}

export interface BillingMeta {
  uf: string;
  distribuidora: string;
  mesReferencia: string;
  idContrato: string;
  dataCalculoISO: string;
  versaoRegra: string;
}

export interface BillingResult {
  totalAPagarRS: number;
  itens: BillingItem[];
  resumoTextoExplicativo: string;
  meta: BillingMeta;
}
