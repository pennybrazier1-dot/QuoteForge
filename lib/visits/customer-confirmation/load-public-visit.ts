import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildPublicVisitConfirmationView,
  type PublicVisitConfirmationView,
} from "@/lib/visits/customer-confirmation/public-view";
import { isVisitStatus, type VisitStatus } from "@/lib/visits/types";

/** Columns selected for the public confirmation page — keep in sync with the query. */
type PublicVisitRow = {
  customer_access_token: string | null;
  visit_type: string | null;
  visit_date: string | null;
  visit_time: string | null;
  slot_label: string | null;
  status: string | null;
  enquiry_summary: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  workspace_id: string | null;
};

const PUBLIC_VISIT_SELECT =
  "customer_access_token, visit_type, visit_date, visit_time, slot_label, status, enquiry_summary, address_line_1, address_line_2, town, county, postcode, workspace_id";

export type LoadPublicVisitResult =
  | { ok: true; view: PublicVisitConfirmationView }
  | { ok: false; error: string };

/**
 * Load a customer-facing visit confirmation by opaque token.
 * Uses the service role on the server only — mirrors proposal portal loading.
 */
export async function loadPublicVisitByToken(
  token: string
): Promise<LoadPublicVisitResult> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 16) {
    return { ok: false, error: "This visit link is not valid." };
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return { ok: false, error: "Visit confirmation is temporarily unavailable." };
  }

  const { data, error } = await supabase
    .from("visits")
    .select(PUBLIC_VISIT_SELECT)
    .eq("customer_access_token", trimmed)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Could not load this visit confirmation." };
  }

  if (!data) {
    return { ok: false, error: "Visit not found. Check the link and try again." };
  }

  // Dynamic select strings are not inferred by the generated client; assert the
  // known column shape after the null/error guards above.
  const visit = data as PublicVisitRow;

  const statusRaw = String(visit.status ?? "");
  if (!isVisitStatus(statusRaw)) {
    return { ok: false, error: "Visit not found. Check the link and try again." };
  }

  let businessName: string | null = null;
  const workspaceId = String(visit.workspace_id ?? "").trim();
  if (workspaceId) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("business_name")
      .eq("id", workspaceId)
      .maybeSingle();
    businessName =
      workspace && typeof workspace === "object" && "business_name" in workspace
        ? ((workspace as { business_name: string | null }).business_name ?? null)
        : null;
  }

  const view = buildPublicVisitConfirmationView({
    customer_access_token: trimmed,
    visit_type: String(visit.visit_type ?? "initial_assessment"),
    visit_date: String(visit.visit_date ?? ""),
    visit_time: visit.visit_time,
    slot_label: visit.slot_label,
    status: statusRaw as VisitStatus,
    enquiry_summary: String(visit.enquiry_summary ?? ""),
    address_line_1: String(visit.address_line_1 ?? ""),
    address_line_2: String(visit.address_line_2 ?? ""),
    town: String(visit.town ?? ""),
    county: String(visit.county ?? ""),
    postcode: String(visit.postcode ?? ""),
    business_name: businessName,
  });

  return { ok: true, view };
}
