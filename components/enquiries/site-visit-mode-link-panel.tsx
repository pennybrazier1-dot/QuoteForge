"use client";

import Link from "next/link";
import {
  buildSiteVisitModePath,
  shouldShowSiteVisitModeLink,
} from "@/lib/enquiries/site-visit-mode-link";
import type { StoredEnquiry } from "@/lib/enquiries/types";

type SiteVisitModeLinkPanelProps = {
  enquiry: StoredEnquiry;
  compact?: boolean;
};

export function SiteVisitModeLinkPanel({
  enquiry,
  compact = false,
}: SiteVisitModeLinkPanelProps) {
  if (!shouldShowSiteVisitModeLink(enquiry)) {
    return null;
  }

  const siteVisitPath = buildSiteVisitModePath(enquiry.id);

  return (
    <section
      className={[
        "qf-enquiry-site-visit-mode-panel",
        compact ? "qf-enquiry-site-visit-mode-panel-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="qf-enquiry-site-visit-mode-copy">
        <h3 className="qf-enquiry-site-visit-mode-title">Site visit mode</h3>
        <p className="qf-enquiry-site-visit-mode-description">
          Collect photos, notes, measurements, and checklist updates while you
          are on site with {enquiry.customerName}.
        </p>
      </div>
      <Link
        href={siteVisitPath}
        className="qf-btn-primary qf-enquiry-site-visit-mode-btn"
      >
        Open Site Visit Mode
      </Link>
    </section>
  );
}
