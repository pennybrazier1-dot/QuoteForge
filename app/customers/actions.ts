"use server";

import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { formatPersonName } from "@/lib/text/format-name";
import { redirect } from "next/navigation";

export type UpdateCustomerNotesState = {
  error?: string;
};

export type UpdateCustomerState = {
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function updateCustomer(
  _prevState: UpdateCustomerState,
  formData: FormData
): Promise<UpdateCustomerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to update customers." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding before updating customers." };
  }

  const customerId = getString(formData, "customerId");

  if (!customerId) {
    return { error: "Customer not found." };
  }

  const name = formatPersonName(getString(formData, "name"));

  if (!name) {
    return { error: "Customer name is required." };
  }

  const email = getString(formData, "email");
  const phone = getString(formData, "phone");
  const address = getString(formData, "address");
  const notes = getString(formData, "notes");

  const { data: customer, error: loadError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (loadError || !customer) {
    return { error: "Customer not found." };
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      name,
      email: email || null,
      phone: phone || null,
      address_line_1: address || null,
      address_line_2: null,
      town: null,
      county: null,
      postcode: null,
      notes: notes || null,
    })
    .eq("id", customerId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not save customer details.",
    };
  }

  redirect(`/customers/${customerId}`);
}

export async function updateCustomerNotes(
  _prevState: UpdateCustomerNotesState,
  formData: FormData
): Promise<UpdateCustomerNotesState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to update customer notes." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding before updating customers." };
  }

  const customerId = getString(formData, "customerId");

  if (!customerId) {
    return { error: "Customer not found." };
  }

  const notes = getString(formData, "notes");

  const { data: customer, error: loadError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (loadError || !customer) {
    return { error: "Customer not found." };
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update({ notes: notes || null })
    .eq("id", customerId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not save customer notes.",
    };
  }

  redirect(`/customers/${customerId}`);
}
