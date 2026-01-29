export default function DashboardHome() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
      <div className="card">
        <h3>Faturas processadas hoje</h3>
        <p style={{ fontSize: 32, margin: "8px 0" }}>12</p>
        <p style={{ color: "var(--text-secondary)" }}>Processamento local em modo demo.</p>
      </div>
      <div className="card">
        <h3>Último cálculo</h3>
        <p style={{ fontSize: 16, margin: "8px 0" }}>Contrato DEMO - jan/2024</p>
        <p style={{ color: "var(--text-secondary)" }}>Valor calculado R$ 1.250,00</p>
      </div>
      <div className="card">
        <h3>Atalhos</h3>
        <p style={{ color: "var(--text-secondary)" }}>Envie uma nova fatura ou visualize a última cobrança.</p>
      </div>
    </div>
  );
}
