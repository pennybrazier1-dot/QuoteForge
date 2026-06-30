import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { userHasProfile } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set up your business — QuoteForge",
  description: "Complete your QuoteForge onboarding and start quoting faster.",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (await userHasProfile(user.id)) {
    redirect("/dashboard");
  }

  return <OnboardingForm />;
}
