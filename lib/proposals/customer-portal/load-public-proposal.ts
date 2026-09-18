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
import { isConversationReplyable } from "@/lib/proposals/customer-portal/conversation-access";
import {
  isClosedProposalStatus,
  isFullyClosedJobStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";
import {
  buildCustomerPortalPaymentView,
  readJobPaymentState,
} from "@/lib/payments/job-payment";
import type { CustomerPortalPaymentView } from "@/lib/payments/types";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";
import { canShowFinalAccept } from "@/lib/proposals/acceptance-rules";
import {
  expireAbandonedTempHold,
  loadPublicAvailabilityForProposal,
} from "@/lib/proposals/customer-availability-load";
import { parseBookingWindow } from "@/lib/proposals/booking-window";
import type { PublicAvailabilitySlot } from "@/lib/proposals/customer-availability";
import {
  scheduleModeForDuration,
  splitPublicAvailability,
} from "@/lib/proposals/customer-availability";
import { readDateSlotState } from "@/lib/proposals/date-workflow";
import {
  formatPortalIssuedLabel,
  formatPortalWorkDate,
  formatPortalWorkTime,
} from "@/lib/proposals/customer-portal/portal-page-layout";
import { formatSlotLabel } from "@/lib/proposals/revision/conversation-agreements";

export type PublicProposalViewModel = {
  token: string;
  proposalId: string;
  proposalNumber: string;
  title: string;
  status: string;
  canRespond: boolean;
  /** Messaging stays open after accept/book. Separate from proposal actions. */
  canMessage: boolean;
  isAccepted: boolean;
  isDeclined: boolean;
  isClosed: boolean;
  isJobClosed: boolean;
  payment: CustomerPortalPaymentView | null;
  /** Trader proposed a provisional date; customer must accept or request another. */
  canRespondToProposedDate: boolean;
  proposedDateLabel: string | null;
  /** Final Accept is only shown when an exact work slot is already set. */
  canAcceptProposal: boolean;
  needsDateChoice: boolean;
  scheduleMode: "range" | "appointment" | null;
  availabilitySlots: PublicAvailabilitySlot[];
  moreAvailabilitySlots: PublicAvailabilitySlot[];
  hasMoreAvailability: boolean;
  availabilityEmpty: boolean;
  selectedSlotLabel: string | null;
  dateOfferSource: "proposal" | "trader" | "customer_selected" | null;
  businessName: string;
  businessLogoUrl: string | null;
  paymentTerms: string | null;
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
  plannedDateLabel: string | null;
  plannedTimeLabel: string | null;
  issuedLabel: string | null;
  jobImageUrl: string | null;
};

type PortalProposalRow = ProposalPdfSource & {
  workspace_id: string;
  title: string | null;
  accepted_at: string | null;
  customer_id: string | null;
  job_address: string | null;
  booking_confirmation?: string | null;
  planned_start_time?: string | null;
  booking_window?: unknown;
  payment_status?: string | null;
  payment_due_amount?: number | null;
  payment_methods_issued?: unknown;
  paid_at?: string | null;
  payment_method?: string | null;
  closed_at?: string | null;
  issued_bank_account_name?: string | null;
  issued_bank_sort_code?: string | null;
  issued_bank_account_number?: string | null;
  issued_bank_reference?: string | null;
  issued_payment_url?: string | null;
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
      `${PROPOSAL_PDF_SELECT}, workspace_id, title, accepted_at, job_address, booking_confirmation, planned_start_time, booking_window, payment_status, payment_due_amount, payment_methods_issued, paid_at, payment_method, closed_at, issued_bank_account_name, issued_bank_sort_code, issued_bank_account_number, issued_bank_reference, issued_payment_url`
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
  const isAccepted =
    status === "booked" ||
    status === "completed" ||
    status === "invoiced" ||
    status === "paid" ||
    status === "closed";
  const isDeclined = status === "declined";
  const isClosed = isClosedProposalStatus(status);
  const isJobClosed = isFullyClosedJobStatus(status);
  const paymentState = readJobPaymentState(row);
  const payment =
    paymentState.payment_status === "not_requested"
      ? null
      : buildCustomerPortalPaymentView({
          jobTitle: row.title?.trim() || `Proposal ${row.proposal_number}`,
          jobStatus: status,
          payment: paymentState,
          bank:
            paymentState.payment_status === "requested" &&
            row.issued_bank_account_name &&
            row.issued_bank_sort_code &&
            row.issued_bank_account_number
              ? {
                  accountName: row.issued_bank_account_name,
                  sortCode: row.issued_bank_sort_code,
                  accountNumber: row.issued_bank_account_number,
                  reference: row.issued_bank_reference ?? null,
                }
              : null,
          cardUrl:
            paymentState.payment_status === "requested"
              ? row.issued_payment_url ?? null
              : null,
        });

  if (canRespond && !isClosed) {
    const expired = await expireAbandonedTempHold(supabase, {
      id: row.id,
      workspace_id: row.workspace_id,
      status: row.status,
      accepted_at: row.accepted_at,
      booking_confirmation: row.booking_confirmation,
      planned_start_date: row.planned_start_date,
    });
    if (expired) {
      row.booking_confirmation = null;
      row.planned_start_date = null;
      row.planned_start_date_text = null;
      row.planned_start_time = null;
    }
  }

  const dateState = readDateSlotState(
    row.booking_confirmation,
    row.planned_start_date
  );
  const plannedStartLabel =
    formatSlotLabel({
      dateIso: row.planned_start_date,
      dateText: row.planned_start_date_text,
      timeHm: row.planned_start_time,
    }) ||
    row.planned_start_date_text?.trim() ||
    (row.planned_start_date
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
          new Date(row.planned_start_date)
        )
      : null);
  const canRespondToProposedDate =
    !isClosed &&
    dateState === "provisional" &&
    Boolean(plannedStartLabel);
  const canAcceptProposal = canShowFinalAccept({
    canRespond: canRespond && !isClosed,
    plannedStartDate: row.planned_start_date,
    plannedStartTime: row.planned_start_time,
    estimatedDuration: row.estimated_duration,
  });
  const needsDateChoice = canRespond && !isClosed && !canAcceptProposal;
  const scheduleMode = needsDateChoice
    ? scheduleModeForDuration(row.estimated_duration)
    : null;

  const allAvailabilitySlots = needsDateChoice
    ? await loadPublicAvailabilityForProposal(supabase, {
        workspaceId: row.workspace_id,
        proposalId: row.id,
        estimatedDuration: row.estimated_duration,
        bookingWindow: parseBookingWindow(row.booking_window),
      })
    : [];
  const splitSlots = splitPublicAvailability(allAvailabilitySlots);
  const availabilitySlots = splitSlots.visible;
  const moreAvailabilitySlots = splitSlots.more;

  const dateOfferSource = canAcceptProposal
    ? dateState === "provisional"
      ? "trader"
      : "proposal"
    : null;

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
      canMessage: isConversationReplyable(status),
      isAccepted,
      isDeclined,
      isClosed,
      isJobClosed,
      payment,
      canRespondToProposedDate,
      proposedDateLabel: canRespondToProposedDate ? plannedStartLabel : null,
      canAcceptProposal,
      needsDateChoice,
      scheduleMode,
      availabilitySlots,
      moreAvailabilitySlots,
      hasMoreAvailability: splitSlots.hasMore,
      availabilityEmpty: needsDateChoice && allAvailabilitySlots.length === 0,
      selectedSlotLabel: canAcceptProposal ? plannedStartLabel : null,
      dateOfferSource,
      businessName: resolveCustomerFacingBusinessName(workspaceRow.business_name),
      businessLogoUrl: null,
      paymentTerms: pdfData.paymentTerms?.trim() || null,
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
      plannedDateLabel: formatPortalWorkDate(
        row.planned_start_date,
        row.planned_start_date_text
      ),
      plannedTimeLabel: formatPortalWorkTime(row.planned_start_time),
      issuedLabel: formatPortalIssuedLabel(row.created_at),
      jobImageUrl: null,
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
