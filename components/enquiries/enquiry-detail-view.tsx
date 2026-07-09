"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EnquiryStatusBadge } from "@/components/enquiries/enquiry-status-badge";
import {
  bookEnquirySiteVisit,
  declineStoredEnquiry,
  markEnquiryReviewing,
} from "@/lib/enquiries/enquiry-store";
import {
  formatEnquiryAddress,
  formatEnquiryReceivedDate,
  formatEnquiryTimelineDate,
} from "@/lib/enquiries/format";
import { useStoredEnquiry } from "@/lib/enquiries/use-stored-enquiries";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

export function EnquiryDetailView({ enquiryId }: { enquiryId: string }) {
  const router = useRouter();
  const mounted = useClientMounted();
  const enquiry = useStoredEnquiry(enquiryId);
  const [notice, setNotice] = useState<string | null>(null);

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

  return (
    <div className="qf-enquiry-detail">
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
            <div>
              <dt>Address</dt>
              <dd>{formatEnquiryAddress(enquiry) || "Not provided"}</dd>
            </div>
            <div>
              <dt>Property type</dt>
              <dd>{enquiry.propertyType || "Not provided"}</dd>
            </div>
          </dl>
        </section>

        <section className="qf-card qf-enquiry-detail-card qf-enquiry-detail-wide">
          <h2 className="qf-enquiry-detail-section-title">Project description</h2>
          <p className="qf-enquiry-detail-copy">
            {enquiry.projectDescription || "No description provided."}
          </p>
        </section>

        <section className="qf-card qf-enquiry-detail-card">
          <h2 className="qf-enquiry-detail-section-title">Uploaded photos</h2>
          {enquiry.photoCount === 0 ? (
            <p className="qf-enquiry-detail-copy">No photos uploaded.</p>
          ) : (
            <div className="qf-enquiry-photo-grid">
              {Array.from({ length: enquiry.photoCount }, (_, index) => (
                <div key={index} className="qf-enquiry-photo-placeholder">
                  Photo {index + 1}
                </div>
              ))}
            </div>
          )}
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
        <button
          type="button"
          className="qf-btn-primary qf-enquiry-action-primary"
          onClick={() => {
            markEnquiryReviewing(enquiry.id);
            setNotice("Marked as reviewing — saved locally for now.");
          }}
        >
          Review Enquiry
        </button>
        <button
          type="button"
          className="qf-btn-secondary qf-enquiry-action"
          onClick={() => {
            bookEnquirySiteVisit(enquiry.id);
            setNotice("Site visit marked as booked — saved locally for now.");
          }}
        >
          Book Site Visit
        </button>
        <button
          type="button"
          className="qf-btn-secondary qf-enquiry-action"
          onClick={() =>
            setNotice("Ask Question is coming soon — messages will be saved here.")
          }
        >
          Ask Question
        </button>
        <button
          type="button"
          className="qf-btn-secondary qf-enquiry-action qf-enquiry-action-muted"
          onClick={() => {
            declineStoredEnquiry(enquiry.id);
            setNotice("Enquiry declined — saved locally for now.");
          }}
        >
          Decline
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
  );
}
