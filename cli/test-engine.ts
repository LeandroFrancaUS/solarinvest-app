import { calcularFaturaSolarInvest } from "../backend/src/engine/billingEngine.js";
import { BillingInput } from "../backend/src/engine/types.js";

const input: BillingInput = {
  rawInvoice: {
    distribuidora: "EQUATORIAL GO",
    uf: "GO",
    mesReferencia: "2024-01",
    consumoKWh: 2300,
    energiaCompensadaKWh: 200,
    creditosAnterioresKWh: 100,
    creditosAtuaisKWh: 50,
    tarifaCheiaRSKWh: 1.1,
    tarifaPisoComDescontoRSKWh: 0.88,
    valorCIP: 12.5,
    valorBandeira: 0,
    outrosEncargos: 0,
    numeroCliente: null,
    numeroInstalacao: null,
    numeroContaContrato: null,
    nomeTitular: "Cliente Demonstração",
    enderecoInstalacao: "Rua Teste, 123",
    numeroUC: "000111222"
  },
  contrato: {
    idContrato: "CONTRATO-DEMO",
    kcEnergiaContratadaKWh: 2000,
    descontoPercentual: 0.2,
    incluirBandeiraNaCobranca: true,
    incluirCIPNaCobranca: true,
    incluirOutrosEncargosNaCobranca: false
  }
};

const result = calcularFaturaSolarInvest(input);
console.log(JSON.stringify(result, null, 2));
