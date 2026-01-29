import { create } from "zustand";
import { BillingResult, ContractParams, RawInvoiceData } from "../types";

interface InvoiceState {
  rawInvoice: RawInvoiceData | null;
  contractParams: ContractParams | null;
  billingResult: BillingResult | null;
  setRawInvoice: (raw: RawInvoiceData | null) => void;
  setContractParams: (params: ContractParams | null) => void;
  setBillingResult: (result: BillingResult | null) => void;
  resetAll: () => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  rawInvoice: null,
  contractParams: null,
  billingResult: null,
  setRawInvoice: (raw) => set({ rawInvoice: raw }),
  setContractParams: (params) => set({ contractParams: params }),
  setBillingResult: (result) => set({ billingResult: result }),
  resetAll: () => set({ rawInvoice: null, contractParams: null, billingResult: null })
}));
