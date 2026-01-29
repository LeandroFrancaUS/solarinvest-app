import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { calculateInvoice } from "../api/client";
import CalculationSummaryCard from "../components/CalculationSummaryCard";
import { useInvoiceStore } from "../store/invoiceStore";
import { BillingResult, ContractParams } from "../types";

const defaultContract: ContractParams = {
  idContrato: "CONTRATO-DEMO",
  kcEnergiaContratadaKWh: 2000,
  descontoPercentual: 0.2,
  incluirBandeiraNaCobranca: true,
  incluirCIPNaCobranca: true,
  incluirOutrosEncargosNaCobranca: false
};

export default function InterpretationPage() {
  const rawInvoice = useInvoiceStore((s) => s.rawInvoice);
  const setContractParams = useInvoiceStore((s) => s.setContractParams);
  const setBillingResult = useInvoiceStore((s) => s.setBillingResult);
  const billingResult = useInvoiceStore((s) => s.billingResult);
  const [contract, setContract] = useState<ContractParams>(defaultContract);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!rawInvoice) navigate("/upload");
  }, [rawInvoice, navigate]);

  if (!rawInvoice) return null;

  const onChange = (key: keyof ContractParams, value: string | boolean) => {
    setContract((prev) => ({ ...prev, [key]: typeof value === "string" ? Number(value) || value : value } as ContractParams));
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      const result = await calculateInvoice(rawInvoice, contract);
      setContractParams(contract);
      setBillingResult(result as BillingResult);
      navigate("/bill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Interpretação & cálculo</h1>
      <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <Field label="ID do contrato" value={contract.idContrato} onChange={(v) => onChange("idContrato", v)} />
        <Field
          label="Energia contratada (Kc)"
          type="number"
          value={contract.kcEnergiaContratadaKWh}
          onChange={(v) => onChange("kcEnergiaContratadaKWh", v)}
        />
        <Field
          label="Desconto (%)"
          type="number"
          value={contract.descontoPercentual * 100}
          onChange={(v) => onChange("descontoPercentual", Number(v) / 100)}
        />
        <Toggle label="Incluir CIP" value={contract.incluirCIPNaCobranca} onChange={(v) => onChange("incluirCIPNaCobranca", v)} />
        <Toggle label="Incluir bandeira" value={contract.incluirBandeiraNaCobranca} onChange={(v) => onChange("incluirBandeiraNaCobranca", v)} />
        <Toggle label="Incluir outros encargos" value={contract.incluirOutrosEncargosNaCobranca} onChange={(v) => onChange("incluirOutrosEncargosNaCobranca", v)} />
      </div>
      <button className="button" style={{ marginTop: 16 }} onClick={onSubmit} disabled={loading}>
        {loading ? "Calculando..." : "Calcular Fatura SolarInvest"}
      </button>
      {billingResult && <CalculationSummaryCard result={billingResult} />}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
