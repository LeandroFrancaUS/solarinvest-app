import { BillingResult } from "../types";

interface Props {
  result: BillingResult;
  onDownload: () => void;
}

export default function SolarInvestBillPreview({ result, onDownload }: Props) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Fatura SolarInvest</h2>
        <button className="button" onClick={onDownload}>
          Baixar PDF
        </button>
      </div>
      <p style={{ color: "var(--text-secondary)" }}>Contrato {result.meta.idContrato}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Info label="Referência" value={result.meta.mesReferencia} />
        <Info label="Distribuidora" value={result.meta.distribuidora} />
        <Info label="UF" value={result.meta.uf} />
        <Info label="Total" value={`R$ ${result.totalAPagarRS.toFixed(2)}`} />
      </div>
      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Código</th>
            <th>Descrição</th>
            <th>Incluído</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {result.itens.map((item) => (
            <tr key={item.codigo}>
              <td>{item.codigo}</td>
              <td>{item.descricao}</td>
              <td>{item.incluidoNaCobranca ? "Sim" : "Não"}</td>
              <td>R$ {item.valor.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12 }}>{label}</p>
      <p style={{ margin: "4px 0", fontWeight: 700 }}>{value}</p>
    </div>
  );
}
