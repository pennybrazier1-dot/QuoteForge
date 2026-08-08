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
  description: "Place a draft date on the calendar, then confirm to book.",
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
        requireCustomerDateAcceptance: status === "needs_attention",
      }}
      calendarProposals={calendarProposals}
      suggestedDateText={query.suggestedDate ?? null}
      suggestedDateExact={query.suggestedDateExact ?? null}
    />
  );
}
