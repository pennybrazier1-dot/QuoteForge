"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { isTradeType } from "@/lib/onboarding/constants";
import { formatBusinessName } from "@/lib/text/format-name";
import {
  deleteWorkspaceLogos,
  uploadWorkspaceLogo,
  WORKSPACE_LOGO_MAX_BYTES,
} from "@/lib/workspace/branding-logo";
import {
  isValidBusinessEmail,
  isValidBusinessWebsite,
  isValidUkCompanyNumber,
  isValidUkPhone,
  isValidUkPostcode,
  isValidUkVatNumber,
  normalizeBusinessWebsite,
  normalizeOptionalText,
  normalizeUkCompanyNumber,
  normalizeUkPostcode,
  normalizeUkVatNumber,
} from "@/lib/workspace/uk-business-validation";

export type BusinessProfileActionState = {
  error?: string;
  success?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function requireWorkspaceContext(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; workspaceId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!(await userHasProfile(user.id))) {
    return { ok: false, error: "Please complete onboarding first." };
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();
  if (error || !profile?.workspace_id) {
    return { ok: false, error: "Could not find your workspace." };
  }
  return { ok: true, supabase, workspaceId: profile.workspace_id };
}

export async function saveBusinessProfileAction(
  _prev: BusinessProfileActionState,
  formData: FormData
): Promise<BusinessProfileActionState> {
  const ctx = await requireWorkspaceContext();
  if (!ctx.ok) {
    return { error: ctx.error };
  }

  const businessName = formatBusinessName(getString(formData, "businessName"));
  const tradeType = getString(formData, "tradeType");
  const contactEmail = getString(formData, "contactEmail");
  const phone = getString(formData, "phone");
  const addressLine1 = normalizeOptionalText(getString(formData, "addressLine1"));
  const addressLine2 = normalizeOptionalText(getString(formData, "addressLine2"));
  const town = normalizeOptionalText(getString(formData, "town"));
  const county = normalizeOptionalText(getString(formData, "county"));
  const postcodeRaw = getString(formData, "postcode");
  const vatRaw = getString(formData, "vatNumber");
  const websiteRaw = getString(formData, "website");
  const companyNumberRaw = getString(formData, "companyNumber");
  const defaultPaymentTerms = getString(formData, "defaultPaymentTerms");

  if (!businessName) {
    return { error: "Business name is required." };
  }
  if (!tradeType || !isTradeType(tradeType)) {
    return { error: "Please choose a valid trade type." };
  }
  if (!contactEmail || !isValidBusinessEmail(contactEmail)) {
    return { error: "Please enter a valid business email address." };
  }
  if (!phone || !isValidUkPhone(phone)) {
    return { error: "Please enter a valid UK phone number." };
  }
  if (postcodeRaw && !isValidUkPostcode(postcodeRaw)) {
    return { error: "Please enter a valid UK postcode." };
  }
  if (!isValidUkVatNumber(vatRaw)) {
    return { error: "Please enter a valid UK VAT number, or leave it blank." };
  }
  const websiteNormalized = normalizeBusinessWebsite(websiteRaw);
  if (websiteNormalized && !isValidBusinessWebsite(websiteNormalized)) {
    return {
      error: "Please enter a valid website address, or leave it blank.",
    };
  }
  if (!isValidUkCompanyNumber(companyNumberRaw)) {
    return {
      error:
        "Please enter a valid UK company number (8 characters), or leave it blank.",
    };
  }
  if (!defaultPaymentTerms) {
    return { error: "Default payment terms are required." };
  }

  const { error } = await ctx.supabase
    .from("workspaces")
    .update({
      business_name: businessName,
      trade_type: tradeType,
      contact_email: contactEmail,
      phone,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      town,
      county,
      postcode: postcodeRaw ? normalizeUkPostcode(postcodeRaw) : null,
      vat_number: normalizeUkVatNumber(vatRaw),
      website: websiteNormalized,
      company_number: normalizeUkCompanyNumber(companyNumberRaw),
      default_payment_terms: defaultPaymentTerms,
    })
    .eq("id", ctx.workspaceId);

  if (error) {
    return { error: error.message || "Could not save business details." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "Business details saved." };
}

export async function uploadBusinessLogoAction(
  _prev: BusinessProfileActionState,
  formData: FormData
): Promise<BusinessProfileActionState> {
  const ctx = await requireWorkspaceContext();
  if (!ctx.ok) {
    return { error: ctx.error };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size <= 0) {
    return { error: "Choose a logo image to upload." };
  }
  if (file.size > WORKSPACE_LOGO_MAX_BYTES) {
    return { error: "Logo must be 2 MB or smaller." };
  }

  const result = await uploadWorkspaceLogo(ctx.supabase, ctx.workspaceId, file);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/settings");
  return { success: "Logo saved." };
}

export async function removeBusinessLogoAction(
  _prev: BusinessProfileActionState,
  formData: FormData
): Promise<BusinessProfileActionState> {
  void formData;
  const ctx = await requireWorkspaceContext();
  if (!ctx.ok) {
    return { error: ctx.error };
  }

  const result = await deleteWorkspaceLogos(ctx.supabase, ctx.workspaceId);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/settings");
  return { success: "Logo removed." };
}
