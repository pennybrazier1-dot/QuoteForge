"use client";

import { useSyncExternalStore } from "react";
import { EnquiryCard } from "@/components/enquiries/enquiry-card";
import {
  getStoredEnquiries,
  subscribeToEnquiries,
} from "@/lib/enquiries/enquiry-store";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

export function EnquiriesBrowser() {
  const mounted = useClientMounted();
  const enquiries = useSyncExternalStore(
    subscribeToEnquiries,
    getStoredEnquiries,
    () => []
  );

  const newEnquiries = enquiries.filter((enquiry) => enquiry.status === "new");
  const otherEnquiries = enquiries.filter((enquiry) => enquiry.status !== "new");

  if (!mounted) {
    return <p className="qf-enquiry-empty">Loading enquiries…</p>;
  }

  if (enquiries.length === 0) {
    return (
      <div className="qf-enquiry-empty-card">
        <h2 className="qf-enquiry-empty-title">No enquiries yet</h2>
        <p className="qf-enquiry-empty-copy">
          When a customer completes the quote request journey in this browser,
          their enquiry will appear here. Try submitting a test enquiry at{" "}
          <span className="qf-enquiry-inline-path">/request-quote</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="qf-enquiry-browser">
      <section className="qf-enquiry-section">
        <div className="qf-enquiry-section-head">
          <h2 className="qf-enquiry-section-title">New enquiries</h2>
          <span className="qf-enquiry-section-count">{newEnquiries.length}</span>
        </div>

        {newEnquiries.length === 0 ? (
          <p className="qf-enquiry-section-empty">No new enquiries right now.</p>
        ) : (
          <div className="qf-enquiry-list">
            {newEnquiries.map((enquiry) => (
              <EnquiryCard key={enquiry.id} enquiry={enquiry} />
            ))}
          </div>
        )}
      </section>

      {otherEnquiries.length > 0 ? (
        <section className="qf-enquiry-section">
          <div className="qf-enquiry-section-head">
            <h2 className="qf-enquiry-section-title">Other enquiries</h2>
            <span className="qf-enquiry-section-count">
              {otherEnquiries.length}
            </span>
          </div>

          <div className="qf-enquiry-list">
            {otherEnquiries.map((enquiry) => (
              <EnquiryCard key={enquiry.id} enquiry={enquiry} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
