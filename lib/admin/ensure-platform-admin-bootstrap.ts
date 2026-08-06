import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  isPlatformAdminAllowlisted,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { DEFAULT_PAYMENT_TERMS } from "@/lib/onboarding/constants";
import { PLATFORM_ADMIN_DEMO_BUSINESS_NAME } from "@/lib/proposals/pdf/customer-branding";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatPersonName } from "@/lib/text/format-name";

export type PlatformAdminBootstrapResult =
  | { ok: true }
  | { ok: false; error: string };

async function adminHasProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  return Boolean(profile);
}

function platformAdminDisplayName(user: User): string {
  const metaName = user.user_metadata?.full_name;
  if (typeof metaName === "string" && metaName.trim()) {
    return formatPersonName(metaName);
  }

  const email = resolveAuthEmail(user);
  if (email?.includes("@")) {
    return formatPersonName(email.split("@")[0] ?? "Platform Admin");
  }

  return "Platform Admin";
}

function resolveBootstrapClient(
  sessionClient: SupabaseClient
): { client: SupabaseClient; mode: "service_role" | "session" } {
  try {
    return { client: createServiceRoleClient(), mode: "service_role" };
  } catch {
    // Local/dev without service role — fall back to the signed-in client.
    return { client: sessionClient, mode: "session" };
  }
}

/**
 * For PLATFORM_ADMIN_EMAILS only: ensure an admin testing workspace + profile
 * exist so the admin can use /admin and "View as trader" without onboarding.
 *
 * Prefers the service-role client so RLS cannot block bootstrap.
 */
export async function ensurePlatformAdminBootstrap(
  sessionClient: SupabaseClient,
  user: User
): Promise<PlatformAdminBootstrapResult> {
  const email = resolveAuthEmail(user);
  if (!isPlatformAdminAllowlisted(email)) {
    return { ok: false, error: "Not on PLATFORM_ADMIN_EMAILS." };
  }

  const { client } = resolveBootstrapClient(sessionClient);

  if (await adminHasProfile(client, user.id)) {
    return { ok: true };
  }

  const { data: existingWorkspace } = await client
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  let workspaceId = existingWorkspace?.id as string | undefined;

  if (!workspaceId) {
    const { data: workspace, error: workspaceError } = await client
      .from("workspaces")
      .insert({
        owner_id: user.id,
        business_name: PLATFORM_ADMIN_DEMO_BUSINESS_NAME,
        contact_email: email,
        phone: null,
        trade_type: "Other",
        vat_number: null,
        default_payment_terms: DEFAULT_PAYMENT_TERMS,
      })
      .select("id")
      .single();

    if (workspaceError || !workspace) {
      return {
        ok: false,
        error:
          workspaceError?.message ??
          "Could not create the platform admin workspace.",
      };
    }

    workspaceId = workspace.id;
  }

  const { error: profileError } = await client.from("profiles").insert({
    id: user.id,
    workspace_id: workspaceId,
    full_name: platformAdminDisplayName(user),
    heard_about: "Other",
    role: "owner",
  });

  if (profileError) {
    if (await adminHasProfile(client, user.id)) {
      return { ok: true };
    }

    return {
      ok: false,
      error:
        profileError.message ?? "Could not create the platform admin profile.",
    };
  }

  return { ok: true };
}
