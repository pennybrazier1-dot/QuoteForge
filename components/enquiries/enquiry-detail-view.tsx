"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AskQuestionDialog } from "@/components/enquiries/ask-question-dialog";
import { BookSiteVisitDialog } from "@/components/enquiries/book-site-visit-dialog";
import { EnquiryPhotoGallery } from "@/components/enquiries/enquiry-photo-gallery";
import { EnquiryStatusBadge } from "@/components/enquiries/enquiry-status-badge";
import { ProposalConfirmDialog } from "@/components/proposals/proposal-confirm-dialog";
import { shouldShowReviewEnquiryOnDetailPage } from "@/lib/enquiries/enquiry-detail-actions";
import {
  declineStoredEnquiry,
  deleteStoredEnquiry,
  markEnquiryReviewing,
} from "@/lib/enquiries/enquiry-store";
import {
  formatEnquiryReceivedDate,
  formatEnquiryTimelineDate,
} from "@/lib/enquiries/format";
import { getEnquiryPropertyDetailRows } from "@/lib/enquiries/property-details";
import { useStoredEnquiry } from "@/lib/enquiries/use-stored-enquiries";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

type ConfirmAction = "decline" | "delete" | null;

export function EnquiryDetailView({ enquiryId }: { enquiryId: string }) {
  const router = useRouter();
  const mounted = useClientMounted();
  const enquiry = useStoredEnquiry(enquiryId);
  const [notice, setNotice] = useState<string | null>(null);
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [askQuestionOpen, setAskQuestionOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const showReviewButton = shouldShowReviewEnquiryOnDetailPage();

  const enquiryStatus = enquiry?.status;

  useEffect(() => {
    if (!enquiryId || enquiryStatus !== "new") {
      return;
    }

    markEnquiryReviewing(enquiryId);
  }, [enquiryId, enquiryStatus]);

  if (!mounted) {
    return <p className="qf-enquiry-empty">Loading enquiry…</p>;
  }

  if (!enquiry) {
    return (
      <div className="qf-enquiry-empty-card">
        <h2 className="qf-enquiry-empty-title">Enquiry not found</h2>
        <p className="qf-enquiry-empty-copy">
          This enquiry is not in local browser storage. It may have been cleared
          or created in a different browser.
        </p>
        <Link href="/enquiries" className="qf-btn-secondary qf-enquiry-back-link">
          Back to enquiries
        </Link>
      </div>
    );
  }

  const propertyDetails = getEnquiryPropertyDetailRows(enquiry);
  const isDeclined = enquiry.status === "declined";

  async function handleConfirmAction() {
    if (!confirmAction) {
      return;
    }

    setPendingAction(true);

    try {
      if (confirmAction === "decline") {
        declineStoredEnquiry(enquiryId);
        setConfirmAction(null);
        return;
      }

      const deleted = await deleteStoredEnquiry(enquiryId);

      if (deleted) {
        router.push("/enquiries");
      }
    } finally {
      setPendingAction(false);
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
          <h2 className="qf-enquiry-detail-section-title">Suggested next action</h2>
          <p className="qf-enquiry-detail-copy">{enquiry.suggestedNextAction}</p>
          {enquiry.siteVisitSlot ? (
            <p className="qf-enquiry-detail-copy qf-enquiry-site-visit-booked">
              Booked slot: {enquiry.siteVisitSlot}
            </p>
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
                <dt>Name</dt>
                <dd>{enquiry.customerName}</dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{enquiry.customerMobile || "Not provided"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{enquiry.customerEmail || "Not provided"}</dd>
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
            <h2 className="qf-enquiry-detail-section-title">Project description</h2>
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
              <p className="qf-enquiry-detail-copy">Customer did not include measurements.</p>
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
              onClick={() => markEnquiryReviewing(enquiry.id)}
              disabled={isDeclined}
            >
              Review Enquiry
            </button>
          ) : null}
          <button
            type="button"
            className={
              showReviewButton
                ? "qf-btn-secondary qf-enquiry-action"
                : "qf-btn-primary qf-enquiry-action-primary"
            }
            onClick={() => setSiteVisitOpen(true)}
            disabled={isDeclined}
          >
            Book Site Visit
          </button>
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action"
            onClick={() => setAskQuestionOpen(true)}
            disabled={isDeclined}
          >
            Ask Question
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

      <BookSiteVisitDialog
        enquiry={enquiry}
        open={siteVisitOpen}
        onClose={() => setSiteVisitOpen(false)}
        onBooked={setNotice}
      />

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
            This removes <strong>{enquiry.customerName}</strong> from this
            browser, including any saved photo previews. This cannot be undone.
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
