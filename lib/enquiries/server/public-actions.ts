"use server";

import { createClient } from "@/lib/supabase/server";
import type { JourneyFormData } from "@/lib/customer-journey/types";
import { PROPERTY_TYPES } from "@/lib/customer-journey/constants";
import { getTradeQuestions } from "@/lib/customer-journey/trade-questions";
import type { TradeType } from "@/lib/customer-journey/types";

export type PublicEnquirySubmitResult =
  | { ok: true; enquiryId: string }
  | { ok: false; error: string };

function propertyTypeLabel(value: string | null): string | null {
  if (!value) return null;
  return PROPERTY_TYPES.find((type) => type.id === value)?.label ?? value;
}

export async function submitPublicEnquiryAction(input: {
  slug: string;
  formData: JourneyFormData;
  serviceRequested: string;
  trade: TradeType;
}): Promise<PublicEnquirySubmitResult> {
  const slug = input.slug.trim().toLowerCase();
  if (slug.length < 8) {
    return { ok: false, error: "This quote request link is not valid." };
  }

  const name = input.formData.name.trim();
  const mobile = input.formData.mobile.trim();
  const email = input.formData.email.trim();

  if (!name) {
    return { ok: false, error: "Please enter your name." };
  }

  if (!mobile && !email) {
    return { ok: false, error: "Please enter a phone number or email." };
  }

  const tradeAnswers = getTradeQuestions(input.trade)
    .filter((question) => input.formData.tradeAnswers[question.id]?.trim())
    .map((question) => ({
      questionId: question.id,
      question: question.label,
      answer: input.formData.tradeAnswers[question.id].trim(),
    }));

  const measurements =
    input.formData.knowsMeasurements === "yes"
      ? input.formData.measurements.filter((field) => field.value.trim())
      : [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_public_enquiry", {
    p_slug: slug,
    p_customer_name: name,
    p_customer_mobile: mobile,
    p_customer_email: email,
    p_service_requested: input.serviceRequested,
    p_address_line_1: input.formData.addressLine1.trim(),
    p_address_line_2: input.formData.addressLine2.trim(),
    p_town: input.formData.city.trim(),
    p_county: input.formData.county.trim(),
    p_postcode: input.formData.postcode.trim(),
    p_property_type: propertyTypeLabel(input.formData.propertyType),
    p_project_description: input.formData.projectDescription.trim(),
    p_measurements: measurements,
    p_trade_answers: tradeAnswers,
  });

  if (error || !data) {
    return {
      ok: false,
      error: "We could not submit your request. Please check the link and try again.",
    };
  }

  return { ok: true, enquiryId: String(data) };
}

export async function getPublicIntakeWorkspaceAction(slug: string): Promise<
  | {
      ok: true;
      businessName: string;
      phone: string;
      tradeType: string | null;
    }
  | { ok: false; error: string }
> {
  const normalised = slug.trim().toLowerCase();
  if (normalised.length < 8) {
    return { ok: false, error: "This quote request link is not valid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_intake_workspace", {
    p_slug: normalised,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return { ok: false, error: "This quote request link is not valid." };
  }

  return {
    ok: true,
    businessName: row.business_name,
    phone: row.phone ?? "",
    tradeType: row.trade_type,
  };
}
