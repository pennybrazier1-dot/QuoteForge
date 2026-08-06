import { redirect } from "next/navigation";
import {
  isPlatformAdminAllowlisted,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";
import { createClient } from "@/lib/supabase/server";

/**
 * Demo customer journeys (/request-quote without a workspace slug) are for
 * local/preview testing and platform admins only — not the trader workspace.
 * Real customer intake remains /request-quote/w/[slug].
 */
export async function assertCustomerJourneyDemoAccess(): Promise<void> {
  if (isDevTestingEnabled()) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isPlatformAdminAllowlisted(resolveAuthEmail(user))) {
    return;
  }

  redirect("/");
}
