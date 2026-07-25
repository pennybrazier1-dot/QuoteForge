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

  useEffect(() => {
    void (async () => {
      const result = await getOrCreatePublicEnquiryLinkAction();
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setUrl(result.data.url);
      setPath(result.data.path);
      setLoading(false);
    })();
  }, []);

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
      description="Share this private link so customers can send enquiries into your QuoteForge account without signing up."
    >
      {loading ? <p className="text-sm text-muted">Preparing your link…</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
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
