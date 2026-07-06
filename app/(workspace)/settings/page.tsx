import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessSettings } from "@/components/settings/business-settings";
import { ComingSoonSettings } from "@/components/settings/coming-soon-settings";
import { MyAccountSettings } from "@/components/settings/my-account-settings";
import { MyServicesSettings } from "@/components/settings/my-services-settings";
import { createClient } from "@/lib/supabase/server";
import { getPlaceholderServicesFromTradeType } from "@/lib/settings/placeholder-services";

export const metadata: Metadata = {
  title: "Settings — QuoteForge",
  description: "Manage your QuoteForge business and account settings.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, workspace_id")
    .eq("id", user!.id)
    .single();

  if (profileError || !profile) {
    redirect("/onboarding");
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select(
      "business_name, trade_type, contact_email, phone, vat_number, default_payment_terms"
    )
    .eq("id", profile.workspace_id)
    .single();

  if (workspaceError || !workspace) {
    redirect("/dashboard");
  }

  const initialServices = getPlaceholderServicesFromTradeType(workspace.trade_type);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Settings
      </h1>
      <p className="mt-2 text-sm text-muted">
        View your business and account details. Editing will be added soon.
      </p>

      <div className="mt-8 qf-stack">
        <BusinessSettings workspace={workspace} />
        <MyServicesSettings initialServices={initialServices} />
        <MyAccountSettings
          account={{
            full_name: profile.full_name,
            email: user?.email ?? null,
          }}
        />
        <ComingSoonSettings />
      </div>
    </main>
  );
}
