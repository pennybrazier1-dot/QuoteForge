import { redirect } from "next/navigation";
import type { SidebarDraftItem } from "@/components/layout/app-sidebar";
import { userHasProfile } from "@/lib/onboarding/status";
import { getProposalSummaryLabel } from "@/lib/proposals/display";
import { createClient } from "@/lib/supabase/server";

export async function loadAppShellContext() {
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

  const [{ data: profile }, { data: draftsData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("proposals")
      .select(
        "id, customer_name, title, job_summary, rough_notes, status, created_at"
      )
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const recentDrafts: SidebarDraftItem[] = (draftsData ?? []).map((draft) => ({
    id: draft.id,
    customer_name: draft.customer_name,
    subtitle: getProposalSummaryLabel(draft),
    status: draft.status,
  }));

  return {
    fullName: profile?.full_name ?? null,
    email: user.email ?? null,
    recentDrafts,
  };
}
