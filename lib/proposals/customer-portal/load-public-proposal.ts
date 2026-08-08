import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildProposalPdfData,
  generateProposalPdf,
} from "@/lib/proposals/generate-proposal-pdf";
import {
  PROPOSAL_PDF_SELECT,
  WORKSPACE_PDF_SELECT,
} from "@/lib/proposals/proposal-pdf-select";
import type {
  ProposalPdfSource,
  WorkspacePdfSource,
} from "@/lib/proposals/load-proposal-pdf";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";

export type PublicProposalViewModel = {
  token: string;
  proposalId: string;
  proposalNumber: string;
  title: string;
  status: string;
  canRespond: boolean;
  isAccepted: boolean;
  isClosed: boolean;
  /** Trader proposed a provisional date; customer must accept or request another. */
  canRespondToProposedDate: boolean;
  proposedDateLabel: string | null;
  businessName: string;
  tradeType: string | null;
  contactEmail: string | null;
  phone: string | null;
  customerName: string | null;
  customerAddress: string | null;
  priceLabel: string;
  projectSummary: string;
  scopeOfWork: string[];
  materials: string[];
  beforeWorkBegins: string[];
  optionalExtras: string[];
  estimatedDuration: string | null;
  plannedStartLabel: string | null;
};

type PortalProposalRow = ProposalPdfSource & {
  workspace_id: string;
  title: string | null;
  accepted_at: string | null;
  customer_id: string | null;
  job_address: string | null;
  booking_confirmation?: string | null;
  planned_start_time?: string | null;
};

function createPortalClient() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

export async function loadPublicProposalByToken(
  token: string
): Promise<
  | {
      ok: true;
      view: PublicProposalViewModel;
      proposal: PortalProposalRow;
      workspace: WorkspacePdfSource;
      workspaceId: string;
    }
  | { ok: false; error: string }
> {
  const trimmed = token.trim();
  if (trimmed.length < 16) {
    return { ok: false, error: "This proposal link is not valid." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return {
      ok: false,
      error: "The proposal portal is not configured yet. Please try again later.",
    };
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select(
      `${PROPOSAL_PDF_SELECT}, workspace_id, title, accepted_at, customer_id, job_address, booking_confirmation, planned_start_time`
    )
    .eq("customer_access_token", trimmed)
    .maybeSingle();

  if (proposalError || !proposal) {
    return { ok: false, error: "This proposal link is not valid or has expired." };
  }

  const row = proposal as PortalProposalRow;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select(WORKSPACE_PDF_SELECT)
    .eq("id", row.workspace_id)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { ok: false, error: "This proposal is unavailable." };
  }

  const workspaceRow = workspace as WorkspacePdfSource;
  const pdfData = buildProposalPdfData(row, workspaceRow);
  const status = normalizeProposalStatus(row.status);
  const canRespond =
    status === "waiting_for_customer" || status === "needs_attention";
  const isAccepted = status === "booked" || status === "completed";
  const isClosed = status === "cancelled";

  const plannedStartLabel =
    row.planned_start_date_text?.trim() ||
    (row.planned_start_date
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
          new Date(row.planned_start_date)
        )
      : null);
  const canRespondToProposedDate =
    canRespond &&
    !isClosed &&
    row.booking_confirmation === "provisional" &&
    Boolean(plannedStartLabel);

  return {
    ok: true,
    proposal: row,
    workspace: workspaceRow,
    workspaceId: row.workspace_id,
    view: {
      token: trimmed,
      proposalId: row.id,
      proposalNumber: row.proposal_number,
      title: row.title?.trim() || `Proposal ${row.proposal_number}`,
      status,
      canRespond: canRespond && !isClosed,
      isAccepted,
      isClosed,
      canRespondToProposedDate,
      proposedDateLabel: canRespondToProposedDate ? plannedStartLabel : null,
      businessName: resolveCustomerFacingBusinessName(workspaceRow.business_name),
      tradeType: workspaceRow.trade_type,
      contactEmail: workspaceRow.contact_email,
      phone: workspaceRow.phone,
      customerName: row.customer_name,
      customerAddress: row.customer_address,
      priceLabel: formatPenceAsGbp(pdfData.estimatedPrice),
      projectSummary: pdfData.projectSummary,
      scopeOfWork: pdfData.scopeOfWork,
      materials: pdfData.materials,
      beforeWorkBegins: pdfData.thingsToConfirmBeforeWork,
      optionalExtras: pdfData.optionalExtrasItems,
      estimatedDuration:
        pdfData.estimatedDuration !== "Not specified"
          ? pdfData.estimatedDuration
          : null,
      plannedStartLabel,
    },
  };
}

export async function generatePublicProposalPdfBuffer(
  token: string
): Promise<
  { ok: true; buffer: Buffer; fileName: string } | { ok: false; error: string }
> {
  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  try {
    const buffer = await generateProposalPdf(
      buildProposalPdfData(loaded.proposal, loaded.workspace)
    );
    return {
      ok: true,
      buffer,
      fileName: `${loaded.view.proposalNumber.replace(/\s+/g, "-")}.pdf`,
    };
  } catch (error) {
    console.error("Public proposal PDF failed:", error);
    return { ok: false, error: "Could not generate the PDF." };
  }
}

/** Record a viewed event at most once per hour. */
export async function recordPublicProposalViewed(token: string): Promise<void> {
  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return;
  }

  const status = normalizeProposalStatus(loaded.proposal.status);
  if (status !== "waiting_for_customer" && status !== "needs_attention") {
    return;
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return;
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("proposal_status_events")
    .select("id")
    .eq("proposal_id", loaded.proposal.id)
    .eq("event_type", "viewed")
    .gte("created_at", oneHourAgo)
    .limit(1);

  if (recent && recent.length > 0) {
    return;
  }

  await supabase.from("proposal_status_events").insert({
    workspace_id: loaded.workspaceId,
    proposal_id: loaded.proposal.id,
    event_type: "viewed",
    from_status: status,
    to_status: status,
    note: "Customer viewed the proposal",
    metadata: { source: "customer_portal" },
    created_by: null,
  });
}
