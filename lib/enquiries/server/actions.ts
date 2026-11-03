"use server";

import { createClient } from "@/lib/supabase/server";
import type { SiteVisitBookingInput } from "@/lib/enquiries/enquiry-store";
import {
  formatTimelineEnquiryDeclined,
  formatTimelineEnquiryReviewed,
  formatTimelineQuoteDraftSaved,
  formatTimelineQuotePreparationStarted,
  formatTimelineSiteVisitCompleted,
} from "@/lib/enquiries/timeline-messages";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import {
  buildSiteVisitPhotoPath,
  createPublicEnquirySlug,
  mapEnquiryRowToStoredEnquiry,
  mapSiteVisitRowToSession,
  SITE_VISIT_PHOTOS_BUCKET,
  type EnquiryActionResult,
  type EnquiryMediaRow,
  type EnquiryRow,
  type EnquiryTimelineRow,
  type SiteVisitRow,
} from "@/lib/enquiries/server/types";
import {
  mapMediaRowToServerDisplay,
  signedUrlExpiresAtFromNow,
  SITE_VISIT_PHOTO_SIGNED_URL_SECONDS,
} from "@/lib/enquiries/server/photo-display";
import {
  buildPublicEnquiryPath,
  buildPublicEnquiryUrl,
} from "@/lib/enquiries/public-link";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import type { SiteVisitSession } from "@/lib/site-visit/types";
import { createDefaultSiteVisitSession } from "@/lib/site-visit/site-visit-mode-data";
import { loadPrimarySiteVisitForEnquiry } from "@/lib/enquiries/server/load-enquiry-site-visit";
import {
  findActiveVisitForEnquiry,
  linkCaptureSessionToVisit,
  listVisitsForEnquiry,
} from "@/lib/visits/link-capture-session";


async function ensurePublicEnquirySlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  currentSlug: string | null
): Promise<string> {
  if (currentSlug?.trim()) {
    return currentSlug.trim();
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = createPublicEnquirySlug();
    const { error } = await supabase
      .from("workspaces")
      .update({ public_enquiry_slug: slug })
      .eq("id", workspaceId)
      .is("public_enquiry_slug", null);

    if (!error) {
      const { data: refreshed } = await supabase
        .from("workspaces")
        .select("public_enquiry_slug")
        .eq("id", workspaceId)
        .maybeSingle();
      if (refreshed?.public_enquiry_slug?.trim()) {
        return refreshed.public_enquiry_slug.trim();
      }
      return slug;
    }

    // Another request may have set the slug — prefer the workspace value.
    const { data: existing } = await supabase
      .from("workspaces")
      .select("public_enquiry_slug")
      .eq("id", workspaceId)
      .maybeSingle();
    if (existing?.public_enquiry_slug?.trim()) {
      return existing.public_enquiry_slug.trim();
    }
  }

  throw new Error("Could not create a public enquiry link.");
}

async function loadEnquiryBundle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  enquiryId: string,
  workspace: {
    business_name: string | null;
    phone: string | null;
    contact_email: string | null;
  }
): Promise<StoredEnquiry | null> {
  const { data: row, error } = await supabase
    .from("enquiries")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", enquiryId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !row) {
    return null;
  }

  const [{ data: timeline }, { data: media }, siteVisit] = await Promise.all([
    supabase
      .from("enquiry_timeline_events")
      .select("*")
      .eq("enquiry_id", enquiryId)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("enquiry_media")
      .select("*")
      .eq("enquiry_id", enquiryId)
      .order("sort_order", { ascending: true }),
    loadPrimarySiteVisitForEnquiry(supabase, workspaceId, enquiryId),
  ]);

  return mapEnquiryRowToStoredEnquiry(row as EnquiryRow, {
    timeline: (timeline ?? []) as EnquiryTimelineRow[],
    photos: (media ?? []) as EnquiryMediaRow[],
    siteVisit,
    workspace: {
      businessName: workspace.business_name,
      phone: workspace.phone,
      contactEmail: workspace.contact_email,
    },
  });
}

