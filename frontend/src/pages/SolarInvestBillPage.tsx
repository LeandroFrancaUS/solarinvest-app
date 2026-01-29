import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateBillPdf } from "../api/client";
import SolarInvestBillPreview from "../components/SolarInvestBillPreview";
import { useInvoiceStore } from "../store/invoiceStore";

export default function SolarInvestBillPage() {
  const billingResult = useInvoiceStore((s) => s.billingResult);
  const navigate = useNavigate();

  useEffect(() => {
    if (!billingResult) navigate("/interpret");
  }, [billingResult, navigate]);

  if (!billingResult) return null;

  const download = async () => {
    const blob = await generateBillPdf(billingResult);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fatura-solarinvest.pdf";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SolarInvestBillPreview result={billingResult} onDownload={download} />
    </div>
  );
}
