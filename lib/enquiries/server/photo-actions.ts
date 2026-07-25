"use server";

import {
  buildSiteVisitPhotoPath,
  SITE_VISIT_PHOTOS_BUCKET,
  type EnquiryActionResult,
} from "@/lib/enquiries/server/types";
import {
  mapMediaRowToServerDisplay,
  mapMediaRowToUnavailableDisplay,
  signedUrlExpiresAtFromNow,
  SITE_VISIT_PHOTO_SIGNED_URL_SECONDS,
  type EnquiryMediaForDisplay,
  type EnquiryPhotoDisplayItem,
} from "@/lib/enquiries/server/photo-display";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";

async function loadWorkspaceEnquiryMedia(
  enquiryId: string
): Promise<
  EnquiryActionResult<{
    rows: EnquiryMediaForDisplay[];
    context: Extract<
      Awaited<ReturnType<typeof requireWorkspaceContext>>,
      { ok: true }
    >;
  }>
> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { data: enquiry, error: enquiryError } = await context.supabase
    .from("enquiries")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("id", enquiryId)
    .is("archived_at", null)
    .maybeSingle();

  if (enquiryError || !enquiry) {
    return { ok: false, error: "Enquiry not found." };
  }

  const { data: media, error: mediaError } = await context.supabase
    .from("enquiry_media")
    .select(
      "id, enquiry_id, site_visit_id, file_name, mime_type, byte_size, storage_path, captured_at, created_at, sort_order"
    )
    .eq("workspace_id", context.workspaceId)
    .eq("enquiry_id", enquiryId)
    .eq("kind", "photo")
    .order("sort_order", { ascending: true })
    .order("captured_at", { ascending: true });

  if (mediaError) {
    return { ok: false, error: "Could not load photos." };
  }

  return {
    ok: true,
    data: {
      rows: (media ?? []) as EnquiryMediaForDisplay[],
      context,
    },
  };
}

async function signMediaRow(
  supabase: Extract<
    Awaited<ReturnType<typeof requireWorkspaceContext>>,
    { ok: true }
  >["supabase"],
  row: EnquiryMediaForDisplay
): Promise<EnquiryPhotoDisplayItem> {
  const { data, error } = await supabase.storage
    .from(SITE_VISIT_PHOTOS_BUCKET)
    .createSignedUrl(row.storage_path, SITE_VISIT_PHOTO_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return mapMediaRowToUnavailableDisplay(row);
  }

  return mapMediaRowToServerDisplay(
    row,
    data.signedUrl,
    signedUrlExpiresAtFromNow(SITE_VISIT_PHOTO_SIGNED_URL_SECONDS)
  );
}

export async function listEnquiryPhotoDisplaysAction(
  enquiryId: string
): Promise<EnquiryActionResult<EnquiryPhotoDisplayItem[]>> {
  const loaded = await loadWorkspaceEnquiryMedia(enquiryId);
  if (!loaded.ok) {
    return loaded;
  }

  const items = await Promise.all(
    loaded.data.rows.map((row) => signMediaRow(loaded.data.context.supabase, row))
  );

  return { ok: true, data: items };
}

export async function refreshEnquiryPhotoSignedUrlAction(
  mediaId: string
): Promise<EnquiryActionResult<EnquiryPhotoDisplayItem>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { data: row, error } = await context.supabase
    .from("enquiry_media")
    .select(
      "id, enquiry_id, site_visit_id, file_name, mime_type, byte_size, storage_path, captured_at, created_at, sort_order"
    )
    .eq("workspace_id", context.workspaceId)
    .eq("id", mediaId)
    .eq("kind", "photo")
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "Photo not found." };
  }

  const display = await signMediaRow(
    context.supabase,
    row as EnquiryMediaForDisplay
  );

  if (display.storageSource === "unavailable") {
    return {
      ok: false,
      error: "Photo file is unavailable. It may have been removed from storage.",
    };
  }

  return { ok: true, data: display };
}

