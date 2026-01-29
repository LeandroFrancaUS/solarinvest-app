import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { BillingResult, RawInvoiceData } from "../engine/types.js";
import { formatBrNumber } from "../utils/brNumber.js";

export async function gerarFaturaPdf(
  billingResult: BillingResult,
  rawInvoice?: RawInvoiceData
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.08, 0.12, 0.18) });
  page.drawText("SolarInvest", { x: 32, y: height - 40, size: 22, font: fontBold, color: rgb(1, 1, 1) });

  page.drawText("Fatura SolarInvest", { x: 32, y: height - 110, size: 18, font: fontBold });
  page.drawText(`Contrato: ${billingResult.meta.idContrato}`, { x: 32, y: height - 130, size: 12, font });
  page.drawText(`Referência: ${billingResult.meta.mesReferencia}`, { x: 32, y: height - 145, size: 12, font });
  page.drawText(`Distribuidora: ${billingResult.meta.distribuidora}`, { x: 32, y: height - 160, size: 12, font });

  if (rawInvoice?.nomeTitular) {
    page.drawText(`Titular: ${rawInvoice.nomeTitular}`, { x: 32, y: height - 175, size: 12, font });
  }

  page.drawText("Resumo do cálculo", { x: 32, y: height - 200, size: 14, font: fontBold });
  page.drawText(billingResult.resumoTextoExplicativo, { x: 32, y: height - 220, size: 11, font, maxWidth: width - 64, lineHeight: 14 });

  const startY = height - 260;
  page.drawText("Itens", { x: 32, y: startY, size: 12, font: fontBold });
  let currentY = startY - 18;
  billingResult.itens.forEach((item) => {
    page.drawText(`${item.codigo} - ${item.descricao}`, { x: 32, y: currentY, size: 11, font });
    page.drawText(`R$ ${formatBrNumber(item.valor)}`, { x: width - 120, y: currentY, size: 11, font });
    currentY -= 16;
  });

  page.drawRectangle({
    x: 32,
    y: currentY - 24,
    width: width - 64,
    height: 40,
    color: rgb(0.92, 0.96, 1)
  });
  page.drawText("Total a pagar", { x: 42, y: currentY - 4, size: 12, font: fontBold });
  page.drawText(`R$ ${formatBrNumber(billingResult.totalAPagarRS)}`, { x: width - 140, y: currentY - 4, size: 12, font: fontBold });

  const qrPlaceholder = await QRCode.toDataURL("https://solarinvest.local/pagamento");
  const qrImage = qrPlaceholder.split(",")[1];
  if (qrImage) {
    const pngBytes = Buffer.from(qrImage, "base64");
    const png = await pdfDoc.embedPng(pngBytes);
    const pngDims = png.scale(0.5);
    page.drawImage(png, { x: width - 180, y: 60, width: pngDims.width, height: pngDims.height });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
