import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDashboardGreeting } from "@/lib/dashboard/greeting";
import { userHasProfile } from "@/lib/onboarding/status";
import { RecentProposalsPanel } from "@/components/dashboard/recent-proposals-panel";
import { StartProposalPanel } from "@/components/dashboard/start-proposal-panel";
import { TodaysAdminPanel } from "@/components/dashboard/todays-admin-panel";
import {
  WorkHomeHeroRow,
  WorkHomeShell,
} from "@/components/dashboard/work-home-shell";
import { DashboardTopBar } from "@/components/dashboard/top-bar";

export const metadata: Metadata = {
  title: "Dashboard — QuoteForge",
  description: "Your QuoteForge dashboard.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userHasProfile(user.id))) {
    redirect("/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, customer_name, title, job_summary, rough_notes, status, total_amount, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const allProposals = proposalsData ?? [];
  const recentProposals = allProposals.slice(0, 6);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <DashboardTopBar email={user.email} />

      <WorkHomeShell
        greeting={formatDashboardGreeting(profile?.full_name)}
        headline="Let's get today's paperwork finished."
        supporting="Start a proposal, clear today's tasks, or pick up a recent job."
      >
        <WorkHomeHeroRow>
          <StartProposalPanel />
          <TodaysAdminPanel proposals={allProposals} />
        </WorkHomeHeroRow>

        <RecentProposalsPanel proposals={recentProposals} />
      </WorkHomeShell>
    </div>
  );
}