export async function listWorkspaceEnquiries(): Promise<
  EnquiryActionResult<StoredEnquiry[]>
> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { supabase, workspaceId, workspace } = context;

  const { data: rows, error } = await supabase
    .from("enquiries")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("received_at", { ascending: false });

  if (error) {
    return { ok: false, error: "Could not load enquiries." };
  }

  const enquiries = await Promise.all(
    (rows as EnquiryRow[]).map(async (row) => {
      const [{ data: timeline }, { data: media }, siteVisit] =
        await Promise.all([
          supabase
            .from("enquiry_timeline_events")
            .select("*")
            .eq("enquiry_id", row.id)
            .order("occurred_at", { ascending: true }),
          supabase
            .from("enquiry_media")
            .select("*")
            .eq("enquiry_id", row.id)
            .order("sort_order", { ascending: true }),
          loadPrimarySiteVisitForEnquiry(supabase, workspaceId, row.id),
        ]);

      return mapEnquiryRowToStoredEnquiry(row, {
        timeline: (timeline ?? []) as EnquiryTimelineRow[],
        photos: (media ?? []) as EnquiryMediaRow[],
        siteVisit,
        workspace: {
          businessName: workspace.business_name,
          phone: workspace.phone,
          contactEmail: workspace.contact_email,
        },
      });
    })
  );

  return { ok: true, data: enquiries };
}

export async function getWorkspaceEnquiry(
  enquiryId: string
): Promise<EnquiryActionResult<StoredEnquiry>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const enquiry = await loadEnquiryBundle(
    context.supabase,
    context.workspaceId,
    enquiryId,
    context.workspace
  );

  if (!enquiry) {
    return { ok: false, error: "Enquiry not found." };
  }

  return { ok: true, data: enquiry };
}

async function appendTimeline(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  enquiryId: string,
  label: string,
  eventType: string,
  userId?: string
): Promise<void> {
  await supabase.from("enquiry_timeline_events").insert({
    workspace_id: workspaceId,
    enquiry_id: enquiryId,
    label,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    created_by: userId ?? null,
  });
}

export async function markEnquiryReviewingAction(
  enquiryId: string
): Promise<EnquiryActionResult<StoredEnquiry>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { supabase, workspaceId, workspace, user } = context;
  const existing = await loadEnquiryBundle(
    supabase,
    workspaceId,
    enquiryId,
    workspace
  );
  if (!existing) {
    return { ok: false, error: "Enquiry not found." };
  }

  if (existing.status === "new") {
    const { error } = await supabase
      .from("enquiries")
      .update({
        status: "reviewing",
        suggested_next_action:
          "Ask a question or book a site visit when you are ready.",
      })
      .eq("id", enquiryId)
      .eq("workspace_id", workspaceId);

    if (error) {
      return { ok: false, error: "Could not update enquiry." };
    }

    await appendTimeline(
      supabase,
      workspaceId,
      enquiryId,
      formatTimelineEnquiryReviewed(existing.customerName),
      "enquiry_reviewed",
      user.id
    );
  }

  const refreshed = await loadEnquiryBundle(
    supabase,
    workspaceId,
    enquiryId,
    workspace
  );
  return refreshed
    ? { ok: true, data: refreshed }
    : { ok: false, error: "Enquiry not found." };
}

export async function declineEnquiryAction(
  enquiryId: string
): Promise<EnquiryActionResult<StoredEnquiry>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { supabase, workspaceId, workspace, user } = context;
  const { error } = await supabase
    .from("enquiries")
    .update({
      status: "declined",
      suggested_next_action: "This enquiry was declined.",
    })
    .eq("id", enquiryId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { ok: false, error: "Could not decline enquiry." };
  }

  await appendTimeline(
    supabase,
    workspaceId,
    enquiryId,
    formatTimelineEnquiryDeclined(),
    "enquiry_declined",
    user.id
  );

  const refreshed = await loadEnquiryBundle(
    supabase,
    workspaceId,
    enquiryId,
    workspace
  );
  return refreshed
    ? { ok: true, data: refreshed }
    : { ok: false, error: "Enquiry not found." };
}

