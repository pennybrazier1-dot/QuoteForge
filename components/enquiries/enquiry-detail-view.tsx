"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AskQuestionDialog } from "@/components/enquiries/ask-question-dialog";
import { CustomerJobLinkPanel } from "@/components/enquiries/customer-job-link-panel";
import { SiteVisitModeLinkPanel } from "@/components/enquiries/site-visit-mode-link-panel";
import { buildQuotePreparationPath } from "@/lib/proposals/quote-preparation/quote-preparation-path";
import { EnquiryPhotoGallery } from "@/components/enquiries/enquiry-photo-gallery";
import { EnquiryStatusBadge } from "@/components/enquiries/enquiry-status-badge";
import { ProposalConfirmDialog } from "@/components/proposals/proposal-confirm-dialog";
import {
  buildBookVisitFromEnquiryHref,
  buildCreateQuoteFromEnquiryHref,
  formatEnquiryCustomerAddress,
} from "@/lib/enquiries/book-visit-handoff";
import { shouldShowReviewEnquiryOnDetailPage } from "@/lib/enquiries/enquiry-detail-actions";
import {
  declineEnquiryAction,
  deleteEnquiryAction,
  markEnquiryReviewingAction,
} from "@/lib/enquiries/server/actions";
import { useWorkspaceEnquiry } from "@/lib/enquiries/server/use-workspace-enquiries";
import {
  formatEnquiryReceivedDate,
  formatEnquiryTimelineDate,
} from "@/lib/enquiries/format";
import { getEnquiryPropertyDetailRows } from "@/lib/enquiries/property-details";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

type ConfirmAction = "decline" | "delete" | null;

