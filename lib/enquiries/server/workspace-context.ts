import { createClient } from "@/lib/supabase/server";

export type WorkspaceContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: { id: string };
      workspaceId: string;
      workspace: {
        id: string;
        business_name: string;
        phone: string | null;
        contact_email: string | null;
        trade_type: string | null;
        public_enquiry_slug: string | null;
      };
    }
  | { ok: false; error: string };

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.workspace_id) {
    return { ok: false, error: "Complete onboarding before managing enquiries." };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, business_name, phone, contact_email, trade_type, public_enquiry_slug")
    .eq("id", profile.workspace_id)
    .maybeSingle();

  if (!workspace) {
    return { ok: false, error: "Workspace not found." };
  }

  return {
    ok: true,
    supabase,
    user: { id: user.id },
    workspaceId: profile.workspace_id as string,
    workspace,
  };
}
