import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

export async function getPostAuthRedirectPath(): Promise<"/dashboard" | "/onboarding"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "/onboarding";
  }

  const hasProfile = await userHasProfileForClient(supabase, user.id);
  return hasProfile ? "/dashboard" : "/onboarding";
}
