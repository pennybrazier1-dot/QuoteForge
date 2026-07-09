"use client";

import { useState } from "react";
import {
  buildCustomerJobUrl,
  shouldShowCustomerJobLink,
} from "@/lib/enquiries/customer-job-link";
import type { StoredEnquiry } from "@/lib/enquiries/types";

type CustomerJobLinkPanelProps = {
  enquiry: StoredEnquiry;
  onNotice?: (message: string) => void;
  compact?: boolean;
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

  if (!shouldShowCustomerJobLink(enquiry)) {
    return null;
  }

  const customerLink = buildCustomerJobUrl(enquiry.id);

  async function handleCopyLink() {
    const success = await copyText(customerLink);
    setCopied(success);
    onNotice?.(
      success
        ? "Customer link copied to clipboard."
        : "Could not copy the customer link."
    );
  }

  function handleOpenLink() {
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
        <h3 className="qf-enquiry-customer-link-title">Customer link</h3>
        <p className="qf-enquiry-customer-link-description">
          Share this page with {enquiry.customerName} so they can confirm the
          visit details.
        </p>
        <p className="qf-enquiry-customer-link-url">{customerLink}</p>
      </div>
      <div className="qf-enquiry-customer-link-actions">
        <button
          type="button"
          className="qf-btn-secondary qf-enquiry-customer-link-btn"
          onClick={() => void handleCopyLink()}
        >
          {copied ? "Link copied" : "Copy customer link"}
        </button>
        <button
          type="button"
          className="qf-btn-secondary qf-enquiry-customer-link-btn"
          onClick={handleOpenLink}
        >
          Open customer link
        </button>
      </div>
    </section>
  );
}
