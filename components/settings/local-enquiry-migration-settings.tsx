"use client";

import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/settings-section";
import { getStoredEnquiries } from "@/lib/enquiries/enquiry-store";
import {
  countPhotoBlobsForEnquiries,
  deleteEnquiryPhotoBlob,
  getEnquiryPhotoBlob,
  listPhotoBlobIdsForEnquiry,
} from "@/lib/enquiries/photo-blob-store";
import { getSiteVisitSession } from "@/lib/site-visit/site-visit-session-store";
import {
  importLocalEnquiriesAction,
  type LocalMigrationReport,
} from "@/lib/enquiries/server/migration-actions";
import { migrateLocalPhotoAction } from "@/lib/enquiries/server/photo-actions";
import type { SiteVisitSession } from "@/lib/site-visit/types";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

const MIGRATION_FLAG_KEY = "quoteforge:local-enquiry-migration-completed";
const MIGRATION_DISMISS_KEY = "quoteforge:local-enquiry-migration-dismissed";

type PhotoMigrationSummary = {
  attempted: number;
  imported: number;
  skipped: number;
  failed: Array<{ id: string; reason: string }>;
  remaining: number;
};

export function LocalEnquiryMigrationSettings() {
  const mounted = useClientMounted();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<LocalMigrationReport | null>(null);
  const [photoReport, setPhotoReport] = useState<PhotoMigrationSummary | null>(
    null
  );
  const [localPhotoCount, setLocalPhotoCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewTick, setViewTick] = useState(0);

  const localCount = mounted ? getStoredEnquiries().length : 0;
  const completed =
    mounted && window.localStorage.getItem(MIGRATION_FLAG_KEY) === "1";
  const dismissed =
    mounted && window.localStorage.getItem(MIGRATION_DISMISS_KEY) === "1";

  // viewTick forces a re-read after dismiss/migrate
  void viewTick;

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let cancelled = false;
    const enquiries = getStoredEnquiries();

    void countPhotoBlobsForEnquiries(enquiries.map((enquiry) => enquiry.id)).then(
      (count) => {
        if (!cancelled) {
          setLocalPhotoCount(count);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [mounted, viewTick, localCount]);

  function handleDismiss() {
    window.localStorage.setItem(MIGRATION_DISMISS_KEY, "1");
    setViewTick((value) => value + 1);
  }

  async function migratePhotosForEnquiryIds(
    enquiryIds: string[]
  ): Promise<PhotoMigrationSummary> {
    const summary: PhotoMigrationSummary = {
      attempted: 0,
      imported: 0,
      skipped: 0,
      failed: [],
      remaining: 0,
    };

    for (const enquiryId of enquiryIds) {
      const blobIds = await listPhotoBlobIdsForEnquiry(enquiryId);
      const enquiry = getStoredEnquiries().find((item) => item.id === enquiryId);
      const session = getSiteVisitSession(enquiryId);

      for (const photoId of blobIds) {
        summary.attempted += 1;
        const blob = await getEnquiryPhotoBlob(enquiryId, photoId);

        if (!blob) {
          summary.failed.push({
            id: photoId,
            reason: "Local photo file could not be read.",
          });
          summary.remaining += 1;
          continue;
        }

        const meta = enquiry?.photos?.find((photo) => photo.id === photoId);
        const file = new File(
          [blob],
          meta?.name || `${photoId}.jpg`,
          { type: meta?.type || blob.type || "image/jpeg" }
        );

        const formData = new FormData();
        formData.set("enquiryId", enquiryId);
        formData.set("mediaId", photoId);
        if (session?.enquiryId) {
          // site visit id is resolved server-side when missing
        }
        formData.set("file", file);

        const result = await migrateLocalPhotoAction(formData);

        if (!result.ok) {
          summary.failed.push({ id: photoId, reason: result.error });
          summary.remaining += 1;
          continue;
        }

        if (result.data.skipped) {
          summary.skipped += 1;
        } else {
          summary.imported += 1;
        }

        // Local blob is safe to clear only after the account has the photo.
        await deleteEnquiryPhotoBlob(enquiryId, photoId);
      }
    }

    // Count any leftover blobs after attempts (failed uploads stay local).
    summary.remaining = await countPhotoBlobsForEnquiries(enquiryIds);
    return summary;
  }

  async function handleMigrate() {
    setBusy(true);
    setError(null);
    setReport(null);
    setPhotoReport(null);

    const enquiries = getStoredEnquiries();
    const sessions: Record<string, SiteVisitSession | null> = {};
    for (const enquiry of enquiries) {
      sessions[enquiry.id] = getSiteVisitSession(enquiry.id);
    }

    const result = await importLocalEnquiriesAction({ enquiries, sessions });

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    setReport(result.report);

    // Always try photo migration for every local enquiry that still has blobs,
    // including previously imported enquiries that skipped on retry.
    const allLocalIds = enquiries.map((enquiry) => enquiry.id);
    const photos = await migratePhotosForEnquiryIds(allLocalIds);
    setPhotoReport(photos);

    const enquiryFailures = result.report.failed.length > 0;
    const unresolvedPhotos = photos.remaining > 0 || photos.failed.length > 0;

    if (!enquiryFailures && !unresolvedPhotos) {
      window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    }

    setBusy(false);
    setViewTick((value) => value + 1);
  }

  if (!mounted) {
    return (
      <SettingsSection
        title="Move local enquiries"
        description="Checking this browser for older enquiry records…"
      >
        <p className="text-sm text-muted">Loading…</p>
      </SettingsSection>
    );
  }

  if (completed && localCount === 0 && localPhotoCount === 0) {
    return (
      <SettingsSection
        title="Move local enquiries"
        description="Any older browser-only enquiries on this device have already been migrated."
      >
        <p className="text-sm text-muted">Migration complete for this browser.</p>
      </SettingsSection>
    );
  }

  if (localCount === 0 && localPhotoCount === 0) {
    return (
      <SettingsSection
        title="Move local enquiries"
        description="No browser-only enquiries were found on this device."
      >
        <p className="text-sm text-muted">
          New enquiries are saved in your QuoteForge account automatically.
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Move local enquiries"
      description="This browser still has older enquiry records saved only on this device. You can move them into your QuoteForge account."
    >
      <div className="qf-stack gap-3">
        <p className="text-sm">
          Found <strong>{localCount}</strong> local enquiry
          {localCount === 1 ? "" : "ies"} on this device
          {localPhotoCount > 0 ? (
            <>
              {" "}
              and <strong>{localPhotoCount}</strong> local photo
              {localPhotoCount === 1 ? "" : "s"}
            </>
          ) : null}
          .
        </p>
        <p className="text-sm text-muted">
          Enquiry text moves first. Photos stored in this browser are uploaded
          next. We will not mark migration complete while photos still need
          attention. Local copies stay on this device until each upload
          succeeds.
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {report ? (
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            <p>Enquiries attempted: {report.attempted}</p>
            <p>Enquiries imported: {report.imported}</p>
            <p>Enquiries skipped: {report.skipped}</p>
            {report.failed.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {report.failed.map((item) => (
                  <li key={`${item.id}-${item.reason}`}>
                    {item.id}: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {photoReport ? (
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            <p>Photos attempted: {photoReport.attempted}</p>
            <p>Photos uploaded: {photoReport.imported}</p>
            <p>Photos already on account: {photoReport.skipped}</p>
            <p>Photos still on this device: {photoReport.remaining}</p>
            {photoReport.failed.length > 0 ? (
              <>
                <p className="mt-2 text-destructive">
                  Some photos could not be uploaded. Enquiry text may have moved,
                  but photo migration is not complete.
                </p>
                <ul className="mt-2 list-disc pl-5">
                  {photoReport.failed.map((item) => (
                    <li key={`${item.id}-${item.reason}`}>
                      {item.id}: {item.reason}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {photoReport.remaining > 0 && photoReport.failed.length === 0 ? (
              <p className="mt-2">
                Photos remain on this device. Retry migration when you are ready.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="qf-btn-primary"
            disabled={busy}
            onClick={() => void handleMigrate()}
          >
            {busy ? "Migrating…" : "Move to my account"}
          </button>
          {!dismissed ? (
            <button
              type="button"
              className="qf-btn-secondary"
              disabled={busy}
              onClick={handleDismiss}
            >
              Remind me later
            </button>
          ) : null}
        </div>
      </div>
    </SettingsSection>
  );
}
