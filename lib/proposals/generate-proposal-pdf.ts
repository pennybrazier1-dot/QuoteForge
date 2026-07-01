import { createRequire } from "node:module";
import { parseEstimatedDuration } from "@/lib/proposals/duration";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { formatOptionalExtrasForDisplay } from "@/lib/proposals/optional-extras";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as typeof import("pdfkit");

export type ProposalPdfData = {
  businessName: string;
  proposalNumber: string;
  createdAt: string;
  customerName: string | null;
  customerAddress: string | null;
  siteNotes: string | null;
  optionalExtras: unknown;
  estimatedPrice: number;
  estimatedDuration: string | null;
  paymentTerms: string;
};

const ACCENT = "#FF6A1A";
const TEXT = "#1A1A1A";
const MUTED = "#666666";

function formatCreatedDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date(value));
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(TEXT)
    .text(title.toUpperCase(), { characterSpacing: 0.5 });
  doc
    .moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor(ACCENT)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.6);
}

function drawBodyText(doc: PDFKit.PDFDocument, text: string) {
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(TEXT)
    .text(text, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: 3,
    });
}

function drawMutedText(doc: PDFKit.PDFDocument, text: string) {
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text(text, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: 2,
    });
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string | null | undefined
) {
  if (!value?.trim()) {
    return;
  }

  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(label);
  doc.moveDown(0.15);
  drawBodyText(doc, value);
  doc.moveDown(0.4);
}

function ensureSpace(doc: PDFKit.PDFDocument, height = 120) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
}

export function generateProposalPdf(data: ProposalPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Proposal ${data.proposalNumber}`,
        Author: data.businessName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const optionalExtras =
      formatOptionalExtrasForDisplay(data.optionalExtras) ??
      "No optional extras included.";
    const duration =
      data.estimatedDuration?.trim() || "Not specified";

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(TEXT)
      .text(data.businessName);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(MUTED)
      .text("Proposal prepared with QuoteForge");
    doc.moveDown(0.3);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor(ACCENT)
      .lineWidth(2)
      .stroke();
    doc.moveDown(0.8);

    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT).text("Proposal");
    doc.moveDown(0.2);
    drawLabelValue(doc, "Proposal number", data.proposalNumber);
    drawLabelValue(doc, "Date created", formatCreatedDate(data.createdAt));

    drawSectionTitle(doc, "Customer");
    drawLabelValue(doc, "Name", data.customerName ?? "Not specified");
    drawLabelValue(
      doc,
      "Address",
      data.customerAddress ?? "Not specified"
    );

    drawSectionTitle(doc, "Site Notes");
    drawBodyText(doc, data.siteNotes?.trim() || "No site notes recorded.");

    drawSectionTitle(doc, "Optional Extras");
    drawBodyText(doc, optionalExtras);
    drawMutedText(
      doc,
      "Optional extras are separate from the main quote and are not included in the total unless accepted."
    );

    drawSectionTitle(doc, "Estimate");
    drawLabelValue(doc, "Estimated price", formatPenceAsGbp(data.estimatedPrice));
    drawLabelValue(doc, "Estimated duration", duration);

    drawSectionTitle(doc, "Payment Terms");
    drawBodyText(doc, data.paymentTerms);

    ensureSpace(doc, 180);
    drawSectionTitle(doc, "Acceptance");
    drawBodyText(
      doc,
      "By signing below, the customer accepts this proposal and agrees to the work, price, and payment terms described above. Acceptance may also be given through QuoteForge or by another method agreed with the tradesperson."
    );

    ensureSpace(doc, 120);
    doc.moveDown(1);
    const signatureWidth =
      (doc.page.width - doc.page.margins.left - doc.page.margins.right - 30) /
      2;
    const leftX = doc.page.margins.left;
    const rightX = leftX + signatureWidth + 30;
    const signatureY = doc.y;

    doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT);
    doc.text("Customer", leftX, signatureY, { width: signatureWidth });
    doc.text("Tradesperson", rightX, signatureY, { width: signatureWidth });

    const lineY = signatureY + 36;
    doc
      .moveTo(leftX, lineY)
      .lineTo(leftX + signatureWidth, lineY)
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .stroke();
    doc
      .moveTo(rightX, lineY)
      .lineTo(rightX + signatureWidth, lineY)
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .stroke();

    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text("Signature", leftX, lineY + 6, { width: signatureWidth });
    doc.text("Signature", rightX, lineY + 6, { width: signatureWidth });
    doc.text("Date", leftX, lineY + 22, { width: signatureWidth });
    doc.text("Date", rightX, lineY + 22, { width: signatureWidth });

    const footerY = doc.page.height - doc.page.margins.bottom - 20;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `${data.proposalNumber} · ${data.businessName} · QuoteForge`,
        doc.page.margins.left,
        footerY,
        {
          width:
            doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: "center",
        }
      );

    doc.end();
  });
}

export function buildProposalPdfData(proposal: {
  proposal_number: string;
  created_at: string;
  customer_name: string | null;
  customer_address: string | null;
  rough_notes: string | null;
  optional_extras: unknown;
  things_to_confirm: string | null;
  estimated_duration: string | null;
  payment_terms: string | null;
  total_amount: number;
}, workspace: {
  business_name: string;
  default_payment_terms: string;
}): ProposalPdfData {
  return {
    businessName: workspace.business_name,
    proposalNumber: proposal.proposal_number,
    createdAt: proposal.created_at,
    customerName: proposal.customer_name,
    customerAddress: proposal.customer_address,
    siteNotes: proposal.rough_notes,
    optionalExtras: proposal.optional_extras,
    estimatedPrice: proposal.total_amount,
    estimatedDuration: parseEstimatedDuration(
      proposal.estimated_duration,
      proposal.things_to_confirm
    ),
    paymentTerms:
      proposal.payment_terms?.trim() || workspace.default_payment_terms,
  };
}
