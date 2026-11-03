"use client";

import { useEffect, useState } from "react";
import { shouldShowCustomerJobLink } from "@/lib/enquiries/customer-job-link";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import { getEnquiryVisitConfirmationAction } from "@/lib/visits/customer-confirmation/enquiry-confirmation-action";

type CustomerJobLinkPanelProps = {
  enquiry: StoredEnquiry;
  onNotice?: (message: string) => void;
  compact?: boolean;
};

type LinkResult = {
  enquiryId: string;
  url: string | null;
  error: string | null;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CustomerJobLinkPanel({
  enquiry,
  onNotice,
  compact = false,
}: CustomerJobLinkPanelProps) {
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);

  const shouldShow = shouldShowCustomerJobLink(enquiry);

  // Drop stale results when the enquiry changes (render-time sync).
  if (result && result.enquiryId !== enquiry.id) {
    setResult(null);
  }

  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    let cancelled = false;
    void getEnquiryVisitConfirmationAction(enquiry.id).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setResult({
          enquiryId: enquiry.id,
          url: null,
          error: response.error,
        });
        return;
      }
      setResult({
        enquiryId: enquiry.id,
        url: response.url,
        error: null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enquiry.id, shouldShow]);

  if (!shouldShow) {
    return null;
  }

  const loading = !result || result.enquiryId !== enquiry.id;
  const customerLink =
    result && result.enquiryId === enquiry.id ? result.url : null;
  const loadError =
    result && result.enquiryId === enquiry.id ? result.error : null;

  async function handleCopyLink() {
    if (!customerLink) {
      return;
    }
    const success = await copyText(customerLink);
    setCopied(success);
    onNotice?.(
      success
        ? "Customer confirmation link copied."
        : "Could not copy the customer link."
    );
  }

  function handleOpenLink() {
    if (!customerLink) {
      return;
    }
    window.open(customerLink, "_blank", "noopener,noreferrer");
  }

  return (
    <section
      className={[
        "qf-enquiry-customer-link-panel",
        compact ? "qf-enquiry-customer-link-panel-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="qf-enquiry-customer-link-copy">
        <h3 className="qf-enquiry-customer-link-title">Customer confirmation</h3>
        <p className="qf-enquiry-customer-link-description">
          Share this secure page with {enquiry.customerName} so they can see the
          visit details on any device.
        </p>
        {loading ? (
          <p className="qf-enquiry-customer-link-url">Loading secure link…</p>
        ) : customerLink ? (
          <p className="qf-enquiry-customer-link-url">{customerLink}</p>
        ) : (
          <p className="qf-enquiry-customer-link-url">
            {loadError ?? "Secure confirmation link is not available yet."}
          </p>
        )}
      </div>
      <div className="qf-enquiry-customer-link-actions">
        <button
          type="button"
          className="qf-btn-secondary qf-enquiry-customer-link-btn"
          onClick={() => void handleCopyLink()}
          disabled={!customerLink}
        >
          {copied ? "Copied" : "Copy customer link"}
        </button>
        <button
          type="button"
          className="qf-btn-secondary qf-enquiry-customer-link-btn"
          onClick={handleOpenLink}
          disabled={!customerLink}
        >
          Open customer link
        </button>
      </div>
    </section>
  );
}
