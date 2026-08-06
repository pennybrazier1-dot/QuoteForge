import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ensurePlatformAdminBootstrap } from "@/lib/admin/ensure-platform-admin-bootstrap";
import {
  isPlatformAdminAllowlisted,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { createClient } from "@/lib/supabase/server";

export type PostAuthPath = "/admin" | "/dashboard" | "/onboarding";

export async function userHasProfileForClient(
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

export async function userHasProfile(userId: string): Promise<boolean> {
  const supabase = await createClient();
  return userHasProfileForClient(supabase, userId);
}

/**
 * Where a signed-in user should go after auth.
 *
 * PLATFORM_ADMIN_EMAILS users are checked FIRST (before any onboarding gate):
 * workspace/profile are ensured, then they always go to /admin — never
 * trader onboarding.
 */
export async function resolvePostAuthPathForUser(
  supabase: SupabaseClient,
  user: User
): Promise<PostAuthPath> {
  const email = resolveAuthEmail(user);

  // Admin gate must run before any "incomplete onboarding" path.
  if (isPlatformAdminAllowlisted(email)) {
    const bootstrap = await ensurePlatformAdminBootstrap(supabase, user);
    if (!bootstrap.ok) {
      console.error(
        "[platform-admin-bootstrap] Failed for allowlisted admin:",
        bootstrap.error
      );
    }
    // Never send allowlisted platform admins through trader onboarding.
    return "/admin";
  }

  const hasProfile = await userHasProfileForClient(supabase, user.id);
  return hasProfile ? "/dashboard" : "/onboarding";
}

export async function getPostAuthRedirectPath(): Promise<PostAuthPath> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "/onboarding";
  }

  return resolvePostAuthPathForUser(supabase, user);
}
