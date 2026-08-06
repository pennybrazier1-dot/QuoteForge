import { redirect } from "next/navigation";
import {
  isPlatformAdmin,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { ensurePlatformAdminBootstrap } from "@/lib/admin/ensure-platform-admin-bootstrap";
import { createClient } from "@/lib/supabase/server";

/**
 * Requires a signed-in platform admin. Others are sent back to the trader app.
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

  if (!isPlatformAdmin(email)) {
    redirect("/dashboard");
  }

  // Allowlisted admins must have workspace/profile before admin UI loads.
  // (Local/dev "open admin" mode still benefits when email is allowlisted.)
  if (email) {
    await ensurePlatformAdminBootstrap(supabase, user);
  }
}
