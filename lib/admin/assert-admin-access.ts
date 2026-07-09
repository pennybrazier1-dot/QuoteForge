import { redirect } from "next/navigation";
import {
  isPlatformAdmin,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
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
}
