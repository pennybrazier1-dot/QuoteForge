"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AskQuestionDialog } from "@/components/enquiries/ask-question-dialog";
import { BookSiteVisitDialog } from "@/components/enquiries/book-site-visit-dialog";
import { EnquiryPhotoGallery } from "@/components/enquiries/enquiry-photo-gallery";
import { EnquiryStatusBadge } from "@/components/enquiries/enquiry-status-badge";
import { ProposalConfirmDialog } from "@/components/proposals/proposal-confirm-dialog";
import {
  declineStoredEnquiry,
  deleteStoredEnquiry,
  markEnquiryReviewing,
} from "@/lib/enquiries/enquiry-store";
import {
  formatEnquiryAddress,
  formatEnquiryReceivedDate,
} from "@/lib/enquiries/format";
import type { StoredEnquiry } from "@/lib/enquiries/types";

type EnquiryCardProps = {
  enquiry: StoredEnquiry;
};

type ConfirmAction = "decline" | "delete" | null;

export function EnquiryCard({ enquiry }: EnquiryCardProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [askQuestionOpen, setAskQuestionOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const isDeclined = enquiry.status === "declined";

  function handleReview() {
    markEnquiryReviewing(enquiry.id);
    router.push(`/enquiries/${enquiry.id}`);
  }

  function handleAskQuestion() {
    setAskQuestionOpen(true);
  }

  async function handleConfirmAction() {
    if (!confirmAction) {
      return;
    }

    setPendingAction(true);

    try {
      if (confirmAction === "decline") {
        declineStoredEnquiry(enquiry.id);
      } else {
        await deleteStoredEnquiry(enquiry.id);
      }

      setConfirmAction(null);
    } finally {
      setPendingAction(false);
    }
  }

  return (
    <>
      <article
        className={[
          "qf-enquiry-card",
          isDeclined ? "qf-enquiry-card-declined" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="qf-enquiry-card-head">
          <div>
            <h2 className="qf-enquiry-card-title">{enquiry.customerName}</h2>
            <p className="qf-enquiry-card-service">{enquiry.serviceRequested}</p>
          </div>
          <EnquiryStatusBadge status={enquiry.status} />
        </div>

        {enquiry.photoCount > 0 ? (
          <EnquiryPhotoGallery
            enquiryId={enquiry.id}
            photos={enquiry.photos ?? []}
            photoCount={enquiry.photoCount}
            variant="card"
          />
        ) : null}

        <dl className="qf-enquiry-meta">
          <div>
            <dt>Address</dt>
            <dd>{formatEnquiryAddress(enquiry) || "Not provided"}</dd>
          </div>
          <div>
            <dt>Photos</dt>
            <dd>{enquiry.photoCount}</dd>
          </div>
          <div>
            <dt>Measurements</dt>
            <dd>{enquiry.hasMeasurements ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{formatEnquiryReceivedDate(enquiry.receivedAt)}</dd>
          </div>
        </dl>

        {notice ? (
          <p className="qf-enquiry-card-notice" role="status">
            {notice}
          </p>
        ) : null}

        <div className="qf-enquiry-actions">
          <button
            type="button"
            className="qf-btn-primary qf-enquiry-action-primary"
            onClick={handleReview}
            disabled={isDeclined}
          >
            Review Enquiry
          </button>
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action"
            onClick={() => setSiteVisitOpen(true)}
            disabled={isDeclined}
          >
            Book Site Visit
          </button>
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action"
            onClick={handleAskQuestion}
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
          <Link href={`/enquiries/${enquiry.id}`} className="qf-enquiry-detail-link">
            Open detail
          </Link>
        </div>
      </article>

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
            <strong>Declined</strong>. You can still view the enquiry in your
            list, but it will move out of New enquiries.
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
