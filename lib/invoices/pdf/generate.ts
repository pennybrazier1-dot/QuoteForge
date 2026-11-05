import { createRequire } from "node:module";
import { registerPdfFonts, FONT } from "@/lib/proposals/pdf/fonts";
import { PdfFlow } from "@/lib/proposals/pdf/layout";
import { PDF_PAGE } from "@/lib/proposals/pdf/tokens";
import { renderInvoicePdfDocument } from "@/lib/invoices/pdf/render";
import type { InvoicePdfData } from "@/lib/invoices/pdf/types";

// pdfkit is CommonJS — match proposal PDF generation.
const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as typeof import("pdfkit");

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PDF_PAGE.size,
      margins: {
        top: PDF_PAGE.margin,
        bottom: PDF_PAGE.margin,
        left: PDF_PAGE.margin,
        right: PDF_PAGE.margin,
      },
      bufferPages: true,
      info: {
        Title: `Invoice ${data.invoiceNumber}`,
        Author: data.businessName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      registerPdfFonts(doc);
      doc.font(FONT.sans);
      const flow = new PdfFlow(doc);
      renderInvoicePdfDocument(flow, data);
    } catch (error) {
      reject(error);
      return;
    }

    doc.end();
  });
}

export function invoicePdfFileName(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^a-zA-Z0-9-_]+/g, "-") || "invoice";
  return `${safe}.pdf`;
}
