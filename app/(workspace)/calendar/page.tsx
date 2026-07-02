import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarScreen } from "@/components/calendar/calendar-screen";
import type { CalendarProposal } from "@/lib/calendar/calendar-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Calendar — QuoteForge",
  description: "Your upcoming jobs and schedule.",
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
    Phase 1 — UI foundation only.
    Read existing booked jobs when present; booking logic comes later.
  */
  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, customer_name, title, job_summary, rough_notes, status, booking_confirmation, planned_start_date, planned_start_date_text, estimated_duration, job_address"
    )
    .eq("status", "booked")
    .not("planned_start_date", "is", null)
    .order("planned_start_date", { ascending: true });

  const proposals = (proposalsData ?? []) as CalendarProposal[];

  return <CalendarScreen proposals={proposals} />;
}
