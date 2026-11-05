import { redirect } from "next/navigation";
import {
  isPlatformAdmin,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { ensurePlatformAdminBootstrap } from "@/lib/admin/ensure-platform-admin-bootstrap";
import { createClient } from "@/lib/supabase/server";

/**
 * Stage 9K.2 — requires a signed-in, explicitly allowlisted platform admin.
 * Development/preview flags never satisfy this check.
 * Unauthenticated → /login. Authenticated non-admin → /dashboard.
 */
export async function assertAdminAccess(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = resolveAuthEmail(user);

  // Fail closed: missing email or missing/invalid allowlist → not admin.
  if (!email || !isPlatformAdmin(email)) {
    redirect("/dashboard");
  }

  await ensurePlatformAdminBootstrap(supabase, user);
}