export async function deleteEnquiryAction(
  enquiryId: string
): Promise<EnquiryActionResult<true>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { supabase, workspaceId } = context;

  const { data: media } = await supabase
    .from("enquiry_media")
    .select("storage_path")
    .eq("enquiry_id", enquiryId)
    .eq("workspace_id", workspaceId);

  if (media?.length) {
    await supabase.storage
      .from(SITE_VISIT_PHOTOS_BUCKET)
      .remove(media.map((item) => item.storage_path));
  }

  const { error } = await supabase
    .from("enquiries")
    .delete()
    .eq("id", enquiryId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { ok: false, error: "Could not delete enquiry." };
  }

  return { ok: true, data: true };
}

/**
 * @deprecated Milestone 2 — booking writes go through createVisitAction /visits/new.
 * Kept as a hard stop so the old enquiry-card dialog cannot create parallel site_visits bookings.
 */
export async function bookSiteVisitAction(
  enquiryId: string,
  _booking: SiteVisitBookingInput
): Promise<EnquiryActionResult<StoredEnquiry>> {
  void enquiryId;
  void _booking;
  return {
    ok: false,
    error:
      "Site visits are booked from Visits now. Open Book visit on the enquiry to continue.",
  };
}

async function loadSiteVisitSessionById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  siteVisitId: string
): Promise<(SiteVisitSession & { id: string }) | null> {
  const { data: row } = await supabase
    .from("site_visits")
    .select("*")
    .eq("id", siteVisitId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!row) {
    return null;
  }

  const { data: media } = await supabase
    .from("enquiry_media")
    .select("*")
    .eq("site_visit_id", row.id);

  return {
    ...mapSiteVisitRowToSession(
      row as SiteVisitRow,
      (media ?? []) as EnquiryMediaRow[]
    ),
    id: row.id,
  };
}

/**
 * Ensure / open the capture session for a booking visit (preferred) or enquiry.
 * Pass visitId so Site Visit Mode uses that appointment's own notes/photos.
 */
