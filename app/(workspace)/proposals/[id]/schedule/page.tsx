import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ScheduleWorkspace } from "@/components/proposals/schedule-workspace";
import { fetchCalendarProposals } from "@/lib/calendar/calendar-queries";
import {
  isBookingConfirmation,
  type BookingConfirmation,
} from "@/lib/proposals/booking";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import { getProposalSummaryLabel } from "@/lib/proposals/display";
import { findLatestConfirmedDateAgreement } from "@/lib/proposals/revision/conversation-agreements";
import { normalizePlannedStartTime } from "@/lib/proposals/schedule/schedule-fields";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Schedule job",
  description: "Schedule accepted work on the job calendar.",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    suggestedDate?: string;
    suggestedDateExact?: string;
    suggestedTime?: string;
    mode?: string;
  }>;
};

export default async function ProposalSchedulePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: proposal, error }, calendarProposals] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, proposal_number, title, customer_name, job_summary, rough_notes, estimated_duration, planned_start_date, planned_start_date_text, planned_start_time, booking_confirmation, status"
      )
      .eq("id", id)
      .maybeSingle(),
    fetchCalendarProposals(supabase),
  ]);

  if (error || !proposal) {
    notFound();
  }

  const row = proposal as typeof proposal & {
    planned_start_time?: string | null;
  };

  const bookingConfirmation = isBookingConfirmation(row.booking_confirmation)
    ? (row.booking_confirmation as BookingConfirmation)
    : null;
  const status = normalizeProposalStatus(row.status);
  const holdMode = query.mode === "hold";
  const canHold =
    holdMode &&
    (status === "waiting_for_customer" || status === "needs_attention");

  // A job date is operational scheduling, not a proposal discussion.
  // Before acceptance, only a calendar hold is allowed.
  if (status !== "booked" && !canHold) {
    redirect(`/proposals/${row.id}#customer-replies`);
  }

  const messages = await loadProposalCustomerMessages(supabase, row.id);
  const agreement = findLatestConfirmedDateAgreement(messages);
  const suggestedDateExact =
    query.suggestedDateExact ?? agreement?.dateIso ?? null;
  const suggestedTime =
    normalizePlannedStartTime(query.suggestedTime) ??
    agreement?.timeHm ??
    null;

  return (
    <ScheduleWorkspace
      proposal={{
        id: row.id,
        proposalNumber: row.proposal_number,
        title: getProposalSummaryLabel(row),
        customerName: row.customer_name,
        estimatedDuration: row.estimated_duration,
        plannedStartDate: row.planned_start_date,
        plannedStartDateText: row.planned_start_date_text,
        plannedStartTime: row.planned_start_time ?? null,
        bookingConfirmation,
        requireCustomerDateAcceptance: false,
        scheduleMode: canHold ? "hold" : "job",
      }}
      calendarProposals={calendarProposals}
      suggestedDateText={query.suggestedDate ?? agreement?.dateText ?? null}
      suggestedDateExact={suggestedDateExact}
      suggestedTime={suggestedTime}
    />
  );
}
