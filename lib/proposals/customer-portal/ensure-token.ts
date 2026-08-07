import type { SupabaseClient } from "@supabase/supabase-js";
import { createCustomerAccessToken } from "@/lib/proposals/customer-portal/token";

/**
 * Ensure a proposal has a customer portal access token.
 * Rotates only when forceRotate is true (e.g. future resend policy).
 */
export async function ensureProposalCustomerAccessToken(
  supabase: SupabaseClient,
  proposalId: string,
  options?: { forceRotate?: boolean }
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { data: existing, error: loadError } = await supabase
    .from("proposals")
    .select("id, customer_access_token")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, error: "Proposal not found." };
  }

  const current = existing.customer_access_token?.trim() ?? "";
  if (current && !options?.forceRotate) {
    return { ok: true, token: current };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = createCustomerAccessToken();
    const { data: updated, error: updateError } = await supabase
      .from("proposals")
      .update({ customer_access_token: token })
      .eq("id", proposalId)
      .select("customer_access_token")
      .maybeSingle();

    if (!updateError && updated?.customer_access_token) {
      return { ok: true, token: updated.customer_access_token };
    }
  }

  return { ok: false, error: "Could not create a secure proposal link." };
}
