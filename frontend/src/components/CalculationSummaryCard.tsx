import { BillingResult } from "../types";

export default function CalculationSummaryCard({ result }: { result: BillingResult }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Resumo do cálculo</h3>
      <p style={{ color: "var(--text-secondary)" }}>{result.resumoTextoExplicativo}</p>
      <table className="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descrição</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {result.itens.map((item) => (
            <tr key={item.codigo}>
              <td>{item.codigo}</td>
              <td>{item.descricao}</td>
              <td>R$ {item.valor.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, fontWeight: 700 }}>Total: R$ {result.totalAPagarRS.toFixed(2)}</div>
    </div>
  );
}
