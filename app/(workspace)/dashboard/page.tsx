import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/home/home-screen";
import {
  buildHomeSections,
  getHomeNotificationCount,
  type HomeProposal,
} from "@/lib/home/home-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Home — QuoteForge",
  description: "What do you need to do today?",
};

const HOME_PROPOSAL_SELECT =
  "id, proposal_number, customer_name, title, job_summary, rough_notes, scope_of_work, job_address, status, attention_reason, booking_confirmation, total_amount, created_at, updated_at, accepted_at, sent_at, booked_at, completed_at, planned_start_date_text, planned_start_date, estimated_duration";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(HOME_PROPOSAL_SELECT)
    .order("updated_at", { ascending: false })
    .limit(100);

  const proposals = (proposalsData ?? []) as HomeProposal[];
  const sections = buildHomeSections(proposals);
  const notificationCount = getHomeNotificationCount(proposals);

  return (
    <HomeScreen
      fullName={profile?.full_name ?? null}
      notificationCount={notificationCount}
      sections={sections}
    />
  );
}
