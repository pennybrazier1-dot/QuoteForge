import { createRequire } from "node:module";
import { parseEstimatedDuration } from "@/lib/proposals/duration";
import { resolveProposalPricePence } from "@/lib/proposals/money";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";
import {
  deriveCustomerThingsToConfirm,
  parseOptionalExtrasSource,
  resolveCustomerOptionalExtras,
  stripCustomerFacingLinePrices,
} from "@/lib/proposals/pdf/customer-next-steps";
import { FONT, registerPdfFonts } from "@/lib/proposals/pdf/fonts";
import { PdfFlow } from "@/lib/proposals/pdf/layout";
import { renderProposalPdfDocument } from "@/lib/proposals/pdf/render";
import type { ProposalPdfData } from "@/lib/proposals/pdf/types";
import { PDF_PAGE } from "@/lib/proposals/pdf/tokens";
import {
  hasStructuredProposal,
  mapDbRowToStructuredProposal,
} from "@/lib/proposals/structured-proposal";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as typeof import("pdfkit");

export type { ProposalPdfData };

function buildProjectSummary(
  hasStructuredContent: boolean,
  jobSummary: string | null,
  siteNotes: string | null
): string {
  if (hasStructuredContent && jobSummary?.trim()) {
    return jobSummary.trim();
  }
  if (siteNotes?.trim()) {
    return siteNotes.trim();
  }
  return "Project details will be confirmed following site review.";
}

function buildDurationNote(
  duration: string,
  thingsToConfirm: string[],
  thingsText: string | null
): string | null {
  const combined = [...thingsToConfirm, thingsText ?? ""].join(" ").toLowerCase();
  if (combined.includes("ground")) {
    return "Depending on ground conditions";
  }
  if (combined.includes("access")) {
    return "Depending on site access";
  }
  if (duration !== "Not specified") {
    return "Depending on ground conditions and weather";
  }
  return null;
}

export function buildProposalPdfData(
  proposal: {
    proposal_number: string;
    created_at: string;
    customer_name: string | null;
    customer_address: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    rough_notes: string | null;
    optional_extras: unknown;
    things_to_confirm: string | null;
    estimated_duration: string | null;
    payment_terms: string | null;
    total_amount: number;
    job_summary?: string | null;
    scope_of_work?: string | null;
    materials?: unknown;
    labour_description?: string | null;
    ai_optional_extras?: unknown;
    things_to_confirm_items?: unknown;
  },
  workspace: {
    business_name: string;
    trade_type: string | null;
    contact_email: string | null;
    phone: string | null;
    default_payment_terms: string;
  }
): ProposalPdfData {
  const structured = mapDbRowToStructuredProposal({
    job_summary: proposal.job_summary ?? null,
    scope_of_work: proposal.scope_of_work ?? null,
    materials: proposal.materials ?? [],
    labour_description: proposal.labour_description ?? null,
    estimated_duration: proposal.estimated_duration ?? null,
    things_to_confirm_items: proposal.things_to_confirm_items ?? [],
    ai_optional_extras: proposal.ai_optional_extras ?? [],
    payment_terms: proposal.payment_terms ?? null,
  });
  const hasStructuredContent = hasStructuredProposal({
    job_summary: proposal.job_summary ?? null,
  });
  const estimatedDuration =
    parseEstimatedDuration(
      proposal.estimated_duration,
      proposal.things_to_confirm
    ) || "Not specified";

  const structuredConfirm = structured?.thingsToConfirm ?? [];
  const rawOptionalItems = hasStructuredContent
    ? (structured?.optionalExtras ?? [])
    : parseOptionalExtrasSource(proposal.optional_extras);
  const rawOptionalExtrasText = rawOptionalItems.join("\n\n");

  const thingsToConfirmBeforeWork = deriveCustomerThingsToConfirm({
    thingsToConfirm: structuredConfirm,
    optionalExtrasText: rawOptionalExtrasText,
  });

  const optionalExtrasItems = resolveCustomerOptionalExtras(rawOptionalItems);

  return {
    businessName: resolveCustomerFacingBusinessName(workspace.business_name),
    tradeType: workspace.trade_type,
    contactEmail: workspace.contact_email,
    phone: workspace.phone,
    website: null,
    proposalNumber: proposal.proposal_number,
    createdAt: proposal.created_at,
    customerName: proposal.customer_name,
    customerAddress: proposal.customer_address,
    customerEmail: proposal.customer_email ?? null,
    customerPhone: proposal.customer_phone ?? null,
    projectSummary: buildProjectSummary(
      hasStructuredContent,
      structured?.jobSummary ?? null,
      proposal.rough_notes
    ),
    scopeOfWork: structured?.scopeOfWork ?? [],
    materials: stripCustomerFacingLinePrices(structured?.materials ?? []),
    labour: structured?.labour ?? proposal.rough_notes,
    thingsToConfirmBeforeWork,
    optionalExtrasItems,
    estimatedPrice: resolveProposalPricePence(
      proposal.total_amount,
      proposal.rough_notes,
      proposal.job_summary,
      proposal.labour_description,
      proposal.things_to_confirm,
      structured?.labour
    ),
    estimatedDuration,
    durationNote: buildDurationNote(
      estimatedDuration,
      thingsToConfirmBeforeWork,
      proposal.things_to_confirm
    ),
    paymentTerms:
      proposal.payment_terms?.trim() || workspace.default_payment_terms,
  };
}

export function generateProposalPdf(data: ProposalPdfData): Promise<Buffer> {
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
        Title: `Proposal ${data.proposalNumber}`,
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
      renderProposalPdfDocument(flow, data);
    } catch (error) {
      reject(error);
      return;
    }

    doc.end();
  });
}
