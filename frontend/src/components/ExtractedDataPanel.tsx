import { RawInvoiceData } from "../types";

export default function ExtractedDataPanel({ rawInvoice }: { rawInvoice: RawInvoiceData }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Dados extraídos</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Info label="Distribuidora" value={rawInvoice.distribuidora || "N/D"} />
        <Info label="UF" value={rawInvoice.uf || "N/D"} />
        <Info label="Referência" value={rawInvoice.mesReferencia || "N/D"} />
        <Info label="Consumo (kWh)" value={rawInvoice.consumoKWh ?? "-"} />
        <Info label="Créditos" value={rawInvoice.creditosAtuaisKWh ?? "-"} />
        <Info label="Tarifa Cheia" value={rawInvoice.tarifaCheiaRSKWh ?? "-"} />
      </div>
      <pre style={{ background: "#0f172a", color: "#e5e7eb", padding: 12, borderRadius: 10, overflowX: "auto" }}>
        {JSON.stringify(rawInvoice, null, 2)}
      </pre>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12 }}>{label}</p>
      <p style={{ margin: "4px 0", fontWeight: 700 }}>{value}</p>
    </div>
  );
}
