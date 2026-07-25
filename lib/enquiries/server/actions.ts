"use server";

import { createClient } from "@/lib/supabase/server";
import type { SiteVisitBookingInput } from "@/lib/enquiries/enquiry-store";
import {
  formatTimelineEnquiryDeclined,
  formatTimelineEnquiryReviewed,
  formatTimelineQuoteDraftSaved,
  formatTimelineQuotePreparationStarted,
  formatTimelineSiteVisitBooked,
  formatTimelineSiteVisitCompleted,
} from "@/lib/enquiries/timeline-messages";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import {
  buildSiteVisitPhotoPath,
  createPublicEnquirySlug,
  mapEnquiryRowToStoredEnquiry,
  mapSiteVisitRowToSession,
  SITE_VISIT_PHOTOS_BUCKET,
  type EnquiryMediaRow,
  type EnquiryRow,
  type EnquiryTimelineRow,
  type SiteVisitRow,
} from "@/lib/enquiries/server/types";
import type { SiteVisitSession } from "@/lib/site-visit/types";
import { createDefaultSiteVisitSession } from "@/lib/site-visit/site-visit-mode-data";

export type EnquiryActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireWorkspaceContext(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: { id: string };
      workspaceId: string;
      workspace: {
        id: string;
        business_name: string;
        phone: string | null;
        contact_email: string | null;
        trade_type: string | null;
        public_enquiry_slug: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.workspace_id) {
    return { ok: false, error: "Complete onboarding before managing enquiries." };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, business_name, phone, contact_email, trade_type, public_enquiry_slug")
    .eq("id", profile.workspace_id)
    .maybeSingle();

  if (!workspace) {
    return { ok: false, error: "Workspace not found." };
  }

  return {
    ok: true,
    supabase,
    user: { id: user.id },
    workspaceId: profile.workspace_id as string,
    workspace,
  };
}

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
      .eq("id", workspaceId);

    if (!error) {
      return slug;
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

  const [{ data: timeline }, { data: media }, { data: siteVisit }] =
    await Promise.all([
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
      supabase
        .from("site_visits")
        .select("*")
        .eq("enquiry_id", enquiryId)
        .maybeSingle(),
    ]);

  return mapEnquiryRowToStoredEnquiry(row as EnquiryRow, {
    timeline: (timeline ?? []) as EnquiryTimelineRow[],
    photos: (media ?? []) as EnquiryMediaRow[],
    siteVisit: (siteVisit as SiteVisitRow | null) ?? null,
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
      const [{ data: timeline }, { data: media }, { data: siteVisit }] =
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
          supabase
            .from("site_visits")
            .select("*")
            .eq("enquiry_id", row.id)
            .maybeSingle(),
        ]);

      return mapEnquiryRowToStoredEnquiry(row, {
        timeline: (timeline ?? []) as EnquiryTimelineRow[],
        photos: (media ?? []) as EnquiryMediaRow[],
        siteVisit: (siteVisit as SiteVisitRow | null) ?? null,
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

export async function bookSiteVisitAction(
  enquiryId: string,
  booking: SiteVisitBookingInput
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

  const { data: visit, error: visitError } = await supabase
    .from("site_visits")
    .upsert(
      {
        workspace_id: workspaceId,
        enquiry_id: enquiryId,
        slot_label: booking.slotLabel,
        starts_at: booking.startsAt,
        date_iso: booking.dateIso,
      },
      { onConflict: "enquiry_id" }
    )
    .select("*")
    .single();

  if (visitError || !visit) {
    return { ok: false, error: "Could not book the site visit." };
  }

  const { error } = await supabase
    .from("enquiries")
    .update({
      status: "site_visit_booked",
      suggested_next_action: "Open Site Visit Mode when you arrive on site.",
    })
    .eq("id", enquiryId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { ok: false, error: "Could not update enquiry status." };
  }

  await appendTimeline(
    supabase,
    workspaceId,
    enquiryId,
    formatTimelineSiteVisitBooked(booking.confirmationLine),
    "site_visit_booked",
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

export async function ensureSiteVisitAction(
  enquiryId: string
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

  const { data: existing } = await supabase
    .from("site_visits")
    .select("*")
    .eq("enquiry_id", enquiryId)
    .maybeSingle();

  if (existing) {
    if (!existing.started_at) {
      await supabase
        .from("site_visits")
        .update({ started_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    const { data: media } = await supabase
      .from("enquiry_media")
      .select("*")
      .eq("site_visit_id", existing.id);

    const session = mapSiteVisitRowToSession(
      existing as SiteVisitRow,
      (media ?? []) as EnquiryMediaRow[]
    );
    return { ok: true, data: { ...session, id: existing.id } };
  }

  const defaults = createDefaultSiteVisitSession(enquiryId);
  const { data: created, error } = await supabase
    .from("site_visits")
    .insert({
      workspace_id: workspaceId,
      enquiry_id: enquiryId,
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
  >
): Promise<EnquiryActionResult<SiteVisitSession & { id: string }>> {
  const ensured = await ensureSiteVisitAction(enquiryId);
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
  enquiryId: string
): Promise<EnquiryActionResult<StoredEnquiry>> {
  const ensured = await ensureSiteVisitAction(enquiryId);
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
  enquiryId: string
): Promise<EnquiryActionResult<(SiteVisitSession & { id: string }) | null>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("site_visits")
    .select("*")
    .eq("enquiry_id", enquiryId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Could not load site visit." };
  }

  if (!data) {
    return { ok: true, data: null };
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

  const { data, error } = await context.supabase
    .from("site_visits")
    .select(
      "id, enquiry_id, slot_label, starts_at, date_iso, enquiries(customer_name, address_line_1, town, postcode)"
    )
    .eq("workspace_id", context.workspaceId)
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

  const { error: uploadError } = await context.supabase.storage
    .from(SITE_VISIT_PHOTOS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "image/jpeg",
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
    file_name: file.name || `${mediaId}.jpg`,
    mime_type: file.type || "image/jpeg",
    byte_size: file.size,
    storage_path: storagePath,
    captured_at: new Date().toISOString(),
  });

  if (insertError) {
    await context.supabase.storage
      .from(SITE_VISIT_PHOTOS_BUCKET)
      .remove([storagePath]);
    return { ok: false, error: "Could not save photo details." };
  }

  return {
    ok: true,
    data: { id: mediaId, storagePath, fileName: file.name },
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
    const path = `/request-quote/w/${slug}`;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    return { ok: true, data: { slug, path, url: `${siteUrl}${path}` } };
  } catch {
    return { ok: false, error: "Could not create public enquiry link." };
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
