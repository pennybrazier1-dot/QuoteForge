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
    Sent quotes with a planned start date — waiting (amber), accepted/booked (green when confirmed).
    Ready to Send and drafts are excluded.
  */
  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, customer_name, title, job_summary, rough_notes, status, booking_confirmation, planned_start_date, planned_start_date_text, estimated_duration, things_to_confirm, job_address"
    )
    .in("status", [
      "waiting_for_customer",
      "needs_attention",
      "booked",
      "sent",
      "accepted",
      "in_progress",
    ])
    .not("planned_start_date", "is", null)
    .order("planned_start_date", { ascending: true });

  const proposals = (proposalsData ?? []) as CalendarProposal[];

  return <CalendarScreen proposals={proposals} />;
}
