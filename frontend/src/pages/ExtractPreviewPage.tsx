import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ExtractedDataPanel from "../components/ExtractedDataPanel";
import { useInvoiceStore } from "../store/invoiceStore";

export default function ExtractPreviewPage() {
  const rawInvoice = useInvoiceStore((s) => s.rawInvoice);
  const navigate = useNavigate();

  useEffect(() => {
    if (!rawInvoice) navigate("/upload");
  }, [rawInvoice, navigate]);

  if (!rawInvoice) return null;

  return (
    <div>
      <h1>Dados extraídos</h1>
      <p style={{ color: "var(--text-secondary)" }}>Revise os campos identificados automaticamente.</p>
      <ExtractedDataPanel rawInvoice={rawInvoice} />
      <button className="button" style={{ marginTop: 16 }} onClick={() => navigate("/interpret")}>Continuar</button>
    </div>
  );
}
