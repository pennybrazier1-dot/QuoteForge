"use server";

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PAYMENT_TERMS,
  isHeardAboutOption,
  isTradeType,
} from "@/lib/onboarding/constants";
import { userHasProfile } from "@/lib/onboarding/status";
import { formatBusinessName, formatPersonName } from "@/lib/text/format-name";
import { redirect } from "next/navigation";

export type OnboardingActionState = {
  error?: string;
};

function getRequiredString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function completeOnboarding(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to complete setup." };
  }

  if (await userHasProfile(user.id)) {
    redirect("/dashboard");
  }

  const fullName = formatPersonName(getRequiredString(formData, "fullName"));
  const businessName = formatBusinessName(getRequiredString(formData, "businessName"));
  const tradeType = getRequiredString(formData, "tradeType");
  const businessEmail = getRequiredString(formData, "businessEmail");
  const phone = getRequiredString(formData, "phone");
  const vatNumber = getRequiredString(formData, "vatNumber");
  const defaultPaymentTerms =
    getRequiredString(formData, "defaultPaymentTerms") || DEFAULT_PAYMENT_TERMS;
  const heardAbout = getRequiredString(formData, "heardAbout");

  if (!fullName || !businessName || !tradeType) {
    return { error: "Please complete all details in step 1." };
  }

  if (!businessEmail || !phone || !defaultPaymentTerms) {
    return { error: "Please complete all required details in step 2." };
  }

  if (!heardAbout) {
    return { error: "Please tell us how you heard about QuoteForge." };
  }

  if (!isTradeType(tradeType)) {
    return { error: "Please choose a valid trade type." };
  }

  if (!isHeardAboutOption(heardAbout)) {
    return { error: "Please choose a valid option for how you heard about us." };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(businessEmail)) {
    return { error: "Please enter a valid business email address." };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      owner_id: user.id,
      business_name: businessName,
      contact_email: businessEmail,
      phone,
      trade_type: tradeType,
      vat_number: vatNumber || null,
      default_payment_terms: defaultPaymentTerms,
    })
    .select("id")
    .single();

  if (workspaceError || !workspace) {
    return {
      error: workspaceError?.message ?? "Could not create your workspace. Please try again.",
    };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: user.id,
    workspace_id: workspace.id,
    full_name: fullName,
    heard_about: heardAbout,
    role: "owner",
  });

  if (profileError) {
    return {
      error: profileError.message ?? "Could not create your profile. Please try again.",
    };
  }

  redirect("/dashboard");
}
