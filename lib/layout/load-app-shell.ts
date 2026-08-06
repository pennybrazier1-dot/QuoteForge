import { redirect } from "next/navigation";
import type { SidebarDraftItem } from "@/components/layout/app-sidebar";
import { ensurePlatformAdminBootstrap } from "@/lib/admin/ensure-platform-admin-bootstrap";
import {
  isPlatformAdmin,
  isPlatformAdminAllowlisted,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
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

  const email = resolveAuthEmail(user);
  const viewingTraderAsAdmin = isPlatformAdminAllowlisted(email);

  // Ensure the platform admin testing workspace/profile exists before the
  // trader shell requires a profile (same session — no re-login).
  if (viewingTraderAsAdmin) {
    await ensurePlatformAdminBootstrap(supabase, user);
  }

  if (!(await userHasProfile(user.id))) {
    // Allowlisted admins should never be pushed into trader onboarding.
    if (viewingTraderAsAdmin) {
      redirect("/admin");
    }
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
    email,
    platformAdmin: isPlatformAdmin(email),
    viewingTraderAsAdmin,
    recentDrafts,
  };
}
