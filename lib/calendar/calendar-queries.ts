import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarProposal } from "@/lib/calendar/calendar-data";

export const CALENDAR_PROPOSAL_SELECT =
  "id, proposal_number, customer_name, title, job_summary, rough_notes, status, booking_confirmation, planned_start_date, planned_start_date_text, estimated_duration, things_to_confirm, job_address";

export const CALENDAR_PROPOSAL_STATUSES = [
  "waiting_for_customer",
  "needs_attention",
  "booked",
  "sent",
  "accepted",
  "in_progress",
] as const;

export async function fetchCalendarProposals(
  supabase: SupabaseClient
): Promise<CalendarProposal[]> {
  const { data } = await supabase
    .from("proposals")
    .select(CALENDAR_PROPOSAL_SELECT)
    .in("status", [...CALENDAR_PROPOSAL_STATUSES])
    .not("planned_start_date", "is", null)
    .order("planned_start_date", { ascending: true });

  return (data ?? []) as CalendarProposal[];
}