export async function ensureSiteVisitAction(
  enquiryId: string,
  visitId?: string | null
): Promise<EnquiryActionResult<SiteVisitSession & { id: string }>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { supabase, workspaceId, workspace } = context;
  const enquiry = await loadEnquiryBundle(
    supabase,
    workspaceId,
    enquiryId,
    workspace
  );
  if (!enquiry) {
    return { ok: false, error: "Enquiry not found." };
  }

  let targetVisit: {
    id: string;
    slot_label: string | null;
    starts_at: string | null;
    visit_date: string;
  } | null = null;

  if (visitId) {
    const { data: visitRow } = await supabase
      .from("visits")
      .select("id, slot_label, starts_at, visit_date, enquiry_id")
      .eq("id", visitId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!visitRow || visitRow.enquiry_id !== enquiryId) {
      return {
        ok: false,
        error: "Visit not found for this enquiry.",
      };
    }

    targetVisit = {
      id: visitRow.id,
      slot_label: (visitRow.slot_label as string | null) ?? null,
      starts_at: (visitRow.starts_at as string | null) ?? null,
      visit_date: String(visitRow.visit_date ?? ""),
    };
  } else {
    targetVisit = await findActiveVisitForEnquiry(
      supabase,
      workspaceId,
      enquiryId
    );
  }

  if (targetVisit) {
    const linked = await linkCaptureSessionToVisit(supabase, {
      workspaceId,
      visitId: targetVisit.id,
      enquiryId,
      slotLabel: targetVisit.slot_label,
      startsAt: targetVisit.starts_at,
      visitDate: targetVisit.visit_date,
    });
    if (!linked.ok) {
      return { ok: false, error: linked.error };
    }

    await supabase
      .from("site_visits")
      .update({
        started_at: new Date().toISOString(),
      })
      .eq("id", linked.siteVisitId)
      .eq("workspace_id", workspaceId)
      .is("started_at", null);

    const session = await loadSiteVisitSessionById(
      supabase,
      workspaceId,
      linked.siteVisitId
    );
    if (!session) {
      return { ok: false, error: "Could not start site visit." };
    }
    return { ok: true, data: session };
  }

  // Compatibility: historical enquiry with no visits booking yet.
  // Prefer an existing unlinked capture — do not invent a public.visits booking.
  const existingHistorical = await loadPrimarySiteVisitForEnquiry(
    supabase,
    workspaceId,
    enquiryId
  );

  if (existingHistorical) {
    if (!existingHistorical.started_at) {
      await supabase
        .from("site_visits")
        .update({ started_at: new Date().toISOString() })
        .eq("id", existingHistorical.id)
        .eq("workspace_id", workspaceId);
    }

    const session = await loadSiteVisitSessionById(
      supabase,
      workspaceId,
      existingHistorical.id
    );
    if (!session) {
      return { ok: false, error: "Could not start site visit." };
    }
    return { ok: true, data: session };
  }

  const defaults = createDefaultSiteVisitSession(enquiryId);
  const { data: created, error } = await supabase
    .from("site_visits")
    .insert({
      workspace_id: workspaceId,
      enquiry_id: enquiryId,
      visit_id: null,
      started_at: defaults.startedAt,
      notes: defaults.notes,
      measurements: defaults.measurements,
      checklist: defaults.checklist,
      voice_notes: defaults.voiceNotes,
      slot_label: enquiry.siteVisitSlot,
      starts_at: enquiry.siteVisitStartsAt,
    })
    .select("*")
    .single();

  if (error || !created) {
    return { ok: false, error: "Could not start site visit." };
  }

  // Unlinked captures are inventoried by migration/audit SQL (server-only table).
  // Do not write site_visits_historical_review from authenticated client sessions.

  return {
    ok: true,
    data: { ...mapSiteVisitRowToSession(created as SiteVisitRow), id: created.id },
  };
}

export async function saveSiteVisitAction(
  enquiryId: string,
  patch: Partial<
    Pick<
      SiteVisitSession,
      "notes" | "measurements" | "checklist" | "voiceNotes"
    >
  >,
  visitId?: string | null
): Promise<EnquiryActionResult<SiteVisitSession & { id: string }>> {
  const ensured = await ensureSiteVisitAction(enquiryId, visitId);
  if (!ensured.ok) {
    return ensured;
  }

  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const update: Record<string, unknown> = {};
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.measurements !== undefined) update.measurements = patch.measurements;
  if (patch.checklist !== undefined) update.checklist = patch.checklist;
  if (patch.voiceNotes !== undefined) update.voice_notes = patch.voiceNotes;

  const { data, error } = await context.supabase
    .from("site_visits")
    .update(update)
    .eq("id", ensured.data.id)
    .eq("workspace_id", context.workspaceId)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not save site visit." };
  }

  const { data: media } = await context.supabase
    .from("enquiry_media")
    .select("*")
    .eq("site_visit_id", data.id);

  return {
    ok: true,
    data: {
      ...mapSiteVisitRowToSession(
        data as SiteVisitRow,
        (media ?? []) as EnquiryMediaRow[]
      ),
      id: data.id,
    },
  };
}

