import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/home/home-screen";
import { buildHomeAttentionItems } from "@/lib/home/home-attention";
import {
  buildHomeSectionGroups,
  type HomeProposal,
} from "@/lib/home/home-data";
import { createClient } from "@/lib/supabase/server";
import { listVisits } from "@/lib/visits/queries";
import type { VisitRecord } from "@/lib/visits/types";

export const metadata: Metadata = {
  title: "Home",
  description: "What do you need to do today?",
};

const HOME_PROPOSAL_SELECT =
  "id, proposal_number, customer_name, title, job_summary, rough_notes, scope_of_work, job_address, status, attention_reason, booking_confirmation, total_amount, created_at, updated_at, accepted_at, sent_at, booked_at, completed_at, planned_start_date_text, planned_start_date, planned_start_time, estimated_duration";

type PageProps = {
  searchParams: Promise<{
    visitBooked?: string;
    jobCompleted?: string;
    completedCustomer?: string;
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(HOME_PROPOSAL_SELECT)
    .order("updated_at", { ascending: false })
    .limit(100);

  let visits: VisitRecord[] = [];
  if (profile?.workspace_id) {
    visits = await listVisits(supabase, profile.workspace_id, {
      status: "open",
    });
  }

  const proposals = (proposalsData ?? []) as HomeProposal[];
  const groups = buildHomeSectionGroups(proposals, visits);
  const attentionItems = buildHomeAttentionItems(proposals);
  const { visitBooked, jobCompleted, completedCustomer } = await searchParams;

  return (
    <HomeScreen
      fullName={profile?.full_name ?? null}
      attentionItems={attentionItems}
      groups={groups}
      visitBooked={visitBooked === "1"}
      jobCompleted={jobCompleted === "1"}
      completedCustomer={completedCustomer ?? null}
    />
  );
}
