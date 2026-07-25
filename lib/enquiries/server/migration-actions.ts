"use server";

import { createClient } from "@/lib/supabase/server";
import { storedEnquiryToInsertPayload } from "@/lib/enquiries/server/types";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import type { SiteVisitSession } from "@/lib/site-visit/types";

export type LocalMigrationReport = {
  attempted: number;
  imported: number;
  skipped: number;
  failed: Array<{ id: string; reason: string }>;
  importedIds: string[];
};

export type LocalMigrationPayload = {
  enquiries: StoredEnquiry[];
  sessions: Record<string, SiteVisitSession | null | undefined>;
};

/**
 * Imports browser-local enquiry records into the signed-in workspace.
 * The browser must read localStorage/IndexedDB and post the payload here.
 * Does not delete local copies — the client clears only after a successful import.
 */
export async function importLocalEnquiriesAction(
  payload: LocalMigrationPayload
): Promise<{ ok: true; report: LocalMigrationReport } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to migrate local enquiries." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.workspace_id) {
    return { ok: false, error: "Complete onboarding before migrating enquiries." };
  }

  const enquiries = Array.isArray(payload.enquiries) ? payload.enquiries : [];
  const sessions = payload.sessions ?? {};

  const report: LocalMigrationReport = {
    attempted: enquiries.length,
    imported: 0,
    skipped: 0,
    failed: [],
    importedIds: [],
  };

  for (const enquiry of enquiries) {
    if (!enquiry?.id || !enquiry.customerName?.trim()) {
      report.skipped += 1;
      report.failed.push({
        id: enquiry?.id || "unknown",
        reason: "Missing enquiry id or customer name.",
      });
      continue;
    }

    const { data: existing } = await supabase
      .from("enquiries")
      .select("id")
      .eq("workspace_id", profile.workspace_id)
      .eq("id", enquiry.id)
      .maybeSingle();

    if (existing) {
      report.skipped += 1;
      continue;
    }

    const insertPayload = storedEnquiryToInsertPayload(
      enquiry,
      profile.workspace_id
    );
    const { error } = await supabase.from("enquiries").insert(insertPayload);

    if (error) {
      report.failed.push({ id: enquiry.id, reason: "Could not import enquiry." });
      continue;
    }

    if (enquiry.timeline?.length) {
      await supabase.from("enquiry_timeline_events").insert(
        enquiry.timeline.map((event) => ({
          id: event.id,
          workspace_id: profile.workspace_id,
          enquiry_id: enquiry.id,
          label: event.label,
          event_type: "migrated",
          occurred_at: event.at,
          created_by: user.id,
        }))
      );
    }

    const session = sessions[enquiry.id];
    if (enquiry.siteVisitSlot || enquiry.siteVisitStartsAt || session) {
      await supabase.from("site_visits").upsert(
        {
          workspace_id: profile.workspace_id,
          enquiry_id: enquiry.id,
          slot_label: enquiry.siteVisitSlot,
          starts_at: enquiry.siteVisitStartsAt,
          date_iso: enquiry.siteVisitStartsAt
            ? enquiry.siteVisitStartsAt.slice(0, 10)
            : null,
          started_at: session?.startedAt ?? null,
          completed_at: session?.completedAt ?? null,
          notes: session?.notes ?? "",
          measurements: session?.measurements ?? enquiry.measurements ?? [],
          checklist: session?.checklist ?? [],
          voice_notes: session?.voiceNotes ?? [],
        },
        { onConflict: "enquiry_id" }
      );
    }

    report.imported += 1;
    report.importedIds.push(enquiry.id);
  }

  return { ok: true, report };
}
