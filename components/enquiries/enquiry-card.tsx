"use client";

import Link from "next/link";
import { useState } from "react";
import { AskQuestionDialog } from "@/components/enquiries/ask-question-dialog";
import { EnquiryPhotoGallery } from "@/components/enquiries/enquiry-photo-gallery";
import { EnquiryStatusBadge } from "@/components/enquiries/enquiry-status-badge";
import { ProposalConfirmDialog } from "@/components/proposals/proposal-confirm-dialog";
import { buildBookVisitFromEnquiryHref } from "@/lib/enquiries/book-visit-handoff";
import {
  declineStoredEnquiry,
  deleteStoredEnquiry,
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
  const [notice, setNotice] = useState<string | null>(null);
  const [askQuestionOpen, setAskQuestionOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const isDeclined = enquiry.status === "declined";
  const enquiryDetailHref = `/enquiries/${enquiry.id}`;
  const bookVisitHref = buildBookVisitFromEnquiryHref(enquiry.id);

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
          {isDeclined ? (
            <button
              type="button"
              className="qf-btn-primary qf-enquiry-action-primary"
              disabled
            >
              Review Enquiry
            </button>
          ) : (
            <Link
              href={enquiryDetailHref}
              className="qf-btn-primary qf-enquiry-action-primary"
            >
              Review Enquiry
            </Link>
          )}
          {isDeclined ? (
            <button
              type="button"
              className="qf-btn-secondary qf-enquiry-action"
              disabled
            >
              Book Site Visit
            </button>
          ) : (
            <Link
              href={bookVisitHref}
              className="qf-btn-secondary qf-enquiry-action"
            >
              Book Site Visit
            </Link>
          )}
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
          <Link href={enquiryDetailHref} className="qf-enquiry-detail-link">
            Open detail
          </Link>
        </div>
      </article>

      <AskQuestionDialog
        enquiry={enquiry}
        open={askQuestionOpen}
        onClose={() => setAskQuestionOpen(false)}
        onAction={setNotice}
      />

      <ProposalConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction === "decline" ? "Decline this enquiry?" : "Delete enquiry?"
        }
        description={
          confirmAction === "decline"
            ? "The customer will stay in your list as declined."
            : "This removes the enquiry from your list. This cannot be undone."
        }
        confirmLabel={confirmAction === "decline" ? "Decline" : "Delete"}
        pending={pendingAction}
        destructive={confirmAction === "delete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />
    </>
  );
}
