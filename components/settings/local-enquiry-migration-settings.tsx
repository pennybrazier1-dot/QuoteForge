"use client";

import { useState } from "react";
import { SettingsSection } from "@/components/settings/settings-section";
import { getStoredEnquiries } from "@/lib/enquiries/enquiry-store";
import { getSiteVisitSession } from "@/lib/site-visit/site-visit-session-store";
import {
  importLocalEnquiriesAction,
  type LocalMigrationReport,
} from "@/lib/enquiries/server/migration-actions";
import type { SiteVisitSession } from "@/lib/site-visit/types";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

const MIGRATION_FLAG_KEY = "quoteforge:local-enquiry-migration-completed";
const MIGRATION_DISMISS_KEY = "quoteforge:local-enquiry-migration-dismissed";

export function LocalEnquiryMigrationSettings() {
  const mounted = useClientMounted();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<LocalMigrationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewTick, setViewTick] = useState(0);

  const localCount = mounted ? getStoredEnquiries().length : 0;
  const completed =
    mounted && window.localStorage.getItem(MIGRATION_FLAG_KEY) === "1";
  const dismissed =
    mounted && window.localStorage.getItem(MIGRATION_DISMISS_KEY) === "1";

  // viewTick forces a re-read after dismiss/migrate
  void viewTick;

  function handleDismiss() {
    window.localStorage.setItem(MIGRATION_DISMISS_KEY, "1");
    setViewTick((value) => value + 1);
  }

  async function handleMigrate() {
    setBusy(true);
    setError(null);
    setReport(null);

    const enquiries = getStoredEnquiries();
    const sessions: Record<string, SiteVisitSession | null> = {};
    for (const enquiry of enquiries) {
      sessions[enquiry.id] = getSiteVisitSession(enquiry.id);
    }

    const result = await importLocalEnquiriesAction({ enquiries, sessions });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setReport(result.report);

    if (result.report.failed.length === 0) {
      window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    }

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

  if (completed && localCount === 0) {
    return (
      <SettingsSection
        title="Move local enquiries"
        description="Any older browser-only enquiries on this device have already been migrated."
      >
        <p className="text-sm text-muted">Migration complete for this browser.</p>
      </SettingsSection>
    );
  }

  if (localCount === 0) {
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
          {localCount === 1 ? "" : "ies"} on this device.
        </p>
        <p className="text-sm text-muted">
          We will not delete the local copies until the import succeeds. You can
          dismiss this and come back later.
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {report ? (
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            <p>Attempted: {report.attempted}</p>
            <p>Imported: {report.imported}</p>
            <p>Skipped: {report.skipped}</p>
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
