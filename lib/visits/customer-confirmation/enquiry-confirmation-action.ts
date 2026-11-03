"use server";

import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import { buildCustomerVisitConfirmationUrl } from "@/lib/visits/customer-confirmation/token";
import { findActiveVisitForEnquiry } from "@/lib/visits/link-capture-session";

export type EnquiryVisitConfirmationResult =
  | {
      ok: true;
      visitId: string;
      token: string;
      url: string;
    }
  | { ok: false; error: string };

/**
 * Resolve the secure /v/{token} confirmation URL for an enquiry's active visit.
 * Never returns enquiry ids or visit UUIDs as the customer credential.
 */
export async function getEnquiryVisitConfirmationAction(
  enquiryId: string
): Promise<EnquiryVisitConfirmationResult> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const trimmed = enquiryId.trim();
  if (!trimmed) {
    return { ok: false, error: "Enquiry not found." };
  }

  const active = await findActiveVisitForEnquiry(
    context.supabase,
    context.workspaceId,
    trimmed
  );
  if (!active) {
    return {
      ok: false,
      error: "No booked visit found for this enquiry yet.",
    };
  }

  const { data: visit, error } = await context.supabase
    .from("visits")
    .select("id, customer_access_token, workspace_id")
    .eq("id", active.id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();

  if (error || !visit) {
    return { ok: false, error: "Could not load the visit confirmation link." };
  }

  const token = String(visit.customer_access_token ?? "").trim();
  if (!token) {
    return {
      ok: false,
      error:
        "This visit does not have a secure customer link yet. Book or reopen the visit from Visits.",
    };
  }

  return {
    ok: true,
    visitId: visit.id,
    token,
    url: buildCustomerVisitConfirmationUrl(token),
  };
}