export async function completeSiteVisitAction(
  enquiryId: string,
  visitId?: string | null
): Promise<EnquiryActionResult<StoredEnquiry>> {
  const ensured = await ensureSiteVisitAction(enquiryId, visitId);
  if (!ensured.ok) {
    return { ok: false, error: ensured.error };
  }

  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { supabase, workspaceId, workspace, user } = context;
  const completedAt = new Date().toISOString();

  await supabase
    .from("site_visits")
    .update({ completed_at: completedAt })
    .eq("id", ensured.data.id)
    .eq("workspace_id", workspaceId);

  if (visitId) {
    await supabase
      .from("visits")
      .update({ status: "completed" })
      .eq("id", visitId)
      .eq("workspace_id", workspaceId)
      .eq("enquiry_id", enquiryId)
      .in("status", ["scheduled", "confirmed"]);
  } else {
    const linkedVisit = await findActiveVisitForEnquiry(
      supabase,
      workspaceId,
      enquiryId
    );
    if (linkedVisit) {
      await supabase
        .from("visits")
        .update({ status: "completed" })
        .eq("id", linkedVisit.id)
        .eq("workspace_id", workspaceId)
        .in("status", ["scheduled", "confirmed"]);
    }
  }

  await supabase
    .from("enquiries")
    .update({
      status: "site_visit_completed",
      suggested_next_action: "Prepare a quote from the site visit notes.",
    })
    .eq("id", enquiryId)
    .eq("workspace_id", workspaceId);

  await appendTimeline(
    supabase,
    workspaceId,
    enquiryId,
    formatTimelineSiteVisitCompleted(),
    "site_visit_completed",
    user.id
  );

  const refreshed = await loadEnquiryBundle(
    supabase,
    workspaceId,
    enquiryId,
    workspace
  );
  return refreshed
    ? { ok: true, data: refreshed }
    : { ok: false, error: "Enquiry not found." };
}

export async function markQuotePreparationStartedAction(
  enquiryId: string
): Promise<EnquiryActionResult<StoredEnquiry>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { supabase, workspaceId, workspace, user } = context;
  await appendTimeline(
    supabase,
    workspaceId,
    enquiryId,
    formatTimelineQuotePreparationStarted(),
    "quote_preparation_started",
    user.id
  );

  const refreshed = await loadEnquiryBundle(
    supabase,
    workspaceId,
    enquiryId,
    workspace
  );
  return refreshed
    ? { ok: true, data: refreshed }
    : { ok: false, error: "Enquiry not found." };
}

export async function markQuoteInPreparationAction(
  enquiryId: string,
  draftId: string
): Promise<EnquiryActionResult<StoredEnquiry>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { supabase, workspaceId, workspace, user } = context;
  const { error } = await supabase
    .from("enquiries")
    .update({
      status: "quote_in_preparation",
      linked_proposal_draft_id: draftId,
      suggested_next_action: "Continue preparing the quote, then create a real proposal.",
    })
    .eq("id", enquiryId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { ok: false, error: "Could not update enquiry." };
  }

  await appendTimeline(
    supabase,
    workspaceId,
    enquiryId,
    formatTimelineQuoteDraftSaved(),
    "quote_draft_saved",
    user.id
  );

  const refreshed = await loadEnquiryBundle(
    supabase,
    workspaceId,
    enquiryId,
    workspace
  );
  return refreshed
    ? { ok: true, data: refreshed }
    : { ok: false, error: "Enquiry not found." };
}

