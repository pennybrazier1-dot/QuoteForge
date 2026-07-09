"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookSiteVisitDialog } from "@/components/enquiries/book-site-visit-dialog";
import { EnquiryPhotoGallery } from "@/components/enquiries/enquiry-photo-gallery";
import { EnquiryStatusBadge } from "@/components/enquiries/enquiry-status-badge";
import {
  declineStoredEnquiry,
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

export function EnquiryCard({ enquiry }: EnquiryCardProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  function handleReview() {
    markEnquiryReviewing(enquiry.id);
    router.push(`/enquiries/${enquiry.id}`);
  }

  function handleAskQuestion() {
    setNotice("Ask Question is coming soon — messages will be saved here.");
  }

  function handleDecline() {
    declineStoredEnquiry(enquiry.id);
    setNotice("Enquiry declined — saved locally for now.");
  }

  return (
    <>
      <article className="qf-enquiry-card">
        <div className="qf-enquiry-card-head">
          <div>
            <h2 className="qf-enquiry-card-title">{enquiry.customerName}</h2>
            <p className="qf-enquiry-card-service">{enquiry.serviceRequested}</p>
          </div>
          <EnquiryStatusBadge status={enquiry.status} />
        </div>

        {enquiry.photoPreviews.length > 0 ? (
          <EnquiryPhotoGallery photos={enquiry.photoPreviews} variant="card" />
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
          >
            Review Enquiry
          </button>
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action"
            onClick={() => setSiteVisitOpen(true)}
          >
            Book Site Visit
          </button>
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action"
            onClick={handleAskQuestion}
          >
            Ask Question
          </button>
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-action qf-enquiry-action-muted"
            onClick={handleDecline}
          >
            Decline
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
    </>
  );
}
