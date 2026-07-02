import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { fetchCalendarProposals } from "@/lib/calendar/calendar-queries";
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

  const proposals = await fetchCalendarProposals(supabase);

  return <CalendarScreen proposals={proposals} />;
}
