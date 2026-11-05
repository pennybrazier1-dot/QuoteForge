/**
 * Workspace business logo storage.
 *
 * Reuses the private `site-visit-photos` bucket (workspace-scoped RLS already
 * keys on the first path folder = workspace_id). Path convention:
 *   {workspace_id}/branding/logo.{jpg|png|webp}
 *
 * No public URLs or service-role keys are exposed to the browser.
 * PDF/email paths download or sign server-side.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const WORKSPACE_LOGO_BUCKET = "site-visit-photos";
export const WORKSPACE_LOGO_FOLDER = "branding";
export const WORKSPACE_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const WORKSPACE_LOGO_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type WorkspaceLogoMime = (typeof WORKSPACE_LOGO_ALLOWED_MIME)[number];

const MIME_TO_EXT: Record<WorkspaceLogoMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function workspaceLogoObjectPath(
  workspaceId: string,
  extension: string
): string {
  return `${workspaceId}/${WORKSPACE_LOGO_FOLDER}/logo.${extension}`;
}

export function workspaceLogoFolderPrefix(workspaceId: string): string {
  return `${workspaceId}/${WORKSPACE_LOGO_FOLDER}`;
}

function sniffLogoMime(bytes: Uint8Array): WorkspaceLogoMime | null {
  if (bytes.length < 12) {
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type ValidateLogoResult =
  | {
      ok: true;
      mimeType: WorkspaceLogoMime;
      extension: string;
      bytes: Uint8Array;
      byteSize: number;
    }
  | { ok: false; error: string };

export async function validateWorkspaceLogoFile(
  file: File
): Promise<ValidateLogoResult> {
  if (!(file instanceof File)) {
    return { ok: false, error: "That file could not be read." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "That logo file is empty." };
  }
  if (file.size > WORKSPACE_LOGO_MAX_BYTES) {
    return { ok: false, error: "Logo must be 2 MB or smaller." };
  }

  const declared = (file.type || "").trim().toLowerCase();
  if (
    declared &&
    declared !== "application/octet-stream" &&
    !(WORKSPACE_LOGO_ALLOWED_MIME as readonly string[]).includes(declared)
  ) {
    return { ok: false, error: "Only JPEG, PNG or WebP logos are accepted." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffLogoMime(bytes);
  if (!sniffed) {
    return {
      ok: false,
      error: "That file does not look like a supported logo image.",
    };
  }
  if (
    declared &&
    (WORKSPACE_LOGO_ALLOWED_MIME as readonly string[]).includes(declared) &&
    declared !== sniffed
  ) {
    return {
      ok: false,
      error: "That logo’s file type does not match its contents.",
    };
  }

  return {
    ok: true,
    mimeType: sniffed,
    extension: MIME_TO_EXT[sniffed],
    bytes,
    byteSize: file.size,
  };
}

export async function listWorkspaceLogoPaths(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string[]> {
  if (!supabase.storage?.from) {
    return [];
  }
  const { data, error } = await supabase.storage
    .from(WORKSPACE_LOGO_BUCKET)
    .list(workspaceLogoFolderPrefix(workspaceId), { limit: 20 });
  if (error || !data) {
    return [];
  }
  return data
    .filter((entry) => /^logo\.(jpg|jpeg|png|webp)$/i.test(entry.name))
    .map((entry) => `${workspaceLogoFolderPrefix(workspaceId)}/${entry.name}`);
}

export async function deleteWorkspaceLogos(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ error?: string }> {
  const paths = await listWorkspaceLogoPaths(supabase, workspaceId);
  if (paths.length === 0) {
    return {};
  }
  const { error } = await supabase.storage
    .from(WORKSPACE_LOGO_BUCKET)
    .remove(paths);
  if (error) {
    return { error: error.message || "Could not remove the existing logo." };
  }
  return {};
}

export async function uploadWorkspaceLogo(
  supabase: SupabaseClient,
  workspaceId: string,
  file: File
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const validation = await validateWorkspaceLogoFile(file);
  if (!validation.ok) {
    return validation;
  }

  const clear = await deleteWorkspaceLogos(supabase, workspaceId);
  if (clear.error) {
    return { ok: false, error: clear.error };
  }

  const path = workspaceLogoObjectPath(workspaceId, validation.extension);
  const { error } = await supabase.storage
    .from(WORKSPACE_LOGO_BUCKET)
    .upload(path, validation.bytes, {
      contentType: validation.mimeType,
      upsert: true,
    });
  if (error) {
    return { ok: false, error: error.message || "Could not upload the logo." };
  }
  return { ok: true, path };
}

export async function downloadStorageObjectBytes(
  supabase: SupabaseClient,
  objectPath: string
): Promise<Buffer | null> {
  if (!supabase.storage?.from || !objectPath.trim()) {
    return null;
  }
  const { data, error } = await supabase.storage
    .from(WORKSPACE_LOGO_BUCKET)
    .download(objectPath);
  if (error || !data) {
    return null;
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function downloadWorkspaceLogoBytes(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<Buffer | null> {
  const paths = await listWorkspaceLogoPaths(supabase, workspaceId);
  const path = paths[0];
  if (!path) {
    return null;
  }
  return downloadStorageObjectBytes(supabase, path);
}

/** Immutable approve-time copy under the same workspace-scoped bucket. */
export function invoiceLogoSnapshotObjectPath(
  workspaceId: string,
  invoiceId: string,
  extension: string
): string {
  return `${workspaceId}/invoice-branding/${invoiceId}/logo.${extension}`;
}

/**
 * Copy the current workspace logo into an invoice-scoped path.
 * Returns path null when no current logo exists (valid: name-only branding).
 */
export async function copyWorkspaceLogoToInvoiceSnapshot(
  supabase: SupabaseClient,
  workspaceId: string,
  invoiceId: string
): Promise<{ ok: true; path: string | null } | { ok: false; error: string }> {
  if (!supabase.storage?.from) {
    return { ok: true, path: null };
  }

  const sourcePaths = await listWorkspaceLogoPaths(supabase, workspaceId);
  const sourcePath = sourcePaths[0];
  if (!sourcePath) {
    return { ok: true, path: null };
  }

  const bytes = await downloadStorageObjectBytes(supabase, sourcePath);
  if (!bytes || bytes.length === 0) {
    return {
      ok: false,
      error: "Could not read the current business logo to freeze on this invoice.",
    };
  }

  const sniffed = sniffLogoMime(new Uint8Array(bytes));
  if (!sniffed) {
    return {
      ok: false,
      error: "The current business logo is not a supported image type.",
    };
  }
  const extension = MIME_TO_EXT[sniffed];
  const destPath = invoiceLogoSnapshotObjectPath(
    workspaceId,
    invoiceId,
    extension
  );

  const { error } = await supabase.storage
    .from(WORKSPACE_LOGO_BUCKET)
    .upload(destPath, bytes, {
      contentType: sniffed,
      upsert: true,
    });
  if (error) {
    return {
      ok: false,
      error: error.message || "Could not freeze the business logo on this invoice.",
    };
  }
  return { ok: true, path: destPath };
}

export async function createWorkspaceLogoSignedUrl(
  supabase: SupabaseClient,
  workspaceId: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  const paths = await listWorkspaceLogoPaths(supabase, workspaceId);
  const path = paths[0];
  if (!path) {
    return null;
  }
  const { data, error } = await supabase.storage
    .from(WORKSPACE_LOGO_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}

export async function workspaceHasLogo(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<boolean> {
  const paths = await listWorkspaceLogoPaths(supabase, workspaceId);
  return paths.length > 0;
}
