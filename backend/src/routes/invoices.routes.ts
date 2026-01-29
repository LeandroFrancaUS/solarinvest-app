import { Router } from "express";
import multer from "multer";
import { calcularFaturaSolarInvest } from "../engine/billingEngine.js";
import { ContractParams, RawInvoiceData } from "../engine/types.js";
import { runExternalOcr } from "../ocr/externalOcrClient.js";
import { parseEnergyInvoice } from "../parser/energyInvoiceParser.js";
import { gerarFaturaPdf } from "../pdf/solarinvestBillPdf.js";

const upload = multer({ storage: multer.memoryStorage() });
export const invoicesRouter = Router();

invoicesRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Arquivo não enviado" });
  }

  const { buffer, originalname, mimetype } = req.file;
  if (!/(pdf|png|jpg|jpeg)$/i.test(originalname)) {
    return res.status(400).json({ message: "Formato de arquivo não suportado" });
  }

  try {
    const ocrText = await runExternalOcr(buffer, originalname, mimetype);
    const rawInvoice = parseEnergyInvoice(ocrText);
    const preview = ocrText.substring(0, 280);
    res.json({ rawInvoice, ocrPreview: preview });
  } catch (error) {
    res.status(500).json({ message: "Falha ao processar OCR", error: (error as Error).message });
  }
});

invoicesRouter.post("/calculate", (req, res) => {
  const { rawInvoice, contrato } = req.body as { rawInvoice: RawInvoiceData; contrato: ContractParams };
  if (!rawInvoice || !contrato) {
    return res.status(400).json({ message: "Payload inválido" });
  }

  try {
    const result = calcularFaturaSolarInvest({ rawInvoice, contrato });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

invoicesRouter.post("/generate-bill-pdf", async (req, res) => {
  const { billingResult, rawInvoice } = req.body as { billingResult: any; rawInvoice?: RawInvoiceData };
  if (!billingResult) {
    return res.status(400).json({ message: "Resultado de cobrança não informado" });
  }

  try {
    const pdfBuffer = await gerarFaturaPdf(billingResult, rawInvoice);
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: "Erro ao gerar PDF", error: (error as Error).message });
  }
});
