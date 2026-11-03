import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensure a dedicated site_visits capture row exists for one booking visit.
 * Does not create a second booking in public.visits.
 * Does not reuse another visit's capture or silently move photographs.
 * Historical enquiry-level captures (visit_id null) are left untouched here.
 */
export async function linkCaptureSessionToVisit(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    visitId: string;
    enquiryId: string;
    slotLabel: string | null;
    startsAt: string | null;
    visitDate: string;
  }
): Promise<{ ok: true; siteVisitId: string } | { ok: false; error: string }> {
  const { data: byVisit, error: byVisitError } = await supabase
    .from("site_visits")
    .select("id")
    .eq("visit_id", input.visitId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (byVisitError) {
    return {
      ok: false,
      error: byVisitError.message || "Could not load capture session.",
    };
  }

  if (byVisit?.id) {
    await supabase
      .from("visits")
      .update({ source_site_visit_id: byVisit.id })
      .eq("id", input.visitId)
      .eq("workspace_id", input.workspaceId)
      .is("source_site_visit_id", null);

    return { ok: true, siteVisitId: byVisit.id };
  }

  // Prefer an already-recorded source_site_visit_id on the visit (idempotent).
  const { data: visitRow } = await supabase
    .from("visits")
    .select("source_site_visit_id")
    .eq("id", input.visitId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (visitRow?.source_site_visit_id) {
    const { data: sourced } = await supabase
      .from("site_visits")
      .select("id, visit_id")
      .eq("id", visitRow.source_site_visit_id)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();

    if (sourced?.id) {
      if (!sourced.visit_id) {
        await supabase
          .from("site_visits")
          .update({ visit_id: input.visitId })
          .eq("id", sourced.id)
          .eq("workspace_id", input.workspaceId)
          .is("visit_id", null);
      }
      return { ok: true, siteVisitId: sourced.id };
    }
  }

  // Create a fresh capture for this visit only.
  // Do not attach historical enquiry-level captures (visit_id null) here —
  // those stay available for review / Milestone 3A-style unambiguous linking.
  const { data: created, error: createError } = await supabase
    .from("site_visits")
    .insert({
      workspace_id: input.workspaceId,
      enquiry_id: input.enquiryId,
      visit_id: input.visitId,
      slot_label: input.slotLabel,
      starts_at: input.startsAt,
      date_iso: input.visitDate,
      notes: "",
      measurements: [],
      checklist: [],
      voice_notes: [],
    })
    .select("id")
    .single();

  if (createError || !created) {
    return {
      ok: false,
      error: createError?.message || "Could not create capture session.",
    };
  }

  await supabase
    .from("visits")
    .update({ source_site_visit_id: created.id })
    .eq("id", input.visitId)
    .eq("workspace_id", input.workspaceId);

  return { ok: true, siteVisitId: created.id };
}

/**
 * Find a booking visit for an enquiry without creating one.
 * Prefer initial_assessment when present.
 */
export async function findActiveVisitForEnquiry(
  supabase: SupabaseClient,
  workspaceId: string,
  enquiryId: string
): Promise<{
  id: string;
  slot_label: string | null;
  starts_at: string | null;
  visit_date: string;
} | null> {
  const { data } = await supabase
    .from("visits")
    .select("id, slot_label, starts_at, visit_date, visit_type, status")
    .eq("workspace_id", workspaceId)
    .eq("enquiry_id", enquiryId)
    .in("status", ["scheduled", "confirmed", "completed"])
    .order("visit_date", { ascending: false })
    .limit(5);

  const rows = data ?? [];
  const initial = rows.find((row) => row.visit_type === "initial_assessment");
  const chosen = initial ?? rows[0];
  if (!chosen) {
    return null;
  }

  return {
    id: chosen.id,
    slot_label: (chosen.slot_label as string | null) ?? null,
    starts_at: (chosen.starts_at as string | null) ?? null,
    visit_date: String(chosen.visit_date ?? ""),
  };
}

export async function listVisitsForEnquiry(
  supabase: SupabaseClient,
  workspaceId: string,
  enquiryId: string
): Promise<
  Array<{
    id: string;
    visit_type: string;
    visit_date: string;
    visit_time: string | null;
    status: string;
    slot_label: string | null;
  }>
> {
  const { data } = await supabase
    .from("visits")
    .select("id, visit_type, visit_date, visit_time, status, slot_label")
    .eq("workspace_id", workspaceId)
    .eq("enquiry_id", enquiryId)
    .order("visit_date", { ascending: true });

  return (data ?? []) as Array<{
    id: string;
    visit_type: string;
    visit_date: string;
    visit_time: string | null;
    status: string;
    slot_label: string | null;
  }>;
}
