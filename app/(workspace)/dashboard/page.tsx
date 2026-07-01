import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AiInsightsPanel } from "@/components/dashboard/ai-insights-panel";
import {
  DashboardShell,
  StatCardsRow,
} from "@/components/dashboard/dashboard-shell";
import { QuickActionsPanel } from "@/components/dashboard/quick-actions-panel";
import { RecentProposalsPanel } from "@/components/dashboard/recent-proposals-panel";
import { TodaysFocusPanel } from "@/components/dashboard/todays-focus-panel";
import { buildDashboardInsights } from "@/lib/dashboard/insights";
import {
  getDashboardMetrics,
  getFocusRows,
  getStatTrends,
  type DashboardProposal,
} from "@/lib/dashboard/metrics";

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

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, customer_name, title, job_summary, rough_notes, status, total_amount, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const proposals = (proposalsData ?? []) as DashboardProposal[];
  const metrics = getDashboardMetrics(proposals);
  const trends = getStatTrends(proposals);
  const focusRows = getFocusRows(proposals, metrics);
  const insights = buildDashboardInsights(metrics);

  return (
    <DashboardShell>
      <StatCardsRow metrics={metrics} trends={trends} />

      <div className="qf-dash-split">
        <RecentProposalsPanel proposals={proposals} />
        <TodaysFocusPanel rows={focusRows} />
      </div>

      <div className="qf-dash-split">
        <AiInsightsPanel insights={insights} />
        <QuickActionsPanel />
      </div>
    </DashboardShell>
  );
}