export async function getSiteVisitForEnquiryAction(
  enquiryId: string,
  visitId?: string | null
): Promise<EnquiryActionResult<(SiteVisitSession & { id: string }) | null>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  if (visitId) {
    // Ownership + association: visit must belong to this workspace and enquiry.
    const { data: visitRow, error: visitError } = await context.supabase
      .from("visits")
      .select("id, enquiry_id")
      .eq("id", visitId)
      .eq("workspace_id", context.workspaceId)
      .maybeSingle();

    if (visitError) {
      return { ok: false, error: "Could not load visit." };
    }
    if (!visitRow) {
      return { ok: false, error: "Visit not found in this workspace." };
    }
    if (visitRow.enquiry_id && visitRow.enquiry_id !== enquiryId) {
      return {
        ok: false,
        error: "That visit does not belong to this enquiry.",
      };
    }
    if (!visitRow.enquiry_id) {
      return {
        ok: false,
        error: "That visit is not linked to an enquiry.",
      };
    }

    const { data, error } = await context.supabase
      .from("site_visits")
      .select("*")
      .eq("workspace_id", context.workspaceId)
      .eq("enquiry_id", enquiryId)
      .eq("visit_id", visitId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: "Could not load site visit." };
    }
    // Missing capture for this visit → empty (do not fall back to another visit).
    if (!data) {
      return { ok: true, data: null };
    }

    const { data: media } = await context.supabase
      .from("enquiry_media")
      .select("*")
      .eq("workspace_id", context.workspaceId)
      .eq("site_visit_id", data.id);

    return {
      ok: true,
      data: {
        ...mapSiteVisitRowToSession(
          data as SiteVisitRow,
          (media ?? []) as EnquiryMediaRow[]
        ),
        id: data.id,
      },
    };
  }

  const data = await loadPrimarySiteVisitForEnquiry(
    context.supabase,
    context.workspaceId,
    enquiryId
  );

  if (!data) {
    return { ok: true, data: null };
  }

  const { data: media } = await context.supabase
    .from("enquiry_media")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("site_visit_id", data.id);

  return {
    ok: true,
    data: {
      ...mapSiteVisitRowToSession(
        data as SiteVisitRow,
        (media ?? []) as EnquiryMediaRow[]
      ),
      id: data.id,
    },
  };
}

export async function listEnquiryVisitsAction(
  enquiryId: string
): Promise<
  EnquiryActionResult<
    Array<{
      id: string;
      visit_type: string;
      visit_date: string;
      visit_time: string | null;
      status: string;
      slot_label: string | null;
    }>
  >
> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { data: enquiry } = await context.supabase
    .from("enquiries")
    .select("id")
    .eq("id", enquiryId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();

  if (!enquiry) {
    return { ok: false, error: "Enquiry not found." };
  }

  const visits = await listVisitsForEnquiry(
    context.supabase,
    context.workspaceId,
    enquiryId
  );
  return { ok: true, data: visits };
}

export async function listSiteVisitCalendarJobsAction(): Promise<
  EnquiryActionResult<
    Array<{
      id: string;
      enquiryId: string;
      title: string;
      customerName: string;
      address: string;
      startsAt: string;
      dateIso: string;
      slotLabel: string;
      status: "site_visit_booked";
    }>
  >
> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  // Only orphan capture rows (no visits booking link) — linked rows appear via visits feed.
  const { data, error } = await context.supabase
    .from("site_visits")
    .select(
      "id, enquiry_id, slot_label, starts_at, date_iso, visit_id, enquiries(customer_name, address_line_1, town, postcode)"
    )
    .eq("workspace_id", context.workspaceId)
    .is("visit_id", null)
    .not("starts_at", "is", null);

  if (error) {
    return { ok: false, error: "Could not load calendar site visits." };
  }

  const jobs = (data ?? [])
    .map((row) => {
      const enquiry = Array.isArray(row.enquiries)
        ? row.enquiries[0]
        : row.enquiries;
      if (!row.starts_at || !enquiry) {
        return null;
      }

      const address = [enquiry.address_line_1, enquiry.town, enquiry.postcode]
        .filter(Boolean)
        .join(", ");

      return {
        id: row.id,
        enquiryId: row.enquiry_id,
        title: `Site visit — ${enquiry.customer_name}`,
        customerName: enquiry.customer_name,
        address,
        startsAt: row.starts_at,
        dateIso: row.date_iso ?? row.starts_at.slice(0, 10),
        slotLabel: row.slot_label ?? "Site visit",
        status: "site_visit_booked" as const,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    enquiryId: string;
    title: string;
    customerName: string;
    address: string;
    startsAt: string;
    dateIso: string;
    slotLabel: string;
    status: "site_visit_booked";
  }>;

  return { ok: true, data: jobs };
}

export async function uploadSiteVisitPhotoAction(formData: FormData): Promise<
  EnquiryActionResult<{
    id: string;
    storagePath: string;
    fileName: string;
    display: ReturnType<typeof mapMediaRowToServerDisplay> | null;
  }>
> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const enquiryId = String(formData.get("enquiryId") ?? "").trim();
  const siteVisitId = String(formData.get("siteVisitId") ?? "").trim() || null;
  const file = formData.get("file");

  if (!enquiryId || !(file instanceof File)) {
    return { ok: false, error: "Photo upload is missing required fields." };
  }

  const { data: enquiry } = await context.supabase
    .from("enquiries")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("id", enquiryId)
    .is("archived_at", null)
    .maybeSingle();

  if (!enquiry) {
    return { ok: false, error: "Enquiry not found." };
  }

  const ensured = siteVisitId
    ? { ok: true as const, data: { id: siteVisitId } }
    : await ensureSiteVisitAction(enquiryId);

  if (!ensured.ok) {
    return { ok: false, error: ensured.error };
  }

  const mediaId = crypto.randomUUID();
  const extension = file.name.split(".").pop() || "jpg";
  const storagePath = buildSiteVisitPhotoPath({
    workspaceId: context.workspaceId,
    enquiryId,
    siteVisitId: ensured.data.id,
    mediaId,
    extension,
  });
  const capturedAt = new Date().toISOString();
  const fileName = file.name || `${mediaId}.jpg`;
  const mimeType = file.type || "image/jpeg";

  const { error: uploadError } = await context.supabase.storage
    .from(SITE_VISIT_PHOTOS_BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: "Could not upload photo." };
  }

  const { error: insertError } = await context.supabase.from("enquiry_media").insert({
    id: mediaId,
    workspace_id: context.workspaceId,
    enquiry_id: enquiryId,
    site_visit_id: ensured.data.id,
    kind: "photo",
    file_name: fileName,
    mime_type: mimeType,
    byte_size: file.size,
    storage_path: storagePath,
    captured_at: capturedAt,
  });

  if (insertError) {
    await context.supabase.storage
      .from(SITE_VISIT_PHOTOS_BUCKET)
      .remove([storagePath]);
    return {
      ok: false,
      error:
        "Photo file uploaded, but details could not be saved. The file was removed — please try again.",
    };
  }

  const { data: signed, error: signedError } = await context.supabase.storage
    .from(SITE_VISIT_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, SITE_VISIT_PHOTO_SIGNED_URL_SECONDS);

  const display =
    !signedError && signed?.signedUrl
      ? mapMediaRowToServerDisplay(
          {
            id: mediaId,
            enquiry_id: enquiryId,
            site_visit_id: ensured.data.id,
            file_name: fileName,
            mime_type: mimeType,
            byte_size: file.size,
            storage_path: storagePath,
            captured_at: capturedAt,
            created_at: capturedAt,
            sort_order: 0,
          },
          signed.signedUrl,
          signedUrlExpiresAtFromNow(SITE_VISIT_PHOTO_SIGNED_URL_SECONDS)
        )
      : null;

  return {
    ok: true,
    data: { id: mediaId, storagePath, fileName, display },
  };
}

export async function getOrCreatePublicEnquiryLinkAction(): Promise<
  EnquiryActionResult<{ slug: string; path: string; url: string }>
> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  try {
    const slug = await ensurePublicEnquirySlug(
      context.supabase,
      context.workspaceId,
      context.workspace.public_enquiry_slug
    );
    const path = buildPublicEnquiryPath(slug);
    return { ok: true, data: { slug, path, url: buildPublicEnquiryUrl(slug) } };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Could not create public enquiry link.";
    return { ok: false, error: message };
  }
}

export async function appendEnquiryTimelineAction(
  enquiryId: string,
  label: string,
  eventType: string
): Promise<EnquiryActionResult<true>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  await appendTimeline(
    context.supabase,
    context.workspaceId,
    enquiryId,
    label,
    eventType,
    context.user.id
  );

  return { ok: true, data: true };
}
