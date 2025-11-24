import axios from "axios";
import { BillingResult, ContractParams, RawInvoiceData } from "../types";

const http = axios.create({ baseURL: "http://localhost:3001/api" });

export async function uploadInvoice(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await http.post<{ rawInvoice: RawInvoiceData; ocrPreview: string }>("/invoices/upload", form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
}

export async function calculateInvoice(rawInvoice: RawInvoiceData, contract: ContractParams) {
  const { data } = await http.post<BillingResult>("/invoices/calculate", { rawInvoice, contrato: contract });
  return data;
}

export async function generateBillPdf(billingResult: BillingResult) {
  const { data } = await http.post("/invoices/generate-bill-pdf", { billingResult }, { responseType: "blob" });
  return data as Blob;
}
