import type { SupabaseClient } from "@supabase/supabase-js";
import type { SiteVisitRow } from "@/lib/enquiries/server/types";
import { findActiveVisitForEnquiry } from "@/lib/visits/link-capture-session";

/**
 * Load one representative site_visits row for enquiry display / quote prep.
 * Prefer the active booking visit's capture. Never uses maybeSingle on enquiry_id
 * alone (multiple captures per enquiry are allowed after Milestone 5).
 */
export async function loadPrimarySiteVisitForEnquiry(
  supabase: SupabaseClient,
  workspaceId: string,
  enquiryId: string
): Promise<SiteVisitRow | null> {
  const linkedVisit = await findActiveVisitForEnquiry(
    supabase,
    workspaceId,
    enquiryId
  );

  if (linkedVisit) {
    const { data: byVisit } = await supabase
      .from("site_visits")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("visit_id", linkedVisit.id)
      .maybeSingle();

    if (byVisit) {
      return byVisit as SiteVisitRow;
    }
  }

  // Historical enquiry-level capture (visit_id null), newest first.
  const { data: historical } = await supabase
    .from("site_visits")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("enquiry_id", enquiryId)
    .is("visit_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (historical) {
    return historical as SiteVisitRow;
  }

  // Fallback: any capture for the enquiry (newest).
  const { data: anyCapture } = await supabase
    .from("site_visits")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("enquiry_id", enquiryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (anyCapture as SiteVisitRow | null) ?? null;
}
