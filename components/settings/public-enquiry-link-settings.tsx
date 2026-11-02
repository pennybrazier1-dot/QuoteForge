"use client";

import { useEffect, useState } from "react";
import { getOrCreatePublicEnquiryLinkAction } from "@/lib/enquiries/server/actions";
import { SettingsSection } from "@/components/settings/settings-section";

export function PublicEnquiryLinkSettings() {
  const [url, setUrl] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getOrCreatePublicEnquiryLinkAction();
        if (cancelled) return;

        if (!result.ok) {
          setUrl(null);
          setPath(null);
          setError(result.error);
          setLoading(false);
          return;
        }

        setUrl(result.data.url);
        setPath(result.data.path);
        setError(null);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setUrl(null);
        setPath(null);
        setError("Could not prepare your public link. Try again.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  function handleRetry() {
    setLoading(true);
    setError(null);
    setRetryKey((current) => current + 1);
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link. You can select and copy it manually.");
    }
  }

  return (
    <SettingsSection
      title="Customer quote request link"
      description="Share this public link or turn it into a QR code for your van, cards and adverts. It only opens the enquiry form — never your jobs, customers or payment details."
    >
      {loading ? <p className="text-sm text-muted">Preparing your link…</p> : null}
      {error ? (
        <div className="qf-stack gap-3">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <button type="button" className="qf-btn-secondary w-fit" onClick={handleRetry}>
            Try again
          </button>
        </div>
      ) : null}
      {!loading && !error && !url ? (
        <div className="qf-stack gap-3">
          <p className="text-sm text-muted" role="status">
            Your link is not ready yet.
          </p>
          <button type="button" className="qf-btn-secondary w-fit" onClick={handleRetry}>
            Prepare link
          </button>
        </div>
      ) : null}
      {url ? (
        <div className="qf-stack gap-3">
          <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {url}
          </p>
          {path ? (
            <p className="text-xs text-muted">Path: {path}</p>
          ) : null}
          <button type="button" className="qf-btn-secondary w-fit" onClick={handleCopy}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </SettingsSection>
  );
}
