"use client";

import { useEffect, useState } from "react";
import { EnquiryCard } from "@/components/enquiries/enquiry-card";
import { clearLocalTestEnquiries } from "@/lib/enquiries/enquiry-store";
import { getOrCreatePublicEnquiryLinkAction } from "@/lib/enquiries/server/actions";
import { useWorkspaceEnquiries } from "@/lib/enquiries/server/use-workspace-enquiries";
import { isDevTestingEnabledClient } from "@/lib/env/dev-testing";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

export function EnquiriesBrowser() {
  const mounted = useClientMounted();
  const { enquiries, state, error, refresh } = useWorkspaceEnquiries();
  const [devNotice, setDevNotice] = useState<string | null>(null);
  const [publicLinkPath, setPublicLinkPath] = useState<string | null>(null);
  const showDevTools = isDevTestingEnabledClient();

  useEffect(() => {
    if (!mounted || enquiries.length > 0) {
      return;
    }

    void getOrCreatePublicEnquiryLinkAction().then((result) => {
      if (result.ok) {
        setPublicLinkPath(result.data.path);
      }
    });
  }, [mounted, enquiries.length]);

  const newEnquiries = enquiries.filter((enquiry) => enquiry.status === "new");
  const otherEnquiries = enquiries.filter((enquiry) => enquiry.status !== "new");

  if (!mounted || state === "loading") {
    return <p className="qf-enquiry-empty">Loading enquiries…</p>;
  }

  if (state === "error") {
    return (
      <div className="qf-enquiry-empty-card">
        <h2 className="qf-enquiry-empty-title">Could not load enquiries</h2>
        <p className="qf-enquiry-empty-copy">{error ?? "Something went wrong."}</p>
        <button type="button" className="qf-btn-secondary" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  }

  function handleClearLocalEnquiries() {
    clearLocalTestEnquiries();
    setDevNotice(
      "Local test enquiries cleared from this browser. Your workspace list above is unchanged."
    );
  }

  if (enquiries.length === 0) {
    return (
      <div className="qf-enquiry-empty-card">
        {showDevTools ? (
          <div className="qf-enquiry-dev-tools">
            <button
              type="button"
              className="qf-btn-secondary qf-enquiry-dev-clear"
              onClick={handleClearLocalEnquiries}
            >
              Clear local test enquiries
            </button>
          </div>
        ) : null}

        {devNotice ? (
          <p className="qf-enquiry-card-notice" role="status">
            {devNotice}
          </p>
        ) : null}

        <h2 className="qf-enquiry-empty-title">No enquiries yet</h2>
        <p className="qf-enquiry-empty-copy">
          When a customer completes your public quote form, their enquiry will
          appear here. Share your link from Settings
          {publicLinkPath ? (
            <>
              {" "}
              (<span className="qf-enquiry-inline-path">{publicLinkPath}</span>)
            </>
          ) : null}
          .
        </p>
      </div>
    );
  }

  return (
    <div className="qf-enquiry-browser">
      {showDevTools ? (
        <div className="qf-enquiry-dev-tools">
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-dev-clear"
            onClick={handleClearLocalEnquiries}
          >
            Clear local test enquiries
          </button>
        </div>
      ) : null}

      {devNotice ? (
        <p className="qf-enquiry-card-notice" role="status">
          {devNotice}
        </p>
      ) : null}

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