export async function deleteEnquiryPhotoAction(
  mediaId: string
): Promise<EnquiryActionResult<{ id: string; storageMissing: boolean }>> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { data: row, error } = await context.supabase
    .from("enquiry_media")
    .select("id, storage_path")
    .eq("workspace_id", context.workspaceId)
    .eq("id", mediaId)
    .eq("kind", "photo")
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "Photo not found." };
  }

  let storageMissing = false;
  const { error: storageError } = await context.supabase.storage
    .from(SITE_VISIT_PHOTOS_BUCKET)
    .remove([row.storage_path]);

  if (storageError) {
    // Object may already be gone — allow metadata cleanup below.
    storageMissing = true;
  }

  const { error: deleteError } = await context.supabase
    .from("enquiry_media")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", mediaId);

  if (deleteError) {
    return {
      ok: false,
      error: storageMissing
        ? "Could not remove photo details after the file was already missing."
        : "Could not delete photo details.",
    };
  }

  return { ok: true, data: { id: mediaId, storageMissing } };
}

/**
 * Uploads a local IndexedDB photo into private Storage using a stable media id
 * so retries do not create duplicates.
 */
export async function migrateLocalPhotoAction(formData: FormData): Promise<
  EnquiryActionResult<{
    id: string;
    skipped: boolean;
    storagePath: string;
  }>
> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const enquiryId = String(formData.get("enquiryId") ?? "").trim();
  const mediaId = String(formData.get("mediaId") ?? "").trim();
  const siteVisitId = String(formData.get("siteVisitId") ?? "").trim() || null;
  const file = formData.get("file");

  if (!enquiryId || !mediaId || !(file instanceof File)) {
    return { ok: false, error: "Photo migration is missing required fields." };
  }

  const { data: enquiry } = await context.supabase
    .from("enquiries")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("id", enquiryId)
    .maybeSingle();

  if (!enquiry) {
    return { ok: false, error: "Enquiry not found for photo migration." };
  }

  const { data: existing } = await context.supabase
    .from("enquiry_media")
    .select("id, storage_path")
    .eq("workspace_id", context.workspaceId)
    .eq("id", mediaId)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      data: {
        id: existing.id,
        skipped: true,
        storagePath: existing.storage_path,
      },
    };
  }

  let resolvedSiteVisitId = siteVisitId;
  if (!resolvedSiteVisitId) {
    const { data: visit } = await context.supabase
      .from("site_visits")
      .select("id")
      .eq("workspace_id", context.workspaceId)
      .eq("enquiry_id", enquiryId)
      .maybeSingle();
    resolvedSiteVisitId = visit?.id ?? null;
  }

  const extension = file.name.split(".").pop() || "jpg";
  const storagePath = buildSiteVisitPhotoPath({
    workspaceId: context.workspaceId,
    enquiryId,
    siteVisitId: resolvedSiteVisitId,
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
    // Race-safe: object may already exist from a previous partial attempt.
    const alreadyExists =
      /exists|duplicate|already/i.test(uploadError.message) ||
      uploadError.message.toLowerCase().includes("resource already");

    if (!alreadyExists) {
      return { ok: false, error: "Could not upload migrated photo." };
    }
  }

  const { error: insertError } = await context.supabase.from("enquiry_media").insert({
    id: mediaId,
    workspace_id: context.workspaceId,
    enquiry_id: enquiryId,
    site_visit_id: resolvedSiteVisitId,
    kind: "photo",
    file_name: file.name || `${mediaId}.jpg`,
    mime_type: file.type || "image/jpeg",
    byte_size: file.size,
    storage_path: storagePath,
    captured_at: new Date().toISOString(),
  });

  if (insertError) {
    const duplicate =
      insertError.code === "23505" ||
      /duplicate|unique/i.test(insertError.message);

    if (duplicate) {
      return {
        ok: true,
        data: { id: mediaId, skipped: true, storagePath },
      };
    }

    return { ok: false, error: "Could not save migrated photo details." };
  }

  return {
    ok: true,
    data: { id: mediaId, skipped: false, storagePath },
  };
}
