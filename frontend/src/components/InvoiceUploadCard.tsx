import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadInvoice } from "../api/client";
import { useInvoiceStore } from "../store/invoiceStore";

export default function InvoiceUploadCard() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setRawInvoice = useInvoiceStore((s) => s.setRawInvoice);
  const navigate = useNavigate();

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const data = await uploadInvoice(file);
      setRawInvoice(data.rawInvoice);
      navigate("/extract");
    } catch (err) {
      setError((err as Error).message || "Falha ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    handleFile(e.target.files[0]);
  };

  return (
    <div className="card">
      <h2>Upload de fatura</h2>
      <p style={{ color: "var(--text-secondary)" }}>
        Envie um arquivo PDF, JPG ou PNG. O texto será processado pelo OCR configurado.
      </p>
      <div
        style={{
          border: "2px dashed var(--border)",
          borderRadius: 12,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-start"
        }}
      >
        <input type="file" accept="application/pdf,image/*" onChange={onChange} disabled={uploading} />
        <button className="button" onClick={() => document.querySelector<HTMLInputElement>("input[type=file]")?.click()} disabled={uploading}>
          {uploading ? "Processando..." : "Selecionar arquivo"}
        </button>
        {error && <span style={{ color: "red" }}>{error}</span>}
      </div>
    </div>
  );
}