export function EnquiryDetailView({ enquiryId }: { enquiryId: string }) {
  const router = useRouter();
  const mounted = useClientMounted();
  const { enquiry, state, error, refresh } = useWorkspaceEnquiry(enquiryId);
  const [notice, setNotice] = useState<string | null>(null);
  const [askQuestionOpen, setAskQuestionOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const showReviewButton = shouldShowReviewEnquiryOnDetailPage();

  const enquiryStatus = enquiry?.status;

  useEffect(() => {
    if (!enquiryId || enquiryStatus !== "new") {
      return;
    }

    void markEnquiryReviewingAction(enquiryId).then((result) => {
      if (result.ok) {
        void refresh();
      }
    });
  }, [enquiryId, enquiryStatus, refresh]);

  if (!mounted || state === "loading") {
    return <p className="qf-enquiry-empty">Loading enquiry…</p>;
  }

  if (state === "error") {
    return (
      <div className="qf-enquiry-empty-card">
        <h2 className="qf-enquiry-empty-title">Could not load enquiry</h2>
        <p className="qf-enquiry-empty-copy">{error ?? "Something went wrong."}</p>
        <button type="button" className="qf-btn-secondary" onClick={() => void refresh()}>
          Try again
        </button>
        <Link href="/enquiries" className="qf-btn-secondary qf-enquiry-back-link">
          Back to enquiries
        </Link>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="qf-enquiry-empty-card">
        <h2 className="qf-enquiry-empty-title">Enquiry not found</h2>
        <p className="qf-enquiry-empty-copy">
          This enquiry is not in your workspace. It may have been deleted or belong
          to a different account.
        </p>
        <Link href="/enquiries" className="qf-btn-secondary qf-enquiry-back-link">
          Back to enquiries
        </Link>
      </div>
    );
  }

  const propertyDetails = getEnquiryPropertyDetailRows(enquiry);
  const customerAddress = formatEnquiryCustomerAddress(enquiry);
  const isDeclined = enquiry.status === "declined";
  const bookVisitHref = buildBookVisitFromEnquiryHref(enquiry.id);
  const createQuoteHref = buildCreateQuoteFromEnquiryHref(enquiry.id);

  async function handleConfirmAction() {
    if (!confirmAction) {
      return;
    }

    setPendingAction(true);

    try {
      if (confirmAction === "decline") {
        const result = await declineEnquiryAction(enquiryId);
        if (result.ok) {
          await refresh();
        } else {
          setNotice(result.error);
        }
        setConfirmAction(null);
        return;
      }

      const result = await deleteEnquiryAction(enquiryId);

      if (result.ok) {
        router.push("/enquiries");
      } else {
        setNotice(result.error);
      }
    } finally {
      setPendingAction(false);
    }
  }

  async function handleReviewEnquiry() {
    if (!enquiry) {
      return;
    }

    const result = await markEnquiryReviewingAction(enquiry.id);
    if (result.ok) {
      await refresh();
    } else {
      setNotice(result.error);
    }
  }

  return (
    <>
      <div
        className={[
          "qf-enquiry-detail",
          isDeclined ? "qf-enquiry-detail-declined" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="qf-enquiry-detail-head">
          <div>
            <Link href="/enquiries" className="qf-enquiry-back">
              ← Back to enquiries
            </Link>
            <h1 className="qf-enquiry-detail-title">{enquiry.customerName}</h1>
            <p className="qf-enquiry-detail-subtitle">{enquiry.serviceRequested}</p>
          </div>
          <EnquiryStatusBadge status={enquiry.status} />
        </div>

        <section className="qf-card qf-enquiry-detail-card">
          <h2 className="qf-enquiry-detail-section-title">Next step</h2>
          <p className="qf-enquiry-detail-copy">
            Book an initial site visit to assess the job, or create a quote if you
            already have enough detail.
          </p>
          <div className="qf-enquiry-handoff-actions">
            {isDeclined ? (
              <button
                type="button"
                className="qf-btn-primary qf-enquiry-action-primary"
                disabled
              >
                Book visit
              </button>
            ) : (
              <Link
                href={bookVisitHref}
                className="qf-btn-primary qf-enquiry-action-primary"
              >
                Book visit
              </Link>
            )}
            <Link
              href={createQuoteHref}
              className="qf-btn-secondary qf-enquiry-action"
              aria-disabled={isDeclined}
              onClick={(event) => {
                if (isDeclined) {
                  event.preventDefault();
                }
              }}
            >
              Create quote
            </Link>
            <button
              type="button"
              className="qf-btn-secondary qf-enquiry-action"
              onClick={() => setAskQuestionOpen(true)}
              disabled={isDeclined}
            >
              Reply to customer
            </button>
          </div>
          {enquiry.siteVisitSlot ? (
            <p className="qf-enquiry-detail-copy qf-enquiry-site-visit-booked">
              Earlier site visit slot: {enquiry.siteVisitSlot}
            </p>
          ) : null}
          <div className="qf-enquiry-visit-links">
            <CustomerJobLinkPanel enquiry={enquiry} onNotice={setNotice} />
            <SiteVisitModeLinkPanel enquiry={enquiry} />
          </div>
          {enquiry.status === "site_visit_completed" ||
          enquiry.status === "quote_in_preparation" ? (
            <section className="qf-enquiry-site-visit-mode-panel">
              <div className="qf-enquiry-site-visit-mode-copy">
                <h3 className="qf-enquiry-site-visit-mode-title">Prepare quote</h3>
                <p className="qf-enquiry-site-visit-mode-description">
                  Turn the completed site visit into a draft quote you can review
                  and price. For now it saves on this device only — it is not a
                  sent Reanvil proposal yet.
                </p>
              </div>
              <Link
                href={buildQuotePreparationPath(enquiry.id)}
                className="qf-btn-primary qf-enquiry-site-visit-mode-btn"
              >
                Prepare Quote
              </Link>
            </section>
          ) : null}
        </section>

        {notice ? (
          <p className="qf-enquiry-card-notice" role="status">
            {notice}
          </p>
        ) : null}

        <div className="qf-enquiry-detail-grid">
          <section className="qf-card qf-enquiry-detail-card">
            <h2 className="qf-enquiry-detail-section-title">Customer details</h2>
            <dl className="qf-enquiry-detail-list">
              <div>
                <dt>Customer name</dt>
                <dd>{enquiry.customerName}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{enquiry.customerMobile || "Not provided"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{enquiry.customerEmail || "Not provided"}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{customerAddress || "Not provided"}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{formatEnquiryReceivedDate(enquiry.receivedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="qf-card qf-enquiry-detail-card">
            <h2 className="qf-enquiry-detail-section-title">Property details</h2>
            <dl className="qf-enquiry-detail-list">
              {propertyDetails.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="qf-card qf-enquiry-detail-card qf-enquiry-detail-wide">
            <h2 className="qf-enquiry-detail-section-title">
              Original request
            </h2>
            <p className="qf-enquiry-detail-copy qf-enquiry-original-service">
              {enquiry.serviceRequested || "Service not specified"}
            </p>
            <p className="qf-enquiry-detail-copy">
              {enquiry.projectDescription || "No description provided."}
            </p>
          </section>

          <section className="qf-card qf-enquiry-detail-card qf-enquiry-detail-wide">
            <h2 className="qf-enquiry-detail-section-title">Uploaded photos</h2>
            <EnquiryPhotoGallery
              enquiryId={enquiry.id}
              photos={enquiry.photos ?? []}
              photoCount={enquiry.photoCount}
              variant="detail"
            />
          </section>

          <section className="qf-card qf-enquiry-detail-card">
            <h2 className="qf-enquiry-detail-section-title">Measurements</h2>
            {enquiry.hasMeasurements ? (
              <dl className="qf-enquiry-detail-list">
                {enquiry.measurements.map((field) => (
                  <div key={field.id}>
                    <dt>{field.label}</dt>
                    <dd>
                      {field.value.trim()}
                      {field.unit ? ` ${field.unit}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="qf-enquiry-detail-copy">
                Customer did not include measurements.
              </p>
            )}
          </section>

          <section className="qf-card qf-enquiry-detail-card qf-enquiry-detail-wide">
            <h2 className="qf-enquiry-detail-section-title">Trade-specific answers</h2>
            {enquiry.tradeAnswers.length === 0 ? (
              <p className="qf-enquiry-detail-copy">No trade-specific answers provided.</p>
            ) : (
              <dl className="qf-enquiry-detail-list">
                {enquiry.tradeAnswers.map((answer) => (
                  <div key={answer.questionId}>
                    <dt>{answer.question}</dt>
                    <dd>{answer.answer}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="qf-card qf-enquiry-detail-card qf-enquiry-detail-wide">
            <h2 className="qf-enquiry-detail-section-title">Timeline</h2>
            <ol className="qf-enquiry-timeline">
              {enquiry.timeline.map((event) => (
                <li key={event.id} className="qf-enquiry-timeline-item">
                  <span className="qf-enquiry-timeline-label">{event.label}</span>
                  <span className="qf-enquiry-timeline-date">
                    {formatEnquiryTimelineDate(event.at)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="qf-enquiry-actions qf-enquiry-detail-actions">
          {showReviewButton ? (
            <button
              type="button"
              className="qf-btn-primary qf-enquiry-action-primary"
              onClick={() => void handleReviewEnquiry()}
              disabled={isDeclined}
            >
              Review Enquiry
            </button>
          ) : null}
          {!isDeclined ? (
            <Link
              href={bookVisitHref}
              className="qf-btn-primary qf-enquiry-action-primary"
            >
              Book visit
            </Link>
          ) : null}
          <Link
            href={createQuoteHref}
            className="qf-btn-secondary qf-enquiry-action"
            aria-disabled={isDeclined}
            onClick={(event) => {
              if (isDeclined) {
                event.preventDefault();
              }
            }}
          >
            Create quote
          </Link>
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action"
            onClick={() => setAskQuestionOpen(true)}
            disabled={isDeclined}
          >
            Reply to customer
          </button>
          {!isDeclined ? (
            <button
              type="button"
              className="qf-btn-secondary qf-enquiry-action qf-enquiry-action-decline"
              onClick={() => setConfirmAction("decline")}
            >
              Decline
            </button>
          ) : null}
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action qf-enquiry-action-delete"
            onClick={() => setConfirmAction("delete")}
          >
            Delete Enquiry
          </button>
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action"
            onClick={() => router.push("/enquiries")}
          >
            Back to list
          </button>
        </div>
      </div>

      <AskQuestionDialog
        enquiry={enquiry}
        open={askQuestionOpen}
        onClose={() => setAskQuestionOpen(false)}
        onAction={setNotice}
      />

      <ProposalConfirmDialog
        open={confirmAction === "decline"}
        title="Decline this enquiry?"
        description={
          <>
            This will mark <strong>{enquiry.customerName}</strong> as{" "}
            <strong>Declined</strong>. The status badge will update on this page
            and in your enquiries list.
          </>
        }
        confirmLabel="Decline enquiry"
        pending={pendingAction}
        destructive
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />

      <ProposalConfirmDialog
        open={confirmAction === "delete"}
        title="Delete this enquiry?"
        description={
          <>
            This removes <strong>{enquiry.customerName}</strong> from your
            workspace, including any saved photos. This cannot be undone.
          </>
        }
        confirmLabel="Delete enquiry"
        pending={pendingAction}
        pendingLabel="Deleting…"
        destructive
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />
    </>
  );
}
