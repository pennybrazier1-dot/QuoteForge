import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ScheduleWorkspace } from "@/components/proposals/schedule-workspace";
import { fetchCalendarProposals } from "@/lib/calendar/calendar-queries";
import {
  isBookingConfirmation,
  type BookingConfirmation,
} from "@/lib/proposals/booking";
import { getProposalSummaryLabel } from "@/lib/proposals/display";
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

  // A job date is operational scheduling, not a proposal discussion.
  // Before acceptance, use the customer conversation or update the proposal.
  if (status !== "booked") {
    redirect(`/proposals/${row.id}#customer-replies`);
  }

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
      }}
      calendarProposals={calendarProposals}
      suggestedDateText={query.suggestedDate ?? null}
      suggestedDateExact={query.suggestedDateExact ?? null}
    />
  );
}
