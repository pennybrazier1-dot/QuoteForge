import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import {
  isPlatformAdminAllowlisted,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { ensurePlatformAdminBootstrap } from "@/lib/admin/ensure-platform-admin-bootstrap";
import { resolvePostAuthPathForUser } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set up your business",
  description: "Complete your Reanvil onboarding and start quoting faster.",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedEmail = resolveAuthEmail(user);
  const allowlisted = isPlatformAdminAllowlisted(resolvedEmail);

  // TEMPORARY AUTH DEBUG — remove after diagnosing production allowlist bypass.
  // Safe: does not log env values, secrets, passwords, or tokens.
  console.info("[auth-admin-debug]", {
    hasPlatformAdminEmailsEnv: Boolean(process.env.PLATFORM_ADMIN_EMAILS),
    resolvedAuthEmail: resolvedEmail,
    isPlatformAdminAllowlisted: allowlisted,
  });

  // Admin bypass must run before showing the trader onboarding form.
  if (allowlisted) {
    await ensurePlatformAdminBootstrap(supabase, user);
    redirect("/admin");
  }

  const destination = await resolvePostAuthPathForUser(supabase, user);
  if (destination !== "/onboarding") {
    redirect(destination);
  }

  return <OnboardingForm />;
}
