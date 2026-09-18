import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessSettings } from "@/components/settings/business-settings";
import { ComingSoonSettings } from "@/components/settings/coming-soon-settings";
import { LocalEnquiryMigrationSettings } from "@/components/settings/local-enquiry-migration-settings";
import { MyAccountSettings } from "@/components/settings/my-account-settings";
import { MyServicesSettings } from "@/components/settings/my-services-settings";
import { PaymentSettings } from "@/components/settings/payment-settings";
import { PublicEnquiryLinkSettings } from "@/components/settings/public-enquiry-link-settings";
import { emptyPaymentSettings } from "@/lib/payments/settings";
import type { WorkspacePaymentSettings } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";
import { getPlaceholderServicesFromTradeType } from "@/lib/settings/placeholder-services";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Reanvil business and account settings.",
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
  const { data: paymentSettings } = await supabase
    .from("workspace_payment_settings")
    .select(
      "workspace_id, accept_bank_transfer, accept_card_link, accept_card_in_person, accept_cash, accept_other, bank_account_name, bank_sort_code, bank_account_number, bank_reference_instructions, external_payment_url, other_method_label"
    )
    .eq("workspace_id", profile.workspace_id)
    .maybeSingle();

  return (
    <main className="qf-trader-page mx-auto w-full max-w-full flex-1 py-10 lg:max-w-3xl lg:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Settings
      </h1>
      <p className="mt-2 text-sm text-muted">
        View your business and account details. Editing will be added soon.
      </p>

      <div className="mt-8 qf-stack">
        <BusinessSettings workspace={workspace} />
        <PaymentSettings
          settings={
            (paymentSettings as WorkspacePaymentSettings | null) ??
            emptyPaymentSettings(profile.workspace_id)
          }
        />
        <PublicEnquiryLinkSettings />
        <LocalEnquiryMigrationSettings />
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
